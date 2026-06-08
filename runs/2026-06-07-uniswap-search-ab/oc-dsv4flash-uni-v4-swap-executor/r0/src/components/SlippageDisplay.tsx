import { computeSlippagePercent } from '../utils/balanceDelta'

interface SlippageDisplayProps {
  quotedAmountOut: string
  actualAmountOut: string
  slippageTolerance: number
}

export function SlippageDisplay({ quotedAmountOut, actualAmountOut, slippageTolerance }: SlippageDisplayProps) {
  const realized = computeSlippagePercent(quotedAmountOut, actualAmountOut)
  const diff = realized - slippageTolerance
  const betterThanQuote = realized <= slippageTolerance

  return (
    <div className="slippage-display">
      <h3 className="section-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        Slippage Analysis
      </h3>
      <div className="slippage-grid">
        <div className="slippage-item">
          <span className="slippage-label">Quoted Amount Out</span>
          <span className="slippage-value">{parseFloat(quotedAmountOut).toFixed(6)}</span>
        </div>
        <div className="slippage-item">
          <span className="slippage-label">Actual Amount Out</span>
          <span className="slippage-value">{parseFloat(actualAmountOut).toFixed(6)}</span>
        </div>
        <div className="slippage-item">
          <span className="slippage-label">Slippage Tolerance</span>
          <span className="slippage-value">{slippageTolerance.toFixed(2)}%</span>
        </div>
        <div className="slippage-item">
          <span className="slippage-label">Realized Slippage</span>
          <span className={`slippage-value ${realized <= slippageTolerance ? 'good' : 'bad'}`}>
            {realized.toFixed(4)}%
          </span>
        </div>
        <div className="slippage-item highlight">
          <span className="slippage-label">vs Tolerance</span>
          <span className={`slippage-value ${betterThanQuote ? 'good' : 'bad'}`}>
            {betterThanQuote ? '✓ ' : '✗ '}
            {Math.abs(diff).toFixed(4)}% {betterThanQuote ? 'within' : 'exceeded'}
          </span>
        </div>
      </div>
    </div>
  )
}
