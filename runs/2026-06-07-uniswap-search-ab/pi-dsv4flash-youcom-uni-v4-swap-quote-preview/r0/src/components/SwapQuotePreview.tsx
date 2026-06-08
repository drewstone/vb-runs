import type { SwapQuote, TokenInfo } from "../types";
import { PriceImpactBar } from "./PriceImpactBar";

interface SwapQuotePreviewProps {
  quote: SwapQuote;
  tokenOut: TokenInfo | null;
}

/**
 * Displays the swap quote with all required fields:
 * - Expected output (from Pool.getOutputAmount via SqrtPriceMath)
 * - Price impact %
 * - Mid price vs effective execution price
 * - Minimum received after slippage
 */
export function SwapQuotePreview({ quote, tokenOut }: SwapQuotePreviewProps) {
  const pct = (quote.priceImpact * 100).toFixed(2);
  const minOutNum = tokenOut
    ? Number(quote.minimumAmountOutRaw) / Math.pow(10, tokenOut.decimals)
    : 0;

  return (
    <div className="swap-preview">
      <div className="swap-preview__header">
        <h3 className="swap-preview__title">Quote Preview</h3>
        <span className="swap-preview__badge swap-preview__badge--sdk">
          Pool.getOutputAmount
        </span>
      </div>

      {/* Expected output */}
      <div className="swap-preview__output-card">
        <div className="swap-preview__output-label">
          Expected Output
        </div>
        <div className="swap-preview__output-amount">
          <span className="swap-preview__output-value">
            {quote.amountOutFormatted}
          </span>
        </div>
      </div>

      {/* Price impact bar */}
      <PriceImpactBar impact={quote.priceImpact} />

      {/* Detail rows */}
      <div className="swap-preview__details">
        {/* Mid price */}
        <div className="swap-preview__detail-row">
          <span className="swap-preview__detail-label">Mid Price</span>
          <span className="swap-preview__detail-value">
            1 IN = {quote.midPrice} OUT
          </span>
        </div>

        {/* Execution price */}
        <div className="swap-preview__detail-row">
          <span className="swap-preview__detail-label">Execution Price</span>
          <span className="swap-preview__detail-value">
            1 IN = {quote.executionPrice} OUT
          </span>
        </div>

        {/* Price impact as percentage */}
        <div className="swap-preview__detail-row swap-preview__detail-row--price-impact">
          <span className="swap-preview__detail-label">Price Impact</span>
          <span
            className="swap-preview__detail-value"
            data-impact={
              parseFloat(pct) >= 2 ? "high" : parseFloat(pct) >= 0.5 ? "medium" : "low"
            }
          >
            {pct}%
          </span>
        </div>

        <div className="swap-preview__divider" />

        {/* Slippage */}
        <div className="swap-preview__detail-row">
          <span className="swap-preview__detail-label">Slippage Tolerance</span>
          <span className="swap-preview__detail-value">
            {(quote.slippageTolerance * 100).toFixed(2)}%
          </span>
        </div>

        {/* Minimum received */}
        <div className="swap-preview__detail-row">
          <span className="swap-preview__detail-label">Minimum Received</span>
          <span className="swap-preview__detail-value swap-preview__detail-value--min">
            {minOutNum.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 6,
            })}{" "}
            OUT
          </span>
        </div>
      </div>

      {/* Method note */}
      <div className="swap-preview__fee-note">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.25" />
          <path d="M7 4v3.5M7 9.5v.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
        <span>
          Quote via <strong>Pool.getOutputAmount</strong> — uses SqrtPriceMath internally
        </span>
      </div>
    </div>
  );
}

/** Empty state */
export function SwapQuoteEmpty() {
  return (
    <div className="swap-preview swap-preview--empty">
      <div className="swap-preview__empty-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="8" y="20" width="32" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
          <path d="M24 8v12M18 14l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18 30h12M18 34h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="2 2" />
        </svg>
      </div>
      <h3 className="swap-preview__empty-title">No Quote Yet</h3>
      <p className="swap-preview__empty-desc">
        Select tokens and enter an amount to preview your swap via the V4 SDK.
      </p>
    </div>
  );
}

/** Loading skeleton */
export function SwapQuoteLoading() {
  return (
    <div className="swap-preview swap-preview--loading">
      <div className="swap-preview__skeleton swap-preview__skeleton--large" />
      <div className="swap-preview__skeleton swap-preview__skeleton--bar" />
      <div className="swap-preview__skeleton swap-preview__skeleton--line" />
      <div className="swap-preview__skeleton swap-preview__skeleton--line" />
      <div className="swap-preview__skeleton swap-preview__skeleton--line" />
    </div>
  );
}
