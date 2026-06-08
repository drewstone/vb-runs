import { useAccount } from "wagmi";
import { type FC, useState, useEffect } from "react";
import { useSwap } from "../hooks/useSwap";
import TokenInput from "./TokenInput";
import SlippageSettings from "./SlippageSettings";
import SwapPath from "./SwapPath";
import BalanceDeltaDisplay from "./BalanceDeltaDisplay";
import TransactionHistory from "./TransactionHistory";

const SwapCard: FC = () => {
  const { isConnected } = useAccount();

  const [tokenIn, setTokenIn] = useState("ETH");
  const [tokenOut, setTokenOut] = useState("USDC");
  const [amountIn, setAmountIn] = useState("");
  const [slippageBps, setSlippageBps] = useState(50n);

  const {
    error,
    isSwapping,
    txHash,
    isConfirmed,
    receiptData,
    quote,
    balanceDelta,
    executedPrice,
    realizedSlippage,
    txHistory,
    computeQuote,
    executeSwap,
    clearResult,
  } = useSwap();

  useEffect(() => {
    if (amountIn && tokenIn && tokenOut) {
      const id = setTimeout(() => computeQuote(tokenIn, tokenOut, amountIn), 300);
      return () => clearTimeout(id);
    }
  }, [amountIn, tokenIn, tokenOut, computeQuote]);

  const handleSwap = async () => {
    if (!tokenIn || !tokenOut || !amountIn) return;
    clearResult();
    await executeSwap(tokenIn, tokenOut, amountIn, slippageBps);
  };

  const swapDisabled = !isConnected || !amountIn || isSwapping || parseFloat(amountIn) <= 0;

  return (
    <div className="swap-container">
      <div className="swap-header">
        <div className="swap-header-top">
          <div className="swap-title-group">
            <div className="swap-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span>V4 Swap</span>
            </div>
            <span className="swap-badge">UniversalRouter</span>
          </div>
          <SlippageSettings slippageBps={slippageBps} onChange={setSlippageBps} />
        </div>
      </div>

      <div className="swap-inputs">
        <TokenInput
          token={tokenIn}
          amount={amountIn}
          onAmountChange={setAmountIn}
          onTokenChange={(t) => { setTokenIn(t); if (t === tokenOut) setTokenOut(tokenIn); }}
          label="You pay"
        />
        <div className="swap-arrow-wrap">
          <button
            className="swap-arrow-btn"
            onClick={() => { const t = tokenIn; setTokenIn(tokenOut); setTokenOut(t); clearResult(); }}
            type="button"
            title="Reverse tokens"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </button>
        </div>
        <TokenInput
          token={tokenOut}
          amount={quote ? (Number(quote.amountOut) / 1e18).toFixed(6) : ""}
          onAmountChange={() => {}}
          onTokenChange={(t) => { setTokenOut(t); if (t === tokenIn) setTokenIn(tokenOut); }}
          label="You receive"
          showBalance={false}
          disabled
        />
      </div>

      {quote && (
        <div className="quote-info">
          <div className="quote-row">
            <span>Expected output</span>
            <span>{(Number(quote.amountOut) / 1e18).toFixed(6)} {tokenOut}</span>
          </div>
          <div className="quote-row">
            <span>Minimum received ({(Number(slippageBps) / 100).toFixed(1)}% slippage)</span>
            <span>{(Number(quote.amountOutMinimum) / 1e18).toFixed(6)} {tokenOut}</span>
          </div>
          <div className="quote-row">
            <span>Price impact</span>
            <span className={quote.priceImpact > 1 ? "text-warning" : ""}>
              {quote.priceImpact.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      <SwapPath poolKeys={[]} route="single" tokenIn={tokenIn} tokenOut={tokenOut} />

      {error && (
        <div className="swap-error">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}

      {balanceDelta && (
        <BalanceDeltaDisplay
          delta={balanceDelta}
          executedPrice={executedPrice}
          realizedSlippage={realizedSlippage}
          tokenIn={tokenIn}
          tokenOut={tokenOut}
          isConfirmed={isConfirmed}
          receiptData={receiptData}
        />
      )}

      <button
        className={`swap-action-btn ${isSwapping ? "swapping" : ""}`}
        onClick={handleSwap}
        disabled={swapDisabled}
        type="button"
      >
        {!isConnected ? "Connect Wallet to Swap" : isSwapping ? "Swapping..." : txHash ? "Swap Again" : "Swap"}
      </button>

      {txHash && (
        <div className="tx-hash-link">
          <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
            View on Etherscan ↗
          </a>
        </div>
      )}

      <TransactionHistory txs={txHistory} />
    </div>
  );
};

export default SwapCard;
