import { useState, useCallback, useEffect, useRef } from "react";
import { Pool } from "@uniswap/v4-sdk";
import { Token, type Currency } from "@uniswap/sdk-core";
import type { TokenInfo, SwapQuote } from "./types";
import { TOKENS, FEE_TIERS, DEFAULT_FEE, CHAIN_ID } from "./constants";
import { TokenSelect } from "./components/TokenSelect";
import { SwapQuotePreview, SwapQuoteEmpty, SwapQuoteLoading } from "./components/SwapQuotePreview";
import { usePoolData } from "./hooks/usePoolData";
import { computeSwapQuote } from "./hooks/useSwapQuote";

/** Helper: create an SDK Currency from a TokenInfo */
function toCurrency(token: TokenInfo): Currency {
  const addr =
    token.symbol === "ETH" && token.wrappedAddress
      ? token.wrappedAddress
      : token.address;
  return new Token(CHAIN_ID, addr, token.decimals, token.symbol, token.name);
}

export default function App() {
  const [tokenIn, setTokenIn] = useState<TokenInfo | null>(TOKENS[0]);
  const [tokenOut, setTokenOut] = useState<TokenInfo | null>(TOKENS[1]);
  const [amount, setAmount] = useState("");
  const [feeTier, setFeeTier] = useState<number>(DEFAULT_FEE);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const { poolState, loading: poolLoading, error: poolError, fetchPool } = usePoolData();
  const quoteAbortRef = useRef<AbortController | null>(null);

  // Fetch pool data when tokens or fee tier change
  useEffect(() => {
    if (tokenIn && tokenOut && tokenIn.address !== tokenOut.address) {
      fetchPool(tokenIn, tokenOut, feeTier);
    }
  }, [tokenIn, tokenOut, feeTier, fetchPool]);

  // Compute quote when pool data or amount changes — async using real SDK
  useEffect(() => {
    if (!poolState || !tokenIn || !tokenOut || !amount || parseFloat(amount) <= 0) {
      if (!amount || parseFloat(amount) <= 0) setQuote(null);
      return;
    }

    // Cancel any in-flight quote
    quoteAbortRef.current?.abort();
    const controller = new AbortController();
    quoteAbortRef.current = controller;

    setQuoteLoading(true);

    // Debounce to avoid re-computing on every keystroke
    const timer = setTimeout(async () => {
      try {
        const result = await computeSwapQuote(
          poolState,
          tokenIn,
          tokenOut,
          amount,
        );
        if (!controller.signal.aborted) {
          setQuote(result);
        }
      } catch {
        if (!controller.signal.aborted) {
          setQuote(null);
        }
      } finally {
        if (!controller.signal.aborted) {
          setQuoteLoading(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [poolState, tokenIn, tokenOut, amount]);

  const handleSwapTokens = useCallback(() => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
  }, [tokenIn, tokenOut]);

  const handleConnect = useCallback(() => {
    setIsConnected(true);
  }, []);

  const quoteLoadingOrPoolLoading = quoteLoading || poolLoading;

  return (
    <div className="app">
      <div className="app__bg" />
      <header className="header">
        <div className="header__inner">
          <div className="header__brand">
            <svg className="header__logo" width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L2 14l12 12 12-12L14 2z" fill="url(#logo-gradient)" />
              <path d="M14 6L6 14l8 8 8-8-8-8z" fill="currentColor" opacity="0.15" />
              <defs>
                <linearGradient id="logo-gradient" x1="2" y1="2" x2="26" y2="26">
                  <stop stopColor="#FC72FF" />
                  <stop offset="1" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
            </svg>
            <span className="header__title">Uniswap V4</span>
            <span className="header__subtitle">Quote Preview</span>
          </div>
          <nav className="header__nav">
            <button
              className={`header__connect-btn ${isConnected ? "header__connect-btn--connected" : ""}`}
              onClick={handleConnect}
              type="button"
            >
              {isConnected ? (
                <>
                  <span className="header__dot" />
                  0x742d...44a5
                </>
              ) : (
                "Connect Wallet"
              )}
            </button>
          </nav>
        </div>
      </header>

      <main className="main">
        <div className="swap-card">
          <div className="swap-card__header">
            <h2 className="swap-card__title">Swap</h2>
            <div className="swap-card__settings">
              <button className="swap-card__settings-btn" type="button" title="Settings">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          {/* Fee tier selector */}
          <div className="swap-card__fee-tiers">
            <span className="swap-card__fee-label">Fee Tier</span>
            <div className="swap-card__fee-options">
              {FEE_TIERS.map((ft) => (
                <button
                  key={ft.value}
                  className={`swap-card__fee-option ${feeTier === ft.value ? "swap-card__fee-option--active" : ""}`}
                  onClick={() => setFeeTier(ft.value)}
                  type="button"
                  title={ft.description}
                >
                  {ft.label}
                </button>
              ))}
            </div>
          </div>

          {/* You Pay */}
          <div className="swap-card__input-section">
            <div className="swap-card__section-row">
              <TokenSelect label="You Pay" selected={tokenIn} onSelect={setTokenIn} />
            </div>
            <div className="swap-card__amount-row">
              <input
                type="text"
                className="swap-card__amount-input"
                placeholder="0.0"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, "");
                  const parts = val.split(".");
                  const sanitized = parts.length > 2 ? parts[0] + "." + parts.slice(1).join("") : val;
                  setAmount(sanitized);
                }}
                inputMode="decimal"
                autoComplete="off"
              />
              <button className="swap-card__max-btn" type="button">MAX</button>
            </div>
          </div>

          {/* Swap direction */}
          <div className="swap-card__swap-direction">
            <button className="swap-card__swap-btn" onClick={handleSwapTokens} type="button" aria-label="Swap token direction">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7 4l-3 3h2v6H4l3 3 3-3H9V7h2L7 4z" fill="currentColor" />
                <path d="M13 4l-3 3h2v6h-2l3 3 3-3h-2V7h2l-3-3z" fill="currentColor" opacity="0.4" />
              </svg>
            </button>
          </div>

          {/* You Receive */}
          <div className="swap-card__input-section">
            <div className="swap-card__section-row">
              <TokenSelect label="You Receive" selected={tokenOut} onSelect={setTokenOut} />
            </div>
            <div className="swap-card__amount-row">
              <div className="swap-card__amount-display">
                {quote ? quote.amountOutFormatted : "0.0"}
              </div>
            </div>
          </div>

          {/* Pool status */}
          {poolError && (
            <div className="swap-card__pool-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.25" />
                <path d="M8 5v3.5M8 11v.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
              </svg>
              <span>Contract read unavailable. Pool constructed from PoolKey — quoting via SDK math.</span>
            </div>
          )}

          {/* Quote preview */}
          <div className="swap-card__quote">
            {quoteLoadingOrPoolLoading ? (
              <SwapQuoteLoading />
            ) : quote ? (
              <SwapQuotePreview quote={quote} tokenOut={tokenOut} />
            ) : (
              <SwapQuoteEmpty />
            )}
          </div>

          {/* Swap button */}
          <button
            className={`swap-card__action-btn ${!amount || parseFloat(amount) <= 0 || !tokenIn || !tokenOut || tokenIn.address === tokenOut.address ? "swap-card__action-btn--disabled" : ""}`}
            disabled={!amount || parseFloat(amount) <= 0 || !tokenIn || !tokenOut || tokenIn.address === tokenOut.address}
            type="button"
          >
            {!isConnected
              ? "Connect Wallet to Swap"
              : !amount || parseFloat(amount) <= 0
                ? "Enter an Amount"
                : !quote
                  ? "Fetching Quote..."
                  : "Review Swap"}
          </button>
        </div>

        {/* Pool info sidebar */}
        <aside className="pool-info">
          <h3 className="pool-info__title">Pool State</h3>
          {poolState ? (
            <div className="pool-info__grid">
              <div className="pool-info__item">
                <span className="pool-info__label">sqrtPriceX96</span>
                <span className="pool-info__value pool-info__value--mono">
                  {poolState.sqrtPriceX96.toString().slice(0, 16)}...
                </span>
              </div>
              <div className="pool-info__item">
                <span className="pool-info__label">Liquidity</span>
                <span className="pool-info__value pool-info__value--mono">
                  {poolState.liquidity.toString().slice(0, 12)}...
                </span>
              </div>
              <div className="pool-info__item">
                <span className="pool-info__label">Tick</span>
                <span className="pool-info__value">{poolState.tick}</span>
              </div>
              <div className="pool-info__item">
                <span className="pool-info__label">Fee</span>
                <span className="pool-info__value">{(poolState.fee / 10000).toFixed(2)}%</span>
              </div>
              <div className="pool-info__item">
                <span className="pool-info__label">Pool ID</span>
                <span className="pool-info__value pool-info__value--mono">
                  {Pool.getPoolId(
                    toCurrency(poolState.token0Info),
                    toCurrency(poolState.token1Info),
                    poolState.poolKey.fee,
                    poolState.poolKey.tickSpacing,
                    poolState.poolKey.hooks,
                  ).slice(0, 16)}...
                </span>
              </div>
            </div>
          ) : (
            <p className="pool-info__empty">Select tokens to load pool state</p>
          )}

          <h3 className="pool-info__title">SDK Integration</h3>
          <ol className="pool-info__steps">
            <li><code>Pool.getPoolId()</code> computes poolId from PoolKey</li>
            <li><code>PoolManager.slot0()</code> reads sqrtPriceX96 + tick via viem</li>
            <li><code>PoolManager.liquidity()</code> reads pool liquidity</li>
            <li>SDK <code>Pool</code> constructed with on-chain state</li>
            <li><code>Pool.getOutputAmount()</code> routes through SwapMath / SqrtPriceMath</li>
          </ol>
        </aside>
      </main>

      <footer className="footer">
        <p className="footer__text">
          Powered by @uniswap/v4-sdk + viem — real on-chain pool state via PoolManager
        </p>
      </footer>
    </div>
  );
}
