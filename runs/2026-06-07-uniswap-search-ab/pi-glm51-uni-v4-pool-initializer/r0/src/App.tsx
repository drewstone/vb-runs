import { useState, useCallback, useMemo } from "react";
import type { FormEvent } from "react";
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { type Address, type Hash } from "viem";
import {
  sqrtPriceX96ToPrice,
  priceToSqrtPriceX96,
  computePoolId,
  POOL_MANAGER_ABI,
  POOL_MANAGER_ADDRESS,
  TOKEN_PRESETS,
  FEE_TIERS,
  TICK_SPACINGS,
} from "./lib/v4";

// ── Types ──────────────────────────────────────────────────────────────
interface TokenState {
  address: string;
  symbol: string;
  decimals: number;
}

interface WizardState {
  token0: TokenState;
  token1: TokenState;
  fee: number;
  tickSpacing: number;
  hooks: string;
  sqrtPriceX96: string;
}

const DEFAULT_STATE: WizardState = {
  token0: {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    symbol: "ETH",
    decimals: 18,
  },
  token1: {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
  },
  fee: 3000,
  tickSpacing: 60,
  hooks: "0x0000000000000000000000000000000000000000",
  sqrtPriceX96: "79228162514264337593543950336",
};

const STEPS = ["Tokens", "Parameters", "Price", "Initialize"] as const;
const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

// ── Address validation ─────────────────────────────────────────────────
const isValidAddress = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v);

// ── Sorted (lower address first) ──────────────────────────────────────
function sortedPair(s: WizardState) {
  const c0 = s.token0.address.toLowerCase();
  const c1 = s.token1.address.toLowerCase();
  if (c0 <= c1) return { c0: s.token0, c1: s.token1 };
  return { c0: s.token1, c1: s.token0 };
}

// ── App ────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState(0);
  const [s, setS] = useState<WizardState>(DEFAULT_STATE);
  const [txHash, setTxHash] = useState<Hash | undefined>(undefined);

  // wagmi hooks — real wallet + contract interaction
  const { address: connectedAddress, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContractAsync, isPending: isWritePending } = useWriteContract();

  // Wait for tx receipt after submission
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({ hash: txHash });

  const update = useCallback(
    <K extends keyof WizardState>(key: K, val: WizardState[K]) =>
      setS((prev) => ({ ...prev, [key]: val })),
    []
  );

  const updateToken = useCallback(
    (idx: 0 | 1, field: keyof TokenState, val: string | number) =>
      setS((prev) => {
        const key = idx === 0 ? "token0" : "token1";
        return { ...prev, [key]: { ...prev[key], [field]: val } };
      }),
    []
  );

  // Price derived from sqrtPriceX96
  const humanPrice = useMemo(() => {
    try {
      return sqrtPriceX96ToPrice(
        BigInt(s.sqrtPriceX96 || "0"),
        s.token0.decimals,
        s.token1.decimals
      );
    } catch {
      return "";
    }
  }, [s.sqrtPriceX96, s.token0.decimals, s.token1.decimals]);

  // Sorted pair for review / poolId
  const sorted = useMemo(() => sortedPair(s), [s]);

  // PoolId — uses viem's keccak256 + encodeAbiParameters (no hand-rolled crypto)
  const poolId = useMemo(() => {
    try {
      if (!isValidAddress(sorted.c0.address) || !isValidAddress(sorted.c1.address))
        return "";
      const hooksAddr = isValidAddress(s.hooks) ? s.hooks : ZERO_ADDR;
      return computePoolId(
        sorted.c0.address as Address,
        sorted.c1.address as Address,
        s.fee,
        s.tickSpacing,
        hooksAddr as Address
      );
    } catch {
      return "";
    }
  }, [sorted, s.fee, s.tickSpacing, s.hooks]);

  // Validate current step
  const canContinue = (): boolean => {
    if (step === 0) {
      return (
        isValidAddress(s.token0.address) &&
        isValidAddress(s.token1.address) &&
        s.token0.address.toLowerCase() !== s.token1.address.toLowerCase()
      );
    }
    if (step === 1) {
      return s.hooks === "" || isValidAddress(s.hooks);
    }
    if (step === 2) {
      return /^\d+$/.test(s.sqrtPriceX96) && s.sqrtPriceX96 !== "0";
    }
    return true;
  };

  // Real PoolManager.initialize call via wagmi writeContract
  const handleInitialize = useCallback(async () => {
    if (!isConnected) return;

    const sortedData = sortedPair(s);
    const hooksAddr = isValidAddress(s.hooks) ? (s.hooks as Address) : (ZERO_ADDR as Address);
    const sqrtPrice = BigInt(s.sqrtPriceX96);

    // Build the PoolKey tuple matching the contract struct
    const poolKey = {
      currency0: sortedData.c0.address as Address,
      currency1: sortedData.c1.address as Address,
      fee: s.fee,
      tickSpacing: s.tickSpacing,
      hooks: hooksAddr,
    };

    try {
      const hash = await writeContractAsync({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: "initialize",
        args: [poolKey, sqrtPrice],
      });
      setTxHash(hash);
    } catch (err) {
      console.error("PoolManager.initialize failed:", err);
    }
  }, [s, isConnected, writeContractAsync]);

  const handleNext = (e: FormEvent) => {
    e.preventDefault();
    if (step === 3) {
      handleInitialize();
      return;
    }
    setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const swapTokens = () => {
    setS((prev) => ({
      ...prev,
      token0: prev.token1,
      token1: prev.token0,
    }));
  };

  const feePct = (fee: number) =>
    `${(fee / 10000).toFixed(fee % 100 === 0 ? (fee === 0 ? 0 : 2) : 4)}%`;

  const isTokenOrderCorrect =
    s.token0.address.toLowerCase() <= s.token1.address.toLowerCase();

  // Truncate address for display
  const truncAddr = (addr: string) =>
    `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">V4</div>
            <span className="logo-text">Uniswap V4</span>
            <span className="logo-badge">Pool Initializer</span>
          </div>
          <div className="header-actions">
            {isConnected && connectedAddress ? (
              <button
                className="wallet-btn connected"
                onClick={() => disconnect()}
                title="Disconnect wallet"
              >
                <span className="wallet-dot" />
                {truncAddr(connectedAddress)}
              </button>
            ) : (
              <button
                className="wallet-btn"
                onClick={() => connect({ connector: connectors[0]! })}
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="main-content">
        <form className="wizard-card" onSubmit={handleNext}>
          {/* Progress */}
          <div className="wizard-progress">
            {STEPS.map((label, i) => (
              <div key={label} style={{ display: "contents" }}>
                <div
                  className={`progress-step${i === step ? " active" : ""}${i < step ? " completed" : ""}`}
                >
                  <div className="step-dot">{i < step ? "✓" : i + 1}</div>
                  <span className="step-label">{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`progress-line${i < step ? " filled" : ""}`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 0: Token Selection */}
          {step === 0 && (
            <div className="wizard-step">
              <h2 className="step-title">Select Token Pair</h2>
              <p className="step-desc">
                Choose the two currencies for your V4 pool. On-chain, the token
                with the lower address becomes <code>currency0</code>.
              </p>
              <div className="token-pair">
                <TokenField
                  label="Token 0"
                  token={s.token0}
                  idx={0}
                  onChange={updateToken}
                />
                <button
                  type="button"
                  className="swap-tokens-btn"
                  onClick={swapTokens}
                  title="Swap tokens"
                >
                  ⇅
                </button>
                <TokenField
                  label="Token 1"
                  token={s.token1}
                  idx={1}
                  onChange={updateToken}
                />
              </div>
              {isValidAddress(s.token0.address) &&
                isValidAddress(s.token1.address) && (
                  <p
                    className={`field-hint ${isTokenOrderCorrect ? "ok" : "warn"}`}
                    style={{ marginTop: "0.75rem" }}
                  >
                    {isTokenOrderCorrect
                      ? "✓ Token order correct — currency0 < currency1"
                      : `⚠️ Addresses will be auto-sorted on-chain: ${s.token1.symbol} (${truncAddr(s.token1.address)}) should be currency0`}
                  </p>
                )}
            </div>
          )}

          {/* Step 1: Parameters */}
          {step === 1 && (
            <div className="wizard-step">
              <h2 className="step-title">Pool Parameters</h2>
              <p className="step-desc">
                Set the fee tier, tick spacing, and optional hooks contract. Fee
                and tick spacing must match the values the PoolManager expects.
              </p>
              <div className="param-grid">
                <div className="param-field">
                  <span className="field-label">Fee Tier</span>
                  <div className="preset-row">
                    {FEE_TIERS.map((t) => (
                      <button
                        type="button"
                        key={t.fee}
                        className={`preset-btn${s.fee === t.fee ? " active" : ""}`}
                        onClick={() => {
                          update("fee", t.fee);
                          update("tickSpacing", t.tickSpacing);
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="token-meta-row">
                    <div className="token-meta-field">
                      <span className="field-label-sm">Fee (hundredths of bip)</span>
                      <input
                        className="text-input-sm mono"
                        type="number"
                        min={0}
                        value={s.fee}
                        onChange={(e) => update("fee", Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                <div className="param-field">
                  <span className="field-label">Tick Spacing</span>
                  <div className="preset-row">
                    {TICK_SPACINGS.map((t) => (
                      <button
                        type="button"
                        key={t}
                        className={`preset-btn${s.tickSpacing === t ? " active" : ""}`}
                        onClick={() => update("tickSpacing", t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="token-meta-row">
                    <div className="token-meta-field">
                      <span className="field-label-sm">Custom</span>
                      <input
                        className="text-input-sm mono"
                        type="number"
                        min={-16384}
                        max={16384}
                        value={s.tickSpacing}
                        onChange={(e) =>
                          update("tickSpacing", Number(e.target.value))
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="param-field full-width">
                  <span className="field-label">Hooks Contract</span>
                  <div className="input-with-action">
                    <input
                      className="text-input mono"
                      type="text"
                      placeholder="0x0000…0000 (no hooks)"
                      value={s.hooks}
                      spellCheck={false}
                      autoComplete="off"
                      onChange={(e) => update("hooks", e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn-ghost"
                      title="Reset to zero address"
                      onClick={() => update("hooks", ZERO_ADDR)}
                    >
                      ✕
                    </button>
                  </div>
                  <p className="field-hint">
                    Set to the zero address if the pool has no hooks.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Price */}
          {step === 2 && (
            <div className="wizard-step">
              <h2 className="step-title">Initial Price</h2>
              <p className="step-desc">
                Set the starting price as{" "}
                <code>
                  {s.token1.symbol} per {s.token0.symbol}
                </code>
                . The default sqrtPriceX96 = 2⁹⁶ represents a 1:1 ratio.
              </p>
              <div className="price-section">
                <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                  <span className="field-label">sqrtPriceX96</span>
                  <input
                    className="text-input mono"
                    type="text"
                    value={s.sqrtPriceX96}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(e) => update("sqrtPriceX96", e.target.value.replace(/\D/g, ""))}
                  />
                  <p className="field-hint">
                    2⁹⁶ = 79228162514264337593543950336 — represents 1:1 price
                  </p>
                </div>
                <div className="price-converter">
                  <div className="converter-field">
                    <span className="field-label-sm">sqrtPriceX96</span>
                    <input
                      className="text-input-sm mono"
                      type="text"
                      value={s.sqrtPriceX96}
                      onChange={(e) =>
                        update(
                          "sqrtPriceX96",
                          e.target.value.replace(/\D/g, "")
                        )
                      }
                    />
                  </div>
                  <div className="converter-arrow">↔</div>
                  <div className="converter-field">
                    <span className="field-label-sm">
                      Price ({s.token1.symbol}/{s.token0.symbol})
                    </span>
                    <input
                      className="text-input-sm"
                      type="text"
                      value={humanPrice}
                      onChange={(e) => {
                        try {
                          const sp = priceToSqrtPriceX96(
                            e.target.value,
                            s.token0.decimals,
                            s.token1.decimals
                          );
                          update("sqrtPriceX96", sp.toString());
                        } catch {
                          /* invalid input, ignore */
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="quick-prices">
                  <span className="quick-label">Quick set:</span>
                  {[0.5, 1, 100, 1000, 5000].map((p) => (
                    <button
                      type="button"
                      key={p}
                      className="quick-btn"
                      onClick={() => {
                        try {
                          const sp = priceToSqrtPriceX96(
                            p.toString(),
                            s.token0.decimals,
                            s.token1.decimals
                          );
                          update("sqrtPriceX96", sp.toString());
                        } catch {
                          /* */
                        }
                      }}
                    >
                      {p.toLocaleString()}
                    </button>
                  ))}
                </div>
                {humanPrice && (
                  <p className="field-hint ok">
                    1 {s.token0.symbol} = {humanPrice} {s.token1.symbol}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Review & Initialize */}
          {step === 3 && (
            <div className="wizard-step">
              <h2 className="step-title">Review &amp; Initialize</h2>
              <p className="step-desc">
                Confirm pool parameters then call{" "}
                <code>PoolManager.initialize(PoolKey, sqrtPriceX96)</code> on-chain.
                PoolId = <code>keccak256(abi.encode(PoolKey))</code>.
              </p>

              {!isConnected && (
                <div className="connect-prompt">
                  <p>Connect your wallet to initialize a pool on Sepolia.</p>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => connect({ connector: connectors[0]! })}
                  >
                    Connect Wallet
                  </button>
                </div>
              )}

              <div className="review-card">
                <h3 className="review-heading">PoolKey</h3>
                <div className="review-row">
                  <span className="review-label">currency0</span>
                  <span className="review-value">{sorted.c0.address}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">currency1</span>
                  <span className="review-value">{sorted.c1.address}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">fee</span>
                  <span className="review-value">
                    {s.fee} ({feePct(s.fee)})
                  </span>
                </div>
                <div className="review-row">
                  <span className="review-label">tickSpacing</span>
                  <span className="review-value">{s.tickSpacing}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">hooks</span>
                  <span className="review-value">{s.hooks}</span>
                </div>
              </div>

              <div className="review-card">
                <h3 className="review-heading">Initialization</h3>
                <div className="review-row">
                  <span className="review-label">sqrtPriceX96</span>
                  <span className="review-value">{s.sqrtPriceX96}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">price</span>
                  <span className="review-value">
                    1 {sorted.c0.symbol} = {humanPrice} {sorted.c1.symbol}
                  </span>
                </div>
                <div className="review-row">
                  <span className="review-label">PoolManager</span>
                  <span className="review-value">{POOL_MANAGER_ADDRESS}</span>
                </div>
              </div>

              {poolId && (
                <div className="poolid-card">
                  <span className="poolid-label">Pool ID</span>
                  <span className="poolid-value">{poolId}</span>
                  <button
                    type="button"
                    className="btn-copy"
                    title="Copy Pool ID"
                    onClick={() => navigator.clipboard.writeText(poolId).catch(() => {})}
                  >
                    <CopyIcon />
                  </button>
                </div>
              )}

              {txHash && (
                <div className="tx-hash-card">
                  <span className="review-label">TX Hash</span>
                  <span className="review-value">{txHash}</span>
                </div>
              )}

              {isConfirming && (
                <div className="tx-pending">
                  <span className="spinner" />
                  Waiting for confirmation…
                </div>
              )}

              {isConfirmed && (
                <div className="tx-success">
                  <CheckIcon /> Pool initialized successfully
                </div>
              )}

              {isWritePending && (
                <div className="tx-pending">
                  <span className="spinner" />
                  Waiting for wallet signature…
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="wizard-nav">
            <button
              type="button"
              className="btn-secondary"
              onClick={handlePrev}
              style={{ visibility: step === 0 ? "hidden" : "visible" }}
            >
              ← Back
            </button>
            <div className="nav-spacer" />
            <button
              type="submit"
              className="btn-primary"
              disabled={!canContinue() || isWritePending || isConfirming}
            >
              {step === 3
                ? isConfirmed
                  ? "Initialized ✓"
                  : isConfirming
                    ? "Confirming…"
                    : isWritePending
                      ? "Signing…"
                      : "Initialize Pool"
                : "Continue →"}
            </button>
          </div>
        </form>

        {/* Calculator */}
        <PriceCalculator
          decimals0={s.token0.decimals}
          decimals1={s.token1.decimals}
          symbol0={s.token0.symbol}
          symbol1={s.token1.symbol}
        />
      </main>

      <footer className="app-footer">
        <span>Uniswap V4 Pool Initializer</span>
        <span className="footer-sep">·</span>
        <span>PoolManager: {truncAddr(POOL_MANAGER_ADDRESS)} · Sepolia</span>
      </footer>
    </div>
  );
}

// ── Token Field Component ──────────────────────────────────────────────
function TokenField({
  label,
  token,
  idx,
  onChange,
}: {
  label: string;
  token: TokenState;
  idx: 0 | 1;
  onChange: (idx: 0 | 1, field: keyof TokenState, val: string | number) => void;
}) {
  return (
    <div className="token-card">
      <div className="token-header">
        <span className="token-number">{label}</span>
      </div>
      <div className="input-with-select">
        <select
          className="token-preset-select"
          value=""
          onChange={(e) => {
            const preset = TOKEN_PRESETS.find(
              (p) => p.address === e.target.value
            );
            if (preset) {
              onChange(idx, "address", preset.address);
              onChange(idx, "symbol", preset.symbol);
              onChange(idx, "decimals", preset.decimals);
            }
          }}
        >
          <option value="">Preset…</option>
          {TOKEN_PRESETS.map((p) => (
            <option key={p.address} value={p.address}>
              {p.symbol} — {p.name}
            </option>
          ))}
        </select>
        <input
          className="text-input mono"
          type="text"
          placeholder="0x…"
          value={token.address}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChange(idx, "address", e.target.value)}
        />
      </div>
      <div className="token-meta-row">
        <div className="token-meta-field">
          <span className="field-label-sm">Symbol</span>
          <input
            className="text-input-sm"
            type="text"
            value={token.symbol}
            onChange={(e) => onChange(idx, "symbol", e.target.value)}
          />
        </div>
        <div className="token-meta-field">
          <span className="field-label-sm">Decimals</span>
          <input
            className="text-input-sm"
            type="number"
            min={0}
            max={18}
            value={token.decimals}
            onChange={(e) =>
              onChange(idx, "decimals", Number(e.target.value))
            }
          />
        </div>
      </div>
    </div>
  );
}

// ── Standalone Price Calculator ─────────────────────────────────────────
function PriceCalculator({
  decimals0,
  decimals1,
  symbol0,
  symbol1,
}: {
  decimals0: number;
  decimals1: number;
  symbol0: string;
  symbol1: string;
}) {
  const [calcSqrt, setCalcSqrt] = useState("79228162514264337593543950336");
  const [calcPrice, setCalcPrice] = useState("1");
  const [result, setResult] = useState(`1 ${symbol0} = 1 ${symbol1}`);

  const handleSqrtChange = (val: string) => {
    setCalcSqrt(val);
    try {
      const price = sqrtPriceX96ToPrice(BigInt(val || "0"), decimals0, decimals1);
      setCalcPrice(price);
      setResult(`1 ${symbol0} = ${price} ${symbol1}`);
    } catch {
      setResult("—");
    }
  };

  const handlePriceChange = (val: string) => {
    setCalcPrice(val);
    try {
      const sp = priceToSqrtPriceX96(val, decimals0, decimals1);
      setCalcSqrt(sp.toString());
      setResult(`sqrtPriceX96 = ${sp.toString()}`);
    } catch {
      setResult("—");
    }
  };

  return (
    <div className="calc-card">
      <h3 className="calc-title">
        <CalculatorIcon /> Price Calculator
      </h3>
      <p className="calc-desc">
        Convert between sqrtPriceX96 and human-readable price. Uses the token
        decimals from the wizard above.
      </p>
      <div className="calc-grid">
        <div className="calc-field">
          <span className="field-label">sqrtPriceX96</span>
          <input
            className="text-input mono"
            type="text"
            value={calcSqrt}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => handleSqrtChange(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="calc-arrow">→</div>
        <div className="calc-field">
          <span className="field-label">
            Price ({symbol1}/{symbol0})
          </span>
          <input
            className="text-input"
            type="text"
            value={calcPrice}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => handlePriceChange(e.target.value)}
          />
        </div>
      </div>
      <div className="calc-info">
        <span>
          price = (sqrtPriceX96 / 2<sup>96</sup>)<sup>2</sup> × 10
          <sup>(decimals0 − decimals1)</sup>
        </span>
        <span className="calc-result">{result}</span>
      </div>
    </div>
  );
}

// ── SVG Icons ──────────────────────────────────────────────────────────
function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function CalculatorIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 10h8M8 14h4M8 18h2" />
    </svg>
  );
}
