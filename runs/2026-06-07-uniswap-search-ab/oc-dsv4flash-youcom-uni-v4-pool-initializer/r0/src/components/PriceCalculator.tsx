import { useState, useCallback } from 'react'
import { sqrtPriceX96ToPrice, priceToSqrtPriceX96 } from '../utils/price'

interface Props {
  decimals0: number
  decimals1: number
  sqrtPriceX96: string
  onSqrtPriceX96Change: (value: string) => void
}

export default function PriceCalculator({ decimals0, decimals1, sqrtPriceX96, onSqrtPriceX96Change }: Props) {
  const [priceInput, setPriceInput] = useState('')

  const currentSqrtBig = (() => {
    try { return BigInt(sqrtPriceX96 || '0') } catch { return 0n }
  })()

  const handleSqrtPriceInput = useCallback((value: string) => {
    onSqrtPriceX96Change(value)
    try {
      const bigintVal = BigInt(value || '0')
      if (bigintVal > 0n) {
        const p = sqrtPriceX96ToPrice(bigintVal, decimals0, decimals1)
        setPriceInput(p.toFixed(12))
      } else {
        setPriceInput('')
      }
    } catch {
      setPriceInput('')
    }
  }, [onSqrtPriceX96Change, decimals0, decimals1])

  const handlePriceInput = useCallback((value: string) => {
    setPriceInput(value)
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0) {
      const sqrt = priceToSqrtPriceX96(num, decimals0, decimals1)
      onSqrtPriceX96Change(sqrt.toString())
    }
  }, [onSqrtPriceX96Change, decimals0, decimals1])

  return (
    <div className="calc-panel">
      <h3 className="calc-title">Price Calculator</h3>
      <p className="calc-desc">
        Convert between sqrtPriceX96 and human-readable price.
        Price = units of token1 per 1 unit of token0.
      </p>
      <div className="calc-field">
        <label className="calc-label">sqrtPriceX96</label>
        <input
          type="text"
          className="input input-mono"
          value={sqrtPriceX96}
          onChange={(e) => handleSqrtPriceInput(e.target.value)}
          placeholder="e.g. 79228162514264337593543950336"
        />
      </div>
      <div className="calc-arrow">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10m0 0l4-4m-4 4l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="calc-field">
        <label className="calc-label">Price</label>
        <input
          type="text"
          className="input"
          value={priceInput}
          onChange={(e) => handlePriceInput(e.target.value)}
          placeholder="e.g. 1.0"
        />
      </div>
      {currentSqrtBig > 0n && (
        <div className="calc-info">
          <span className="calc-info-label">Computed Price:</span>
          <span className="calc-info-value">{sqrtPriceX96ToPrice(currentSqrtBig, decimals0, decimals1).toFixed(12)}</span>
        </div>
      )}
    </div>
  )
}
