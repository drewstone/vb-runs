import type { InitializeResult } from '../types.ts'

interface PoolIdDisplayProps {
  result: InitializeResult
  onReset: () => void
}

export function PoolIdDisplay({ result, onReset }: PoolIdDisplayProps) {
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result.poolId)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = result.poolId
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    showToast('Pool ID copied to clipboard')
  }

  return (
    <div className="fade-in">
      <div className="card" style={{ textAlign: 'center' }}>
        <div className="pool-id-display">
          <div className="pool-id-icon">✓</div>
          <div className="pool-id-success">
            <span>●</span>
            Pool Initialized Successfully
          </div>
          <div className="pool-id-label">Pool ID</div>
          <div className="pool-id-value">{result.poolId}</div>

          <div className="result-actions">
            <button className="btn btn-ghost" onClick={handleCopy} type="button">
              📋 Copy Pool ID
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">📄 Transaction Details</div>
        <div className="summary-panel">
          {result.txHash && (
            <div className="summary-row">
              <span className="summary-key">Transaction Hash</span>
              <span className="summary-value address" style={{ fontSize: 12 }}>
                {result.txHash.slice(0, 18)}…{result.txHash.slice(-10)}
              </span>
            </div>
          )}
          {result.blockNumber && (
            <div className="summary-row">
              <span className="summary-key">Block Number</span>
              <span className="summary-value">{result.blockNumber.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-title">⚠️ Next Steps</div>
        <ul className="feature-list">
          <li>
            <span className="check">→</span>
            Add initial liquidity to the pool using a position manager
          </li>
          <li>
            <span className="check">→</span>
            Set appropriate slippage when adding the first position
          </li>
          <li>
            <span className="check">→</span>
            An empty pool is vulnerable to price manipulation — add liquidity ASAP
          </li>
          <li>
            <span className="check">→</span>
            PoolManager contract: <code style={{ fontSize: 11 }}>
              0x00000000000444c5dc75cB358380D2e3dE08A90
            </code>
          </li>
        </ul>
      </div>

      <div className="btn-group" style={{ justifyContent: 'center' }}>
        <button className="btn btn-primary" onClick={onReset} type="button">
          Initialize Another Pool
        </button>
      </div>
    </div>
  )
}

function showToast(message: string) {
  const existing = document.querySelector('.toast-custom')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = 'toast toast-custom success'
  toast.textContent = message
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity 0.3s ease'
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}
