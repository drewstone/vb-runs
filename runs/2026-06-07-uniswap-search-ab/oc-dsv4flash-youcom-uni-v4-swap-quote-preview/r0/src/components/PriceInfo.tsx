import type { Token } from '@uniswap/sdk-core'
import type { SwapQuote } from '../types'

interface PriceInfoProps {
  quote: SwapQuote | null
  tokenIn: Token | null
  tokenOut: Token | null
}

export function PriceInfo({ quote, tokenIn, tokenOut }: PriceInfoProps) {
  if (!quote || !tokenIn || !tokenOut) {
    return (
      <div className="price-info empty">
        <p className="price-muted">Enter an amount to preview the swap</p>
      </div>
    )
  }

  const impactColor =
    quote.priceImpactRaw < -0.01
      ? 'var(--color-error)'
      : Math.abs(quote.priceImpactRaw) < 0.01
        ? 'var(--color-success)'
        : Math.abs(quote.priceImpactRaw) < 0.05
          ? 'var(--color-warning)'
          : 'var(--color-error)'

  const symIn = tokenIn.symbol ?? 'token0'
  const symOut = tokenOut.symbol ?? 'token1'

  return (
    <div className="price-info">
      <div className="price-row">
        <span className="price-label">Mid price</span>
        <span className="price-value">
          1 {quote.zeroForOne ? symIn : symOut} = {quote.midPrice}{' '}
          {quote.zeroForOne ? symOut : symIn}
        </span>
      </div>
      <div className="price-row">
        <span className="price-label">Execution price</span>
        <span className="price-value">
          1 {quote.zeroForOne ? symIn : symOut} = {quote.executionPrice}{' '}
          {quote.zeroForOne ? symOut : symIn}
        </span>
      </div>
      <div className="price-row">
        <span className="price-label">Price impact</span>
        <span className="price-value" style={{ color: impactColor }}>
          {quote.priceImpact}
        </span>
      </div>
      <div className="price-row divider-top">
        <span className="price-label">Pool liquidity</span>
        <span className="price-value mono">
          {(Number(quote.liquidity) / 2 ** 96).toFixed(2)}
        </span>
      </div>
      <div className="price-row">
        <span className="price-label">Direction</span>
        <span className="price-value mono">
          {quote.zeroForOne ? `${symIn} → ${symOut}` : `${symIn} → ${symOut}`}
        </span>
      </div>
    </div>
  )
}
