import type { TokenInfo } from '../types.ts'
import { formatSqrtPriceX96 } from '../utils/priceCalc.ts'

interface SqrtPriceInputProps {
  value: string
  onChange: (value: string) => void
  token0: TokenInfo | null
  token1: TokenInfo | null
}

const DEFAULT_X96 = '79228162514264337593543950336'

export function SqrtPriceInput({ value, onChange, token0: _token0, token1: _token1 }: SqrtPriceInputProps) {
  const displayHex = formatSqrtPriceX96(value)
  const isValid = /^\d+$/.test(value) && BigInt(value) > 0n

  return (
    <div className="form-group">
      <div className="form-label-row">
        <label className="form-label">Initial sqrtPriceX96</label>
        <div style={{ display: 'flex', gap: 4 }}>
          <span
            className="zero-address-chip"
            onClick={() => onChange(DEFAULT_X96)}
          >
            1:1 Price
          </span>
        </div>
      </div>
      <input
        type="text"
        className={`text-input ${value && !isValid ? 'input-error' : ''} ${isValid ? 'input-success' : ''}`}
        value={value}
        onChange={e => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        placeholder={DEFAULT_X96}
        spellCheck={false}
      />
      <div className="form-hint" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>
          sqrtPriceX96 = floor(sqrt(token1/token0) × 2⁹⁶)
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
          Hex: {displayHex}
        </span>
      </div>

      <div className="callout" style={{ marginTop: 16 }}>
        <span className="callout-icon">💡</span>
        <div>
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
            Starting Price
          </strong>
          <code style={{ fontSize: 12 }}>{DEFAULT_X96}</code> = 1:1 ratio (both tokens equal).
          Use the price calculator below to convert between sqrtPriceX96 and human-readable prices.
        </div>
      </div>
    </div>
  )
}
