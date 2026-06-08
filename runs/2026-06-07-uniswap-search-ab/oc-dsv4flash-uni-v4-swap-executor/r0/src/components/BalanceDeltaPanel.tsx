import type { BalanceDelta } from '../types'
import { decodeBalanceDeltaFromBigInts } from '../utils/balanceDelta'

interface BalanceDeltaPanelProps {
  delta: BalanceDelta | null
  token0Symbol: string
  token1Symbol: string
  token0Decimals: number
  token1Decimals: number
}

export function BalanceDeltaPanel({ delta, token0Symbol, token1Symbol, token0Decimals, token1Decimals }: BalanceDeltaPanelProps) {
  if (!delta) {
    return (
      <div className="delta-panel">
        <h3 className="section-title">BalanceDelta</h3>
        <p className="text-muted" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          Awaiting swap confirmation...
        </p>
      </div>
    )
  }

  const decoded = decodeBalanceDeltaFromBigInts(delta.amount0, delta.amount1, token0Decimals, token1Decimals)

  return (
    <div className="delta-panel">
      <h3 className="section-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3v18h18"/>
          <path d="M7 16l4-8 4 4 4-6"/>
        </svg>
        BalanceDelta — Decoded from Swap Event
      </h3>
      <div className="delta-grid">
        <div className="delta-item">
          <span className="delta-label">amount0 ({token0Symbol})</span>
          <span className={`delta-value ${delta.amount0 < 0n ? 'negative' : 'positive'}`}>
            {decoded.formatted0}
          </span>
        </div>
        <div className="delta-item">
          <span className="delta-label">amount1 ({token1Symbol})</span>
          <span className={`delta-value ${delta.amount1 < 0n ? 'negative' : 'positive'}`}>
            {decoded.formatted1}
          </span>
        </div>
      </div>
      <div className="delta-raw">
        <span className="delta-raw-label">Raw (int256)</span>
        <code className="delta-raw-value">
          amount0: {delta.amount0.toString()}<br />
          amount1: {delta.amount1.toString()}
        </code>
      </div>
    </div>
  )
}
