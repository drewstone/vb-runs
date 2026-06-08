import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useReadContract, useSendTransaction, useWriteContract, usePublicClient } from 'wagmi'
import { parseEventLogs, type Log } from 'viem'
import {
  TOKENS, STATE_VIEW, STATE_VIEW_ABI, POOL_MANAGER_ABI, ERC20_ABI, PERMIT2_ABI,
  UNIVERSAL_ROUTER, PERMIT2, MaxAllowanceTransferAmount,
  CommandType, Actions,
  buildPoolKey, poolIdFromKey, zeroForOne, decodeBalanceDelta, encodeBalanceDelta,
  buildSwapCalldata, estimateOutput, priceFromSqrtPriceX96,
  formatTokenAmount, formatAddr, needsPermit2Approval,
  type TokenInfo, type PoolKey, type BalanceDelta, type SwapParams, type Hex,
} from './lib/v4'

const FLOW_STEPS = [
  { title: 'UniversalRouter.execute()', desc: 'Iterates commands[], dispatches each to the handler for that command byte.' },
  { title: '_dispatch(V4_SWAP = 0x10)', desc: 'Routes to V4SwapRouter. Decodes action byte from input to determine swap type.' },
  { title: 'V4Router._swapExactInputSingle()', desc: 'Unpacks ExactInputSingleParams (poolKey, zeroForOne, amounts). Calls PoolManager.swap().' },
  { title: 'PoolManager.swap(params)', desc: 'Executes swap in the v4 pool. Applies beforeSwap/afterSwap hook callbacks. Tick math computes result.' },
  { title: 'Returns BalanceDelta', desc: 'Packed int256: upper 128 bits = amount0, lower 128 bits = amount1. Decoded to net balance change.' },
] as const

type ExecState = 'idle' | 'approving' | 'signing' | 'sending' | 'confirming' | 'decoding' | 'complete' | 'error'

interface SwapResult {
  delta: BalanceDelta
  packedDelta: bigint
  quoted: bigint
  realized: bigint
  slippagePct: number
  txHash: string
  gasUsed: bigint
  blockNumber: bigint
  executedPrice: number
}

export function App() {
  const [tokenIn, setTokenIn] = useState<TokenInfo>(TOKENS[0])
  const [tokenOut, setTokenOut] = useState<TokenInfo>(TOKENS[2])
  const [amountIn, setAmountIn] = useState('1.0')
  const [slippageTol, setSlippageTol] = useState(0.5)
  const [execState, setExecState] = useState<ExecState>('idle')
  const [result, setResult] = useState<SwapResult | undefined>()
  const [errorMsg, setErrorMsg] = useState('')
  const [activeDropdown, setActiveDropdown] = useState<'in' | 'out' | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!activeDropdown) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [activeDropdown])

  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { sendTransactionAsync } = useSendTransaction()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()

  const poolKey: PoolKey = useMemo(() => buildPoolKey(tokenIn, tokenOut), [tokenIn, tokenOut])
  const poolId = useMemo(() => poolIdFromKey(poolKey), [poolKey])
  const isZfo = useMemo(() => zeroForOne(tokenIn, poolKey), [tokenIn, poolKey])

  const { data: slot0, isLoading: slot0Loading, error: slot0Error } = useReadContract({
    address: STATE_VIEW,
    abi: STATE_VIEW_ABI,
    functionName: 'getSlot0',
    args: [poolId],
  })

  const { data: liquidity } = useReadContract({
    address: STATE_VIEW,
    abi: STATE_VIEW_ABI,
    functionName: 'getLiquidity',
    args: [poolId],
  })

  const currencyIn = useMemo(() => tokenIn.isNative ? '0x0000000000000000000000000000000000000000' as Hex : tokenIn.address, [tokenIn])
  const currencyOut = useMemo(() => tokenOut.isNative ? '0x0000000000000000000000000000000000000000' as Hex : tokenOut.address, [tokenOut])

  const isErc20Token = needsPermit2Approval(tokenIn) && address !== undefined

  const { data: erc20Allowance } = useReadContract({
    address: currencyIn as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [address!, PERMIT2],
    query: { enabled: isErc20Token },
  })

  const { data: permit2Allowance } = useReadContract({
    address: PERMIT2 as `0x${string}`,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: [address!, currencyIn, UNIVERSAL_ROUTER],
    query: { enabled: isErc20Token },
  })

  const sqrtPriceX96 = slot0?.[0]
  const tick = slot0?.[1]
  const poolHasState = sqrtPriceX96 !== undefined && sqrtPriceX96 > 0n
  const price = useMemo(() => (sqrtPriceX96 ? priceFromSqrtPriceX96(sqrtPriceX96) : 0), [sqrtPriceX96])

  const amountInRaw = useMemo(() => {
    const val = parseFloat(amountIn)
    if (isNaN(val) || val <= 0) return 0n
    return BigInt(Math.floor(val * 10 ** tokenIn.decimals))
  }, [amountIn, tokenIn.decimals])

  const quotedOutRaw = useMemo(() => {
    if (!sqrtPriceX96 || amountInRaw === 0n) return 0n
    return estimateOutput(sqrtPriceX96, amountInRaw, tokenIn.decimals, tokenOut.decimals, poolKey.fee)
  }, [sqrtPriceX96, amountInRaw, tokenIn.decimals, tokenOut.decimals, poolKey.fee])

  const amountOutMinRaw = useMemo(() => {
    if (quotedOutRaw === 0n) return 0n
    const factor = 1 - slippageTol / 100
    return BigInt(Math.floor(Number(quotedOutRaw) * factor))
  }, [quotedOutRaw, slippageTol])

  const isErc20Approved = erc20Allowance !== undefined && erc20Allowance >= amountInRaw
  const permit2Amount = permit2Allowance?.[0]
  const permit2Expiration = permit2Allowance?.[1]
  const isPermit2RouterApproved = permit2Amount !== undefined
    && permit2Amount >= BigInt(MaxAllowanceTransferAmount.toString()) / 2n
    && permit2Expiration !== undefined
    && permit2Expiration > Math.floor(Date.now() / 1000)
  const isFullyApproved = tokenIn.isNative || (isErc20Approved && isPermit2RouterApproved)

  const encoding = useMemo(() => {
    if (amountInRaw === 0n || amountOutMinRaw === 0n || !address) return null
    try {
      const deadlineNow = Math.floor(Date.now() / 1000) + 300
      const params: SwapParams = {
        poolKey,
        zeroForOne: isZfo,
        amountIn: amountInRaw,
        amountOutMinimum: amountOutMinRaw,
        hookData: '0x',
        currencyIn,
        currencyOut,
        recipient: address as Hex,
        deadline: deadlineNow,
        isNativeInput: tokenIn.isNative,
      }
      return buildSwapCalldata(params)
    } catch {
      return null
    }
  }, [poolKey, isZfo, amountInRaw, amountOutMinRaw, currencyIn, currencyOut, address, tokenIn.isNative])

  const activeStep = execState === 'approving' ? 0
    : execState === 'signing' ? 0
    : execState === 'sending' ? 2
    : execState === 'confirming' ? 3
    : execState === 'decoding' ? 4
    : execState === 'complete' ? 5 : -1

  const handleApprove = useCallback(async () => {
    if (!address || !publicClient) return
    try {
      setErrorMsg('')

      if (needsPermit2Approval(tokenIn) && !isErc20Approved) {
        setExecState('approving')
        const hash = await writeContractAsync({
          address: tokenIn.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [PERMIT2, BigInt(MaxAllowanceTransferAmount.toString())],
        })
        await publicClient.waitForTransactionReceipt({ hash })
      }

      if (needsPermit2Approval(tokenIn) && !isPermit2RouterApproved) {
        setExecState('approving')
        const hash = await writeContractAsync({
          address: PERMIT2 as `0x${string}`,
          abi: PERMIT2_ABI,
          functionName: 'approve',
          args: [currencyIn, UNIVERSAL_ROUTER, BigInt(MaxAllowanceTransferAmount.toString()), 0xffffffff],
        })
        await publicClient.waitForTransactionReceipt({ hash })
      }

      setExecState('idle')
    } catch (err) {
      setExecState('error')
      setErrorMsg(err instanceof Error ? err.message.slice(0, 200) : 'Approval failed')
    }
  }, [address, tokenIn, isErc20Approved, isPermit2RouterApproved, currencyIn, writeContractAsync, publicClient])

  const handleExecute = useCallback(async () => {
    if (!publicClient || !isConnected || !address) return
    if (amountInRaw === 0n || amountOutMinRaw === 0n) return
    try {
      setExecState('signing')
      setErrorMsg('')

      const freshDeadline = Math.floor(Date.now() / 1000) + 300
      const params: SwapParams = {
        poolKey,
        zeroForOne: isZfo,
        amountIn: amountInRaw,
        amountOutMinimum: amountOutMinRaw,
        hookData: '0x' as Hex,
        currencyIn,
        currencyOut,
        recipient: address as Hex,
        deadline: freshDeadline,
        isNativeInput: tokenIn.isNative,
      }
      const { calldata, value } = buildSwapCalldata(params)

      const hash = await sendTransactionAsync({
        to: UNIVERSAL_ROUTER,
        data: calldata,
        value,
      })

      setExecState('sending')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      setExecState('decoding')

      const swapLogs = parseEventLogs({
        abi: POOL_MANAGER_ABI,
        eventName: 'Swap',
        logs: receipt.logs as Log[],
      })

      if (swapLogs.length > 0) {
        const log = swapLogs[0]
        const amount0 = (log.args as Record<string, unknown>).amount0 as bigint
        const amount1 = (log.args as Record<string, unknown>).amount1 as bigint
        const packedDelta = encodeBalanceDelta({ amount0, amount1 })
        const delta = decodeBalanceDelta(packedDelta)
        const realized = isZfo
          ? (amount1 > 0n ? amount1 : -amount1)
          : (amount0 > 0n ? amount0 : -amount0)
        const slippagePct = quotedOutRaw > 0n
          ? Number((realized - quotedOutRaw) * 10000n / quotedOutRaw) / 100
          : 0
        const realizedTokenInAmt = isZfo
          ? (amount0 < 0n ? -amount0 : amount0)
          : (amount1 < 0n ? -amount1 : amount1)
        const executedPrice = realizedTokenInAmt > 0n
          ? Number(realized) / Number(realizedTokenInAmt) * (10 ** tokenIn.decimals) / (10 ** tokenOut.decimals)
          : 0
        setResult({
          delta, packedDelta, quoted: quotedOutRaw, realized, slippagePct,
          txHash: hash, gasUsed: receipt.gasUsed, blockNumber: receipt.blockNumber, executedPrice,
        })
      } else {
        setResult({
          delta: { amount0: 0n, amount1: 0n }, packedDelta: 0n,
          quoted: quotedOutRaw, realized: 0n, slippagePct: 0,
          txHash: hash, gasUsed: receipt.gasUsed, blockNumber: receipt.blockNumber, executedPrice: 0,
        })
      }
      setExecState('complete')
    } catch (err) {
      setExecState('error')
      setErrorMsg(err instanceof Error ? err.message.slice(0, 300) : 'Transaction failed')
    }
  }, [publicClient, isConnected, address, poolKey, isZfo, amountInRaw, amountOutMinRaw, currencyIn, currencyOut, tokenIn.isNative, tokenIn.decimals, tokenOut.decimals, sendTransactionAsync, quotedOutRaw])

  const selectToken = useCallback((which: 'in' | 'out', token: TokenInfo) => {
    if (which === 'in') {
      if (token.symbol === tokenOut.symbol) setTokenOut(tokenIn)
      setTokenIn(token)
    } else {
      if (token.symbol === tokenIn.symbol) setTokenIn(tokenOut)
      setTokenOut(token)
    }
    setActiveDropdown(null)
  }, [tokenIn, tokenOut])

  const swapDirection = useCallback(() => {
    const temp = tokenIn
    setTokenIn(tokenOut)
    setTokenOut(temp)
  }, [tokenIn, tokenOut])

  const poolStatusText = slot0Loading ? 'Loading pool state...'
    : slot0Error ? 'StateView read failed'
    : poolHasState ? 'Pool found (live StateView)'
    : 'No pool at this key'

  const busy = execState !== 'idle' && execState !== 'complete' && execState !== 'error'

  const approvalLabel = !isErc20Approved
    ? `Approve ${tokenIn.symbol} for Permit2`
    : !isPermit2RouterApproved
      ? `Approve UniversalRouter on Permit2`
      : ''

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <div className="logo-icon">V4</div>
          <span className="logo-text">Uniswap V4 Swap</span>
          <span className="logo-tag">UniversalRouter</span>
        </div>
        <div className="header-actions">
          <span className="header-status">
            <span className={`status-dot ${poolHasState ? 'live' : 'warn'}`} />
            {poolStatusText}
          </span>
          {isConnected ? (
            <button className="btn btn-secondary" onClick={() => disconnect()}>
              {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
            </button>
          ) : (
            <button className="btn btn-connect" onClick={() => connect({ connector: connectors[0] })}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <main className="layout">
        <section className="card swap-section">
          <div className="card-header">
            <span className="card-title">Swap</span>
            <div className="mode-toggle">
              <button className="mode-btn active">Single Pool</button>
            </div>
          </div>

          <div className="token-input">
            <div className="token-input-header">
              <span className="token-input-label">You pay</span>
            </div>
            <div className="token-input-row">
              <input type="number" placeholder="0.0" step="any" min="0" value={amountIn}
                onChange={e => setAmountIn(e.target.value)} />
              <button className="token-select-btn" onClick={() => setActiveDropdown(activeDropdown === 'in' ? null : 'in')}>
                <span className="token-icon" style={{ background: tokenIn.symbol === 'ETH' || tokenIn.symbol === 'WETH' ? '#627EEA' : '#2775CA' }}>
                  {tokenIn.symbol[0]}
                </span>
                {tokenIn.symbol}
                <span className="chevron">&#9662;</span>
              </button>
            </div>
            {activeDropdown === 'in' && (
              <div className="token-dropdown" ref={dropdownRef}>
                {TOKENS.map(t => (
                  <button key={t.symbol} className="token-option" onClick={() => selectToken('in', t)}>
                    <span className="token-icon sm" style={{ background: t.symbol === 'ETH' || t.symbol === 'WETH' ? '#627EEA' : '#2775CA' }}>{t.symbol[0]}</span>
                    <span><b>{t.symbol}</b> <span className="muted">{t.name}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="swap-arrow-wrap">
            <button className="swap-arrow" onClick={swapDirection}>&#8693;</button>
          </div>

          <div className="token-input">
            <div className="token-input-header">
              <span className="token-input-label">You receive (estimated)</span>
            </div>
            <div className="token-input-row">
              <input type="text" readOnly placeholder="0.0"
                value={quotedOutRaw > 0n ? formatTokenAmount(quotedOutRaw, tokenOut.decimals, tokenOut.decimals > 6 ? 6 : 2) : ''} />
              <button className="token-select-btn" onClick={() => setActiveDropdown(activeDropdown === 'out' ? null : 'out')}>
                <span className="token-icon" style={{ background: tokenOut.symbol === 'USDC' || tokenOut.symbol === 'USDT' ? '#2775CA' : '#FC72FF' }}>
                  {tokenOut.symbol[0]}
                </span>
                {tokenOut.symbol}
                <span className="chevron">&#9662;</span>
              </button>
            </div>
            {activeDropdown === 'out' && (
              <div className="token-dropdown" ref={dropdownRef}>
                {TOKENS.map(t => (
                  <button key={t.symbol} className="token-option" onClick={() => selectToken('out', t)}>
                    <span className="token-icon sm" style={{ background: t.symbol === 'USDC' || t.symbol === 'USDT' ? '#2775CA' : '#FC72FF' }}>{t.symbol[0]}</span>
                    <span><b>{t.symbol}</b> <span className="muted">{t.name}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {poolHasState && price > 0 && (
            <div className="info-rows">
              <div className="info-row">
                <span className="info-label">Rate (sqrtPriceX96)</span>
                <span className="info-value">1 {tokenIn.symbol} = {price.toFixed(2)} {tokenOut.symbol}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Pool tick</span>
                <span className="info-value mono">{tick ?? '--'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Pool liquidity</span>
                <span className="info-value mono">{liquidity ? formatTokenAmount(liquidity, 18, 0) : '--'}</span>
              </div>
              <div className="info-row">
                <span className="info-label">amountOutMinimum</span>
                <span className="info-value mono">{amountOutMinRaw > 0n ? formatTokenAmount(amountOutMinRaw, tokenOut.decimals, 2) : '--'} {tokenOut.symbol}</span>
              </div>
            </div>
          )}

          <hr className="divider" />

          <div className="settings-row">
            <span className="settings-label">Slippage</span>
            <div className="slippage-opts">
              {[0.1, 0.5, 1.0].map(v => (
                <button key={v} className={`slip-btn ${slippageTol === v ? 'active' : ''}`} onClick={() => setSlippageTol(v)}>{v}%</button>
              ))}
            </div>
          </div>

          <div className="settings-row">
            <span className="settings-label">Deadline</span>
            <span className="settings-value">300s from submission</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Pool</span>
            <span className="settings-value mono">{formatAddr(poolKey.currency0)} / {formatAddr(poolKey.currency1)}</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Fee / TickSpacing / Hook</span>
            <span className="settings-value mono">{poolKey.fee / 10000}% / {poolKey.tickSpacing} / {formatAddr(poolKey.hooks)}</span>
          </div>

          <div className="settings-row">
            <span className="settings-label">Permit2</span>
            <span className="settings-value mono">{formatAddr(PERMIT2)}</span>
          </div>

          {encoding && (
            <div className="validation-info">
              <span className="info-label">Security validations</span>
              <div className="check-item"><span className="check-ok">&#9679;</span> deadline = now + 300s ({'>'} block.timestamp at execution)</div>
              <div className="check-item"><span className={amountOutMinRaw > 0n ? 'check-ok' : 'check-fail'}>&#9679;</span> amountOutMinimum {'>'} 0 ({amountOutMinRaw > 0n ? `${formatTokenAmount(amountOutMinRaw, tokenOut.decimals, 2)} ${tokenOut.symbol}` : 'unset'})</div>
              <div className="check-item"><span className={amountInRaw > 0n ? 'check-ok' : 'check-fail'}>&#9679;</span> amountIn {'>'} 0</div>
              <div className="check-item"><span className="check-ok">&#9679;</span> sqrtPriceLimitX96: N/A in V4 (amountOutMinimum enforces price floor)</div>
              {isErc20Token && (
                <>
                  <div className="check-item"><span className={isErc20Approved ? 'check-ok' : 'check-fail'}>&#9679;</span> ERC20 {'->'} Permit2 allowance {isErc20Approved ? '(approved)' : '(needed)'}</div>
                  <div className="check-item"><span className={isPermit2RouterApproved ? 'check-ok' : 'check-fail'}>&#9679;</span> Permit2 {'->'} UniversalRouter allowance {isPermit2RouterApproved ? '(approved)' : '(needed)'}</div>
                </>
              )}
            </div>
          )}

          {!isConnected ? (
            <button className="btn btn-primary execute-btn" onClick={() => connect({ connector: connectors[0] })}>
              Connect Wallet to Execute
            </button>
          ) : amountInRaw === 0n ? (
            <button className="btn btn-primary execute-btn" disabled>Enter an amount</button>
          ) : !isFullyApproved ? (
            <button className="btn btn-primary execute-btn" disabled={busy} onClick={handleApprove}>
              {execState === 'approving' ? 'Approving...' : approvalLabel}
            </button>
          ) : (
            <button className="btn btn-primary execute-btn" disabled={busy || !encoding} onClick={handleExecute}>
              {execState === 'idle' || execState === 'complete' || execState === 'error'
                ? 'Execute Swap via UniversalRouter'
                : execState === 'signing' ? 'Waiting for signature...'
                : execState === 'sending' ? 'Sending tx...'
                : execState === 'confirming' ? 'Waiting for confirmation...'
                : 'Decoding result...'}
            </button>
          )}
          {errorMsg && <p className="error-msg">{errorMsg}</p>}
        </section>

        <section className="card encoding-section">
          <div className="card-header">
            <span className="card-title">Command Encoding</span>
            <span className="card-badge">V4_SWAP</span>
          </div>
          <div className="info-rows">
            <div className="info-row">
              <span className="info-label">CommandType</span>
              <span className="info-value mono">0x{CommandType.V4_SWAP.toString(16)} (V4_SWAP)</span>
            </div>
            <div className="info-row">
              <span className="info-label">Action</span>
              <span className="info-value mono">0x0{Actions.SWAP_EXACT_IN_SINGLE} (SWAP_EXACT_IN_SINGLE)</span>
            </div>
            <div className="info-row">
              <span className="info-label">SETTLE_ALL</span>
              <span className="info-value mono">0x0{Actions.SETTLE_ALL} ({formatAddr(currencyIn)})</span>
            </div>
            <div className="info-row">
              <span className="info-label">TAKE_ALL</span>
              <span className="info-value mono">0x0{Actions.TAKE_ALL} ({formatAddr(currencyOut)})</span>
            </div>
            <div className="info-row">
              <span className="info-label">zeroForOne</span>
              <span className="info-value mono">{String(isZfo)}</span>
            </div>
            <div className="info-row">
              <span className="info-label">amountIn (raw)</span>
              <span className="info-value mono">{amountInRaw > 0n ? amountInRaw.toString() : '--'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">amountOutMinimum (raw)</span>
              <span className="info-value mono">{amountOutMinRaw > 0n ? amountOutMinRaw.toString() : '--'}</span>
            </div>
          </div>

          {encoding && (
            <div className="code-block">
              <div className="code-line"><span className="kw">V4Planner</span>.addAction(SWAP_EXACT_IN_SINGLE, [...])</div>
              <div className="code-line"><span className="kw">V4Planner</span>.addAction(SETTLE_ALL, [{formatAddr(currencyIn)}, {amountInRaw.toString()}])</div>
              <div className="code-line"><span className="kw">V4Planner</span>.addAction(TAKE_ALL, [{formatAddr(currencyOut)}, {amountOutMinRaw.toString()}])</div>
              <div className="code-line" style={{ marginTop: '0.5rem' }}><span className="fn">RoutePlanner</span>.addCommand(V4_SWAP, [planner.finalize()])</div>
              <div className="code-line"><span className="fn">SwapRouter</span>.encodePlan(routePlanner, nativeValue, {'{ deadline }'})</div>
              <div className="code-line" style={{ marginTop: '0.5rem' }}><span className="cmt">// Full execute() calldata ({(encoding.calldata.length - 2) / 2} bytes):</span></div>
              <div className="hex-val">{encoding.calldata.slice(0, 130)}...</div>
            </div>
          )}

          <div style={{ marginTop: '1rem' }}>
            <div className="card-header" style={{ marginBottom: '0.5rem' }}>
              <span className="card-title" style={{ fontSize: '0.875rem' }}>ExactInputSingleParams</span>
            </div>
            <div className="param-list">
              <div className="param-indent accent">{'{'}</div>
              <div className="param-indent-2">poolKey: {'{'}</div>
              <div className="param-indent-3">currency0: <span className="t">{formatAddr(poolKey.currency0)}</span></div>
              <div className="param-indent-3">currency1: <span className="t">{formatAddr(poolKey.currency1)}</span></div>
              <div className="param-indent-3">fee: <span className="v">{poolKey.fee}</span></div>
              <div className="param-indent-3">tickSpacing: <span className="v">{poolKey.tickSpacing}</span></div>
              <div className="param-indent-3">hooks: <span className="m">{formatAddr(poolKey.hooks)}</span></div>
              <div className="param-indent-2">{'}'}</div>
              <div className="param-indent-2">zeroForOne: <span className="v">{String(isZfo)}</span></div>
              <div className="param-indent-2">amountIn: <span className="w">{amountInRaw.toString()}</span></div>
              <div className="param-indent-2">amountOutMinimum: <span className="w">{amountOutMinRaw.toString()}</span></div>
              <div className="param-indent-2">hookData: <span className="m">0x</span></div>
              <div className="param-indent accent">{'}'}</div>
            </div>
          </div>
        </section>

        <section className="card flow-section">
          <div className="card-header">
            <span className="card-title">Execution Flow</span>
            <span className={`tag ${execState === 'complete' ? 'tag-green' : activeStep >= 0 ? 'tag-teal' : 'tag-pink'}`}>
              {execState === 'complete' ? 'Complete' : activeStep >= 0 ? 'Running' : 'Idle'}
            </span>
          </div>
          <div className="flow-steps">
            {FLOW_STEPS.map((step, i) => (
              <div key={i} className={`flow-step ${i === activeStep ? 'active' : (activeStep === 5 && execState === 'complete') ? 'complete' : ''}`}>
                <div className="flow-dot">{i + 1}</div>
                <div className="flow-body">
                  <div className="flow-title">{step.title}</div>
                  <div className="flow-desc">{step.desc}</div>
                  {i === 2 && encoding && (
                    <div className="flow-detail">
                      amountIn: {formatTokenAmount(amountInRaw, tokenIn.decimals)} {tokenIn.symbol}
                      {' | '}amountOutMinimum: {amountOutMinRaw > 0n ? formatTokenAmount(amountOutMinRaw, tokenOut.decimals) : '--'} {tokenOut.symbol}
                    </div>
                  )}
                  {i === 4 && result && (
                    <div className="flow-detail">
                      BalanceDelta = ({result.delta.amount0.toString()}, {result.delta.amount1.toString()})
                      {' -> '}decodeBalanceDelta(0x{result.packedDelta.toString(16).slice(0, 16)}...)
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {result && (
          <section className="card results-section">
            <div className="card-header">
              <span className="card-title">Execution Results</span>
              <span className="tag tag-green">Success</span>
            </div>
            <div className="results-grid">
              <div className="result-card">
                <div className="result-label">BalanceDelta</div>
                <div className={`result-value ${result.delta.amount0 < 0n ? 'neg' : 'pos'}`}>
                  {result.delta.amount0 < 0n ? '' : '+'}{formatTokenAmount(result.delta.amount0, tokenIn.decimals)} {tokenIn.symbol}
                </div>
                <div className="result-sub mono">amount0 (raw): {result.delta.amount0.toString()}</div>
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <div className={`result-value ${result.delta.amount1 > 0n ? 'pos' : 'neg'}`}>
                    +{formatTokenAmount(result.delta.amount1, tokenOut.decimals)} {tokenOut.symbol}
                  </div>
                  <div className="result-sub mono">amount1 (raw): {result.delta.amount1.toString()}</div>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <div className="result-sub mono">packed: 0x{result.packedDelta.toString(16).slice(0, 20)}...</div>
                  <div className="result-sub mono">decodeBalanceDelta {'->'} ({result.delta.amount0.toString()}, {result.delta.amount1.toString()})</div>
                </div>
              </div>

              <div className="result-card">
                <div className="result-label">Slippage Analysis</div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div className="sm-label">Quoted Output</div>
                  <div className="result-value">{formatTokenAmount(result.quoted, tokenOut.decimals, 2)} {tokenOut.symbol}</div>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div className="sm-label">Realized Output</div>
                  <div className="result-value pos">{formatTokenAmount(result.realized, tokenOut.decimals, 2)} {tokenOut.symbol}</div>
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <div className="sm-label">Executed Price</div>
                  <div className="result-value">{result.executedPrice > 0 ? `1 ${tokenIn.symbol} = ${result.executedPrice.toFixed(2)} ${tokenOut.symbol}` : '--'}</div>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <div className="sm-label">Realized Slippage</div>
                  <div className={`result-value ${Math.abs(result.slippagePct) > slippageTol ? 'neg' : 'pos'}`}>
                    {result.slippagePct.toFixed(4)}%
                  </div>
                </div>
              </div>

              <div className="result-card">
                <div className="result-label">Transaction</div>
                <div className="info-row">
                  <span className="info-label">Hash</span>
                  <span className="info-value mono teal">{result.txHash.slice(0, 10)}...{result.txHash.slice(-6)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Gas Used</span>
                  <span className="info-value mono">{Number(result.gasUsed).toLocaleString()}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Block</span>
                  <span className="info-value mono">{Number(result.blockNumber).toLocaleString()}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Pool Fee</span>
                  <span className="info-value mono">{poolKey.fee / 10000}%</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Permit2</span>
                  <span className="info-value mono">{formatAddr(PERMIT2)}</span>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
