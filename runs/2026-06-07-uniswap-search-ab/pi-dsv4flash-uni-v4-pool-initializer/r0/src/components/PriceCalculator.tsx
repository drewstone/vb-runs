import type { TokenInfo } from '../types.ts'
import { sqrtPriceX96ToPrice, priceToSqrtPriceX96, formatSqrtPriceX96 } from '../utils/priceCalc.ts'

interface PriceCalculatorProps {
  sqrtPriceX96: string
  token0: TokenInfo | null
  token1: TokenInfo | null
  onSqrtPriceChange: (value: string) => void
}

export function PriceCalculator({ sqrtPriceX96, token0, token1, onSqrtPriceChange }: PriceCalculatorProps) {
  if (!token0 || !token1) {
    return (
      <div className="card" style={{ opacity: 0.5 }}>
        <div className="card-title">Price Calculator</div>
        <div className="card-subtitle">Select both tokens to enable the price calculator</div>
      </div>
    )
  }

  const humanPrice = sqrtPriceX96ToPrice(sqrtPriceX96, token0.decimals, token1.decimals)

  const handlePriceChange = (value: string) => {
    if (value && Number(value) > 0) {
      const x96 = priceToSqrtPriceX96(value)
      if (x96 !== '0') {
        onSqrtPriceChange(x96)
      }
    }
  }

  const displayHex = formatSqrtPriceX96(sqrtPriceX96)

  return (
    <div className="card">
      <div className="card-title">Price Calculator</div>
      <div className="card-subtitle">
        Convert between sqrtPriceX96 and human-readable price
      </div>

      <div className="price-calculator">
        <div className="calc-input-group">
          <label>
            sqrtPriceX96
            <span className="calc-currency-badge" style={{ marginLeft: 6 }}>(raw)</span>
          </label>
          <input
            type="text"
            value={sqrtPriceX96}
            onChange={e => {
              const val = e.target.value.replace(/[^0-9]/g, '')
              onSqrtPriceChange(val)
            }}
            placeholder="79228162514264337593543950336"
            spellCheck={false}
          />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            Hex: {displayHex}
          </span>
        </div>

        <div className="calc-arrow">
          <span style={{ fontSize: 24, lineHeight: 1 }}>&#x21c4;</span>
        </div>

        <div className="calc-input-group">
          <label>
            {token1.symbol} per {token0.symbol}
            <span className="calc-currency-badge" style={{ marginLeft: 6 }}>(human-readable)</span>
          </label>
          <input
            type="text"
            value={humanPrice}
            onChange={e => handlePriceChange(e.target.value)}
            placeholder={`e.g. 1.0 ${token1.symbol} per ${token0.symbol}`}
            spellCheck={false}
          />
        </div>
      </div>

      <div className="summary-row" style={{ marginTop: 12, borderBottom: 'none' }}>
        <span className="summary-key">Price</span>
        <span className="summary-value accent">
          1 {token0.symbol} &#x2248; {humanPrice} {token1.symbol}
        </span>
      </div>
    </div>
  )
}
