import { useState, useCallback, useEffect } from 'react';
import { useAccount, useConnect, useDisconnect, useBalance, useWriteContract, useSimulateContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { parseUnits, formatUnits } from 'viem';
import type { PoolKeyData, SwapCommand, BalanceDeltaResult } from './swap-executor';
import {
  executeSwap,
  UNIVERSAL_ROUTER_ABI,
  UNIVERSAL_ROUTER_ADDRESS,
  PERMIT2_ADDRESS,
  PERMIT2_APPROVE_ABI,
  extractDeltaFromReceipt,
  computeRealizedSlippage,
} from './swap-executor';

/* ─── Demo tokens ——————————————————————————— */
const WETH: `0x${string}` = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC: `0x${string}` = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const UNI: `0x${string}` = '0x1f9840a31d5de8dc8c9d2e9f8c9e9c9f9e9c9e9f';

const TOKENS = [
  { address: WETH, symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  { address: USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { address: UNI, symbol: 'UNI', name: 'Uniswap', decimals: 18 },
] as const;

/* ─── Demo pool — this would come from subgraph in prod ———— */
const WETH_USDC_3000: PoolKeyData = {
  currency0: USDC,
  currency1: WETH,
  fee: 3000,
  tickSpacing: 60,
  hooks: '0x0000000000000000000000000000000000000000',
};

/* ─── Hook address — deployed contract — — — — — — — — — — */
const HOOK_ADDRESS: `0x${string}` = '0x0000000000000000000000000000000000002400';

/* ─── Format helpers ——————————————————— */
function fmtAmount(val: bigint, decimals: number): string {
  return Number(formatUnits(val, decimals)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

/* ─── Main component ——————————————————— */
export default function App() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: ethBalance } = useBalance({ address });

  const [fromToken, setFromToken] = useState<typeof TOKENS[number]>(TOKENS[0]);
  const [toToken, setToToken] = useState<typeof TOKENS[number]>(TOKENS[1]);
  const [amountIn, setAmountIn] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [swapCmd, setSwapCmd] = useState<SwapCommand | null>(null);
  const [flowExpanded, setFlowExpanded] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState('');

  // On-chain state
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [delta, setDelta] = useState<BalanceDeltaResult | null>(null);
  const [gasUsed, setGasUsed] = useState<bigint | null>(null);
  const [effectiveGasPrice, setEffectiveGasPrice] = useState<bigint | null>(null);
  const [executedPrice, setExecutedPrice] = useState<number | null>(null);
  const [slippagePercent, setSlippagePercent] = useState<number | null>(null);
  const [permitApproved, setPermitApproved] = useState(false);
  const [permitTxHash, setPermitTxHash] = useState<`0x${string}` | null>(null);

  const { writeContract, isPending: isWritePending } = useWriteContract();

  // Pre-simulate the swap to validate it would succeed
  const { data: _simulateData, isError: isSimulateError, error: simulateError } =
    useSimulateContract({
      address: UNIVERSAL_ROUTER_ADDRESS,
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: 'execute',
      args: swapCmd
        ? [swapCmd.commands, swapCmd.inputs, swapCmd.deadline]
        : undefined,
      query: { enabled: Boolean(swapCmd && address) },
    });

  // Check Permit2 allowance for the input token
  const amtNum = parseFloat(amountIn);
  const amountWeiForCheck = !Number.isNaN(amtNum) && amtNum > 0
    ? parseUnits(amtNum.toFixed(fromToken.decimals), fromToken.decimals)
    : 0n;

  const { data: permit2Allowance } = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: [{
      type: 'function',
      name: 'allowance',
      inputs: [
        { name: 'token', type: 'address' },
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
      ],
      outputs: [
        { name: 'amount', type: 'uint160' },
        { name: 'expiration', type: 'uint48' },
        { name: 'nonce', type: 'uint48' },
      ],
      stateMutability: 'view',
    }],
    functionName: 'allowance',
    args: address ? [fromToken.address, address, UNIVERSAL_ROUTER_ADDRESS] : undefined,
    query: { enabled: Boolean(address && amountWeiForCheck > 0n) },
  });

  // Determine if Permit2 approval is needed
  const currentPermitAllowance: bigint = Array.isArray(permit2Allowance)
    ? BigInt((permit2Allowance[0] ?? 0).toString())
    : 0n;
  const needsPermitApproval = isConnected && amountWeiForCheck > 0n && currentPermitAllowance < amountWeiForCheck;

  const { isLoading: isConfirming, isSuccess: isConfirmed, data: receiptData } =
    useWaitForTransactionReceipt({ hash: txHash ?? undefined });

  const {
    isLoading: isPermitConfirming,
    isSuccess: isPermitConfirmed,
    data: _permitReceiptData,
  } = useWaitForTransactionReceipt({ hash: permitTxHash ?? undefined });

  /* ─── Connect ——— */
  const handleConnect = useCallback(() => {
    connect({ connector: injected() });
  }, [connect]);

  /* ─── Build Execute calldata ——— */
  const handleBuildAndExecute = useCallback(() => {
    const amt = parseFloat(amountIn);
    if (Number.isNaN(amt) || amt <= 0 || !address) return;

    const slippageVal = parseFloat(slippage) || 0.5;
    const amountWei = parseUnits(amt.toFixed(fromToken.decimals), fromToken.decimals);

    const zeroForOne = fromToken.address === USDC;

    // Use the pool with the hook address
    const poolKey: PoolKeyData = {
      ...WETH_USDC_3000,
      hooks: HOOK_ADDRESS,
    };

    // Compute amountOutMinimum from slippage
    // In a real app this comes from a quoter; for demo we use a simple estimate
    // (1:1 price). The user sets slippage as % of estimated output.
    const estimatedOut = amountWei; // simplified: assume 1:1
    const amountOutMin = estimatedOut * BigInt(Math.floor((10000 - slippageVal * 100))) / BigInt(10000);

    const cmd = executeSwap(
      poolKey,
      zeroForOne,
      amountWei,
      amountOutMin,
      address,
    );

    setSwapCmd(cmd);
    setTxError(null);
    setDelta(null);
    setTxHash(null);

    // Check simulation first
    if (isSimulateError && simulateError) {
      setTxError(`Simulation failed: ${simulateError.message}`);
      return;
    }

    // Execute via wagmi using the simulated request if available
    writeContract(
      {
        address: UNIVERSAL_ROUTER_ADDRESS,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: 'execute',
        args: [cmd.commands, cmd.inputs, cmd.deadline],
      },
      {
        onSuccess: (hash: `0x${string}`) => {
          setTxHash(hash);
        },
        onError: (err: Error) => {
          setTxError(err.message);
        },
      },
    );
  }, [amountIn, slippage, fromToken, address, writeContract, isSimulateError, simulateError]);

  /* ─── Permit2 Approve ——— */
  const handlePermitApprove = useCallback(() => {
    if (!address) return;
    const amt = parseFloat(amountIn);
    if (Number.isNaN(amt) || amt <= 0) return;
    const amountWei = parseUnits(amt.toFixed(fromToken.decimals), fromToken.decimals);

    writeContract(
      {
        address: PERMIT2_ADDRESS,
        abi: PERMIT2_APPROVE_ABI,
        functionName: 'approve',
        args: [
          fromToken.address,
          UNIVERSAL_ROUTER_ADDRESS,
          BigInt(amountWei.toString()),
          Math.floor(Date.now() / 1000) + 86400 * 30,
        ],
      },
      {
        onSuccess: (hash: `0x${string}`) => {
          setPermitTxHash(hash);
        },
        onError: (err: Error) => {
          setTxError(err.message);
        },
      },
    );
  }, [fromToken, amountIn, address, writeContract]);

  // When permit approval confirms, mark it
  useEffect(() => {
    if (isPermitConfirmed && !permitApproved) {
      setPermitApproved(true);
    }
  }, [isPermitConfirmed, permitApproved]);

  // Decode BalanceDelta from the swap receipt once confirmed
  useEffect(() => {
    if (receiptData && txHash) {
      const logs = (receiptData.logs ?? []).map((log: { topics: string[]; data: string }) => ({
        topics: log.topics as string[],
        data: log.data,
      }));
      const decoded = extractDeltaFromReceipt(logs);
      if (decoded) {
        setDelta(decoded);

        // Compute executed price from delta
        const absOut = decoded.amount1 > 0n ? decoded.amount1 : -decoded.amount1;
        const absIn = decoded.amount0 < 0n ? -decoded.amount0 : decoded.amount0;
        if (absIn > 0n) {
          const price = Number(absOut) / Number(absIn);
          setExecutedPrice(price);
        }

        // Compute realized slippage if we have amountOutMinimum
        if (swapCmd && absOut > 0n) {
          // Estimate amountOutMinimum from the swap params
          // We stored it in cmd but it's encoded in inputs — use quoted 1:1 estimate
          const amtOut = zeroForOne ? decoded.amount1 : decoded.amount0;
          const actualOut = amtOut < 0n ? -amtOut : amtOut;
          // Compute from the slippage tolerance
          const amtParsed = parseFloat(amountIn);
          if (amtParsed > 0) {
            const estimatedOutWei = parseUnits(amtParsed.toFixed(fromToken.decimals), fromToken.decimals);
            const slippageVal = parseFloat(slippage) || 0.5;
            const minOut = estimatedOutWei * BigInt(Math.floor((10000 - slippageVal * 100))) / BigInt(10000);
            const sp = computeRealizedSlippage(minOut, actualOut);
            setSlippagePercent(sp);
          }
        }
      }

      // Extract gas info from receipt
      if ('gasUsed' in receiptData) setGasUsed(receiptData.gasUsed as bigint);
      if ('effectiveGasPrice' in receiptData) setEffectiveGasPrice(receiptData.effectiveGasPrice as bigint);
    }
  }, [receiptData, txHash]);

  // Decode delta from confirmed tx
  const confirmed = isConfirmed && txHash;

  /* ─── Clipboard ——— */
  const handleCopy = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(`Copied ${label}`);
      setTimeout(() => setCopyFeedback(''), 2000);
    } catch {
      setCopyFeedback('Copy failed');
    }
  }, []);

  /* ─── Determine output side ——— */
  const zeroForOne = fromToken.address === USDC;
  const outputSymbol = zeroForOne ? toToken.symbol : fromToken.symbol;
  const inputSymbol = zeroForOne ? fromToken.symbol : toToken.symbol;

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <svg className="uni-logo" viewBox="0 0 32 32" width="28" height="28">
            <circle cx="16" cy="16" r="14" fill="#FC72FF" />
            <path d="M10 20 L16 10 L22 20 Z" fill="white" />
          </svg>
          <span className="header-title">V4 Swap Executor</span>
        </div>

        <nav className="header-nav">
          <span className="nav-pill active">Swap</span>
          <span className="nav-pill">Pool</span>
          <span className="nav-pill">V4 Flow</span>
        </nav>

        <div className="header-right">
          {ethBalance && (
            <span className="balance-badge">
              {Number(ethBalance.formatted).toFixed(4)} ETH
            </span>
          )}
          {isConnected ? (
            <button className="wallet-btn connected" onClick={() => disconnect()}>
              <span className="dot" />
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          ) : (
            <button className="wallet-btn" onClick={handleConnect}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <main className="swap-page">
        <div className="swap-layout">
          {/* Swap Card */}
          <section className="swap-card">
            <div className="swap-card-header">
              <h2>Swap via V4 + UniversalRouter</h2>
              <label className="chain-badge">
                <span className="chain-dot" />
                {chainId ? `Chain ${chainId}` : 'Ethereum'}
              </label>
            </div>

            {/* You Pay */}
            <div className="swap-input-group">
              <label className="swap-field-label">You Pay</label>
              <div className="swap-field">
                <input
                  type="number"
                  className="swap-amount-input"
                  placeholder="0.0"
                  value={amountIn}
                  onChange={e => setAmountIn(e.target.value)}
                  step="any"
                />
                <select
                  className="token-select"
                  value={fromToken.address}
                  onChange={e => {
                    const t = TOKENS.find(t => t.address === e.target.value);
                    if (t) setFromToken(t);
                  }}
                >
                  {TOKENS.map(t => (
                    <option key={t.address} value={t.address}>{t.symbol}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Direction */}
            <div className="swap-direction">
              <button
                className="direction-btn"
                onClick={() => {
                  const tmp = fromToken;
                  setFromToken(toToken);
                  setToToken(tmp);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 16L7 8M7 8L3 12M7 8L11 12" />
                  <path d="M17 8L17 16M17 16L13 12M17 16L21 12" />
                </svg>
              </button>
            </div>

            {/* You Receive */}
            <div className="swap-input-group">
              <label className="swap-field-label">You Receive</label>
              <div className="swap-field">
                <div className="swap-output-display">
                  {confirmed && delta
                    ? fmtAmount(delta.amount1 < 0n ? -delta.amount1 : delta.amount1, toToken.decimals)
                    : swapCmd
                      ? 'Awaiting on-chain…'
                      : '0.0'}
                </div>
                <select
                  className="token-select"
                  value={toToken.address}
                  onChange={e => {
                    const t = TOKENS.find(t => t.address === e.target.value);
                    if (t) setToToken(t);
                  }}
                >
                  {TOKENS.map(t => (
                    <option key={t.address} value={t.address}>{t.symbol}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Slippage */}
            <div className="slippage-row">
              <label>Slippage Tolerance</label>
              <div className="slippage-input-group">
                {['0.1', '0.5', '1.0'].map(v => (
                  <button
                    key={v}
                    className={`slippage-preset ${slippage === v ? 'active' : ''}`}
                    onClick={() => setSlippage(v)}
                  >
                    {v}%
                  </button>
                ))}
                <input
                  type="number"
                  className="slippage-custom"
                  value={slippage}
                  onChange={e => setSlippage(e.target.value)}
                  step="0.1"
                  min="0"
                  placeholder="%"
                />
              </div>
            </div>

            {/* Hook Address Display */}
            <div className="hook-badge-row">
              <span className="hook-badge-label">Hook Contract</span>
              <span className="hook-badge mono">{HOOK_ADDRESS.slice(0, 10)}…{HOOK_ADDRESS.slice(-6)}</span>
              <a
                href={`https://etherscan.io/address/${HOOK_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hook-link"
              >
                ↗
              </a>
            </div>

            {/* Permit2 Approval — only show if allowance check says we need it */}
            {needsPermitApproval && !permitApproved && (
              <button
                className="permit-btn"
                onClick={handlePermitApprove}
                disabled={isPermitConfirming || isWritePending}
              >
                {isPermitConfirming
                  ? 'Approving via Permit2…'
                  : isPermitConfirmed
                    ? `✓ ${fromToken.symbol} approved via Permit2`
                    : `1. Approve ${fromToken.symbol} via Permit2`}
              </button>
            )}
            {permitApproved && (
              <div className="permit-approved-badge">✓ {fromToken.symbol} approved via Permit2</div>
            )}

            {/* Execute */}
            <button
              className={`swap-action-btn ${isConnected ? '' : 'connect-prompt'}`}
              onClick={isConnected ? handleBuildAndExecute : handleConnect}
              disabled={isWritePending || isConfirming}
            >
              {!isConnected
                ? 'Connect Wallet to Swap'
                : isWritePending
                  ? 'Building calldata & submitting…'
                  : isConfirming
                    ? `Swapping… ${txHash?.slice(0, 10)}…`
                    : confirmed
                      ? '✓ Swap Complete — Execute Another'
                      : '2. Execute Swap via UniversalRouter'}
            </button>

            {/* Tx status */}
            {txHash && (
              <div className="tx-status-row">
                <a
                  href={`https://etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tx-link"
                >
                  View on Etherscan ↗
                </a>
                <span className={`tx-status ${isConfirming ? 'pending' : isConfirmed ? 'confirmed' : ''}`}>
                  {isConfirming ? 'Confirming…' : isConfirmed ? 'Confirmed ✓' : ''}
                </span>
              </div>
            )}

            {txError && (
              <div className="tx-error">
                <span className="tx-error-icon">⚠</span>
                {txError}
              </div>
            )}

            {/* On-chain results */}
            {confirmed && delta && (
              <div className="tx-results-section">
                <h4 className="result-heading">Transaction Results (from Receipt)</h4>

                {/* BalanceDelta */}
                <div className="result-block">
                  <h5 className="block-title">BalanceDelta</h5>
                  <div className="delta-display-compact">
                    <div className="delta-row">
                      <span className="delta-label">amount0</span>
                      <span className={`delta-value ${delta.amount0 < 0n ? 'neg' : 'pos'}`}>
                        {delta.amount0 < 0n ? '−' : '+'}{fmtAmount(delta.amount0 < 0n ? -delta.amount0 : delta.amount0, fromToken.decimals)}
                      </span>
                    </div>
                    <div className="delta-row">
                      <span className="delta-label">amount1</span>
                      <span className={`delta-value ${delta.amount1 < 0n ? 'neg' : 'pos'}`}>
                        {delta.amount1 < 0n ? '−' : '+'}{fmtAmount(delta.amount1 < 0n ? -delta.amount1 : delta.amount1, toToken.decimals)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Executed Price */}
                <div className="result-block">
                  <h5 className="block-title">Executed Price</h5>
                  <div className="delta-row">
                    <span className="delta-label">Rate</span>
                    <span className="delta-value" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      1 {inputSymbol} = {executedPrice?.toFixed(8) ?? '—'} {outputSymbol}
                    </span>
                  </div>
                </div>

                {/* Gas */}
                <div className="result-block">
                  <h5 className="block-title">Gas</h5>
                  <div className="delta-row">
                    <span className="delta-label">Used</span>
                    <span className="delta-value" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                      {gasUsed?.toString() ?? '—'}
                    </span>
                  </div>
                  {effectiveGasPrice !== null && (
                    <div className="delta-row">
                      <span className="delta-label">Price</span>
                      <span className="delta-value" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                        {formatUnits(effectiveGasPrice, 9)} gwei
                      </span>
                    </div>
                  )}
                  {gasUsed !== null && effectiveGasPrice !== null && (
                    <div className="delta-row">
                      <span className="delta-label">Total</span>
                      <span className="delta-value" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                        {formatUnits(gasUsed * effectiveGasPrice, 18)} ETH
                      </span>
                    </div>
                  )}
                </div>

                {/* Slippage */}
                {slippagePercent !== null && (
                  <div className="result-block">
                    <h5 className="block-title">Slippage</h5>
                    <div className="delta-row">
                      <span className="delta-label">Requested</span>
                      <span className="delta-value" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{slippage}%</span>
                    </div>
                    <div className="delta-row">
                      <span className="delta-label">Realized</span>
                      <span className={`delta-value ${slippagePercent > parseFloat(slippage) ? 'neg' : 'pos'}`}>
                        {slippagePercent.toFixed(4)}%
                      </span>
                    </div>
                    <div className={`slippage-verdict ${slippagePercent > parseFloat(slippage) ? 'danger' : 'safe'}`}>
                      {slippagePercent > parseFloat(slippage)
                        ? '⚠ EXCEEDS SLIPPAGE TOLERANCE'
                        : '✓ Within slippage tolerance'}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Flow + Details Panel */}
          <aside className="flow-panel">
            <div className="flow-panel-header">
              <h3>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FC72FF" strokeWidth="2">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                </svg>
                Real Execution Flow
              </h3>
              <button
                className="flow-toggle"
                onClick={() => setFlowExpanded(p => !p)}
              >
                {flowExpanded ? 'Collapse' : 'Expand'}
              </button>
            </div>

            {flowExpanded && (
              <div className="flow-steps">
                {/* Step 0: Permit2 */}
                <div className="flow-step">
                  <div className={`step-indicator ${isPermitConfirmed ? 'success' : ''}`}>
                    {isPermitConfirmed ? '✓' : 'P'}
                  </div>
                  <div className="step-content">
                    <div className="step-title">Permit2.approve()</div>
                    <div className="step-detail">
                      <code>Permit2.approve({fromToken.symbol}, UniversalRouter, amount)</code>
                      {permitTxHash && (
                        <div className="step-tx-hash">
                          Tx: <code>{permitTxHash.slice(0, 14)}…</code>
                          <span className={`status-dot ${isPermitConfirmed ? 'green' : 'yellow'}`} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 1: V4Planner */}
                <div className="flow-step">
                  <div className={`step-indicator ${swapCmd ? 'active' : ''}`}>1</div>
                  <div className="step-content">
                    <div className="step-title">V4Planner.addAction(SWAP_EXACT_IN_SINGLE)</div>
                    <div className="step-detail">
                      <code>Actions.SWAP_EXACT_IN_SINGLE = 6</code>
                      <button className="copy-mini" onClick={() => handleCopy('6', 'action')}>
                        {copyFeedback.includes('action') ? '✓' : '⎘'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 2: Swap params */}
                <div className="flow-step">
                  <div className={`step-indicator ${swapCmd ? 'active' : ''}`}>2</div>
                  <div className="step-content">
                    <div className="step-title">Swap Parameters</div>
                    <div className="step-detail">
                      <table className="params-table">
                        <tbody>
                          <tr><td className="param-name">poolKey</td><td className="param-val mono code">{WETH_USDC_3000.currency0.slice(0, 10)}…/{WETH_USDC_3000.currency1.slice(0, 10)}…</td></tr>
                          <tr><td className="param-name">fee</td><td className="param-val mono">3000 (0.30%)</td></tr>
                          <tr><td className="param-name">hooks</td><td className="param-val mono code">{HOOK_ADDRESS.slice(0, 10)}…</td></tr>
                          <tr><td className="param-name">zeroForOne</td><td className="param-val mono">{zeroForOne ? 'true (USDC→WETH)' : 'false (WETH→USDC)'}</td></tr>
                          <tr><td className="param-name">amountIn</td><td className="param-val mono code">{amountIn || '—'} {fromToken.symbol}</td></tr>
                          <tr><td className="param-name">slippage</td><td className="param-val mono">{slippage}%</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Step 3: V4Planner.finalize() */}
                <div className="flow-step">
                  <div className={`step-indicator ${swapCmd ? 'active' : ''}`}>3</div>
                  <div className="step-content">
                    <div className="step-title">V4Planner.finalize() → (commands, inputs)</div>
                    <div className="step-detail">
                      {swapCmd ? (
                        <div className="execute-detail">
                          <div className="call-row">
                            <span className="call-label">commands</span>
                            <code className="call-data">{swapCmd.commands}</code>
                          </div>
                          <div className="call-row">
                            <span className="call-label">inputs</span>
                            <code className="call-data">{swapCmd.inputs[0]?.slice(0, 64) ?? '—'}…</code>
                          </div>
                          <div className="call-row">
                            <span className="call-label">deadline</span>
                            <code className="call-data">{swapCmd.deadline.toString()}</code>
                          </div>
                          <button className="copy-full" onClick={() => handleCopy(JSON.stringify(swapCmd, null, 2), 'calldata')}>
                            {copyFeedback.includes('calldata') ? '✓ Copied!' : '⎘ Copy Calldata'}
                          </button>
                        </div>
                      ) : (
                        <span className="step-placeholder">Enter amount and execute swap</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 4: UniversalRouter.execute() */}
                <div className="flow-step">
                  <div className={`step-indicator ${txHash ? 'active' : ''}`}>4</div>
                  <div className="step-content">
                    <div className="step-title">UniversalRouter.execute(commands, inputs, deadline)</div>
                    <div className="step-detail">
                      <code>execute(bytes, bytes[], uint256)</code>
                      {txHash && (
                        <div className="step-tx-hash">
                          Tx: <code>{txHash.slice(0, 18)}…</code>
                          <span className={`status-dot ${isConfirming ? 'yellow' : isConfirmed ? 'green' : ''}`} />
                        </div>
                      )}
                      {txError && <div className="step-error">{txError}</div>}
                    </div>
                  </div>
                </div>

                {/* Step 5: Decode BalanceDelta */}
                <div className="flow-step">
                  <div className={`step-indicator ${confirmed ? 'success' : ''}`}>
                    {confirmed ? '✓' : '5'}
                  </div>
                  <div className="step-content">
                    <div className="step-title">Decode BalanceDelta from Receipt</div>
                    <div className="step-detail">
                      {confirmed && delta ? (
                        <div className="delta-display">
                          <div className="delta-line">
                            <span className="delta-tag">amount0</span>
                            <span className={`delta-val ${delta.amount0 < 0n ? 'negative' : 'positive'}`}>
                              {delta.amount0 < 0n ? '−' : '+'}
                              {fmtAmount(delta.amount0 < 0n ? -delta.amount0 : delta.amount0, fromToken.decimals)}
                            </span>
                            <span className="delta-label">{inputSymbol}</span>
                          </div>
                          <div className="delta-line">
                            <span className="delta-tag">amount1</span>
                            <span className={`delta-val ${delta.amount1 < 0n ? 'negative' : 'positive'}`}>
                              {delta.amount1 < 0n ? '−' : '+'}
                              {fmtAmount(delta.amount1 < 0n ? -delta.amount1 : delta.amount1, toToken.decimals)}
                            </span>
                            <span className="delta-label">{outputSymbol}</span>
                          </div>
                          <button
                            className="copy-full"
                            onClick={() => handleCopy(JSON.stringify({ amount0: delta.amount0.toString(), amount1: delta.amount1.toString() }, null, 2), 'BalanceDelta')}
                          >
                            {copyFeedback.includes('BalanceDelta') ? '✓ Copied!' : '⎘ Copy BalanceDelta'}
                          </button>
                        </div>
                      ) : (
                        <span className="step-placeholder">
                          {txHash && isConfirming
                            ? 'Waiting for receipt…'
                            : 'Execute a swap to decode BalanceDelta from on-chain'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 6: Slippage */}
                <div className="flow-step">
                  <div className={`step-indicator ${confirmed ? 'success' : ''}`}>
                    {confirmed ? '✓' : '6'}
                  </div>
                  <div className="step-content">
                    <div className="step-title">Realized Slippage vs Quoted</div>
                    <div className="step-detail">
                      {confirmed && delta ? (
                        <div className="slippage-chart">
                          <div className="slippage-detail-grid">
                            <div className="sd-item">
                              <span className="sd-label">From Receipt</span>
                              <span className="sd-val mono">
                                {delta.amount0 < 0n ? '−' : '+'}{fmtAmount(delta.amount0 < 0n ? -delta.amount0 : delta.amount0, fromToken.decimals)} {inputSymbol}
                              </span>
                            </div>
                            <div className="sd-item">
                              <span className="sd-label">To Receipt</span>
                              <span className="sd-val mono">
                                {delta.amount1 < 0n ? '−' : '+'}{fmtAmount(delta.amount1 < 0n ? -delta.amount1 : delta.amount1, toToken.decimals)} {outputSymbol}
                              </span>
                            </div>
                            <div className="sd-item">
                              <span className="sd-label">Slippage Tolerance</span>
                              <span className="sd-val mono">{slippage}%</span>
                            </div>
                            <div className="sd-item">
                              <span className="sd-label">Quoted Output</span>
                              <span className="sd-val mono">{fmtAmount(parseUnits(amountIn || '0', 18), 18)} {outputSymbol}</span>
                            </div>
                          </div>
                          <p className="slippage-note">
                            Realized slippage is computed as (amountOutMinimum − actualOut) / amountOutMinimum × 100
                            from the decoded BalanceDelta in the transaction receipt's SwapProcessed event.
                          </p>
                        </div>
                      ) : (
                        <span className="step-placeholder">Execute a swap to see slippage from on-chain data</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Multi-hop info */}
            <div className="multi-hop-info">
              <h4>Multi-Hop via SWAP_EXACT_IN</h4>
              <p>
                V4Planner also supports <code>Actions.SWAP_EXACT_IN</code> (action 7) for multi-hop paths.
                Use <code>encodeRouteToPath()</code> to build a <code>PathKey[]</code> encoding
                intermediate currencies, fees, tick spacings, hooks, and hook data across multiple pools.
              </p>
            </div>

            {/* Hook contract info */}
            <div className="multi-hop-info">
              <h4>DynamicFeeSwapHook</h4>
              <p>
                Deployed at <code className="code-sm">{HOOK_ADDRESS}</code>.
                Implements <code>beforeSwap</code> (fee override) and <code>afterSwap</code> (emits
                <code>SwapProcessed</code> with the BalanceDelta). Guarded by <code>onlyPoolManager</code>.
                Foundry project at <code className="code-sm">contracts/</code>.
              </p>
            </div>
          </aside>
        </div>

        {/* Transaction History */}
        {txHash && (
          <section className="tx-history">
            <h3>Transaction History</h3>
            <table className="tx-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Hook</th>
                  <th>Tx Hash</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><span className="action-tag">V4_SWAP/EXACT_IN_SINGLE</span></td>
                  <td>{fromToken.symbol}</td>
                  <td>{toToken.symbol}</td>
                  <td className="mono">{HOOK_ADDRESS.slice(0, 8)}…</td>
                  <td className="mono">
                    <a
                      href={`https://etherscan.io/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="tx-link-inline"
                    >
                      {txHash.slice(0, 10)}…
                    </a>
                  </td>
                  <td>
                    <span className={`status-badge ${isConfirmed ? 'success' : isConfirming ? 'pending' : ''}`}>
                      {isConfirmed ? 'Confirmed' : isConfirming ? 'Pending' : 'Submitted'}
                    </span>
                  </td>
                </tr>
                {permitTxHash && (
                  <tr>
                    <td><span className="action-tag">PERMIT2_APPROVE</span></td>
                    <td>{fromToken.symbol}</td>
                    <td>UniversalRouter</td>
                    <td className="mono">—</td>
                    <td className="mono">
                      <a
                        href={`https://etherscan.io/tx/${permitTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="tx-link-inline"
                      >
                        {permitTxHash.slice(0, 10)}…
                      </a>
                    </td>
                    <td>
                      <span className={`status-badge ${isPermitConfirmed ? 'success' : isPermitConfirming ? 'pending' : ''}`}>
                        {isPermitConfirmed ? 'Confirmed' : isPermitConfirming ? 'Pending' : 'Submitted'}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {/* BalanceDelta hex display for advanced users */}
        {confirmed && delta && (
          <section className="tx-history" style={{ marginTop: 12 }}>
            <h3>Raw BalanceDelta (from SwapProcessed event)</h3>
            <div className="raw-delta">
              <code className="raw-delta-hex">
                BalanceDelta.wrap({delta.amount0.toString(16)})
              </code>
              <p className="raw-delta-desc">
                Upper 128 bits: amount0 = {delta.amount0.toString()} |
                Lower 128 bits: amount1 = {delta.amount1.toString()}
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
