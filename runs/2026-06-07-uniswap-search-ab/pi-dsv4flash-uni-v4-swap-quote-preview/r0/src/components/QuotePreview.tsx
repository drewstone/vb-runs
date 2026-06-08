import type { SwapQuote, Token } from '../types/index.ts'

interface QuotePreviewProps {
  quote: SwapQuote
  inputToken: Token
  outputToken: Token
}

export function QuotePreview({ quote, inputToken, outputToken }: QuotePreviewProps) {
  return (
    <div className="quote-preview">
      {/* Summary */}
      <div className="quote-summary">
        <span className="quote-amount-in">{quote.amountInFormatted}</span>
        <span className="quote-token">{inputToken.symbol}</span>
        <svg className="quote-arrow" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="quote-amount-out">{quote.amountOutFormatted}</span>
        <span className="quote-token">{outputToken.symbol}</span>
      </div>

      {/* Details */}
      <div className="quote-details">
        <div className="quote-detail-row">
          <span className="quote-detail-label">Expected output</span>
          <span className="quote-detail-value">
            {quote.amountOutFormatted} {outputToken.symbol}
          </span>
        </div>

        <div className="quote-detail-row">
          <span className="quote-detail-label">Price impact</span>
          <span
            className={`quote-detail-value ${
              quote.priceImpactPercent.startsWith('<0') ||
              Number.parseFloat(quote.priceImpactPercent) < 0.1
                ? 'impact-low'
                : Number.parseFloat(quote.priceImpactPercent) < 1
                  ? 'impact-mid'
                  : 'impact-high'
            }`}
            title="|1 − executionPrice ÷ midPrice| × 100"
          >
            {quote.priceImpactPercent}
          </span>
        </div>

        <div className="quote-detail-row">
          <span className="quote-detail-label">Execution price</span>
          <span className="quote-detail-value">
            1 {inputToken.symbol} = {quote.executionPrice} {outputToken.symbol}
          </span>
        </div>

        <div className="quote-detail-row">
          <span className="quote-detail-label">Mid price (fair)</span>
          <span className="quote-detail-value">
            1 {inputToken.symbol} = {quote.midPrice} {outputToken.symbol}
          </span>
        </div>

        <div className="quote-detail-row">
          <span className="quote-detail-label">Direction</span>
          <span className="quote-detail-value mono">
            zeroForOne = {String(quote.zeroForOne)}
          </span>
        </div>

        <div className="quote-detail-separator" />

        <div className="quote-detail-row">
          <span className="quote-detail-label">sqrtPriceLimitX96</span>
          <span className="quote-detail-value mono">
            {quote.sqrtPriceLimitX96.toString().slice(0, 14)}...
          </span>
        </div>

        <div className="quote-detail-row">
          <span className="quote-detail-label">sqrtPriceX96 (before)</span>
          <span className="quote-detail-value mono">
            {quote.sqrtPriceBefore.toString().slice(0, 14)}...
          </span>
        </div>

        <div className="quote-detail-row">
          <span className="quote-detail-label">sqrtPriceX96 (after)</span>
          <span className="quote-detail-value mono">
            {quote.sqrtPriceAfter.toString().slice(0, 14)}...
          </span>
        </div>

        <div className="quote-detail-row">
          <span className="quote-detail-label">Liquidity</span>
          <span className="quote-detail-value mono">
            {quote.liquidity.toString().slice(0, 10)}...
          </span>
        </div>

        <div className="quote-detail-separator" />

        <div className="quote-detail-row">
          <span className="quote-detail-label">Quote engine</span>
          <span className="quote-detail-value mono" style={{ color: '#FF007A' }}>
            @uniswap/v4-sdk · Pool.getOutputAmount
          </span>
        </div>
      </div>
    </div>
  )
}
