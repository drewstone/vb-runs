import type { SwapResult } from '../types'

interface Props { result: SwapResult }

export function ResultsPanel({ result }: Props) {
  const explorerUrl = result.txHash ? `https://sepolia.basescan.org/tx/${result.txHash}` : null
  const approvalUrl = result.approvalTxHash ? `https://sepolia.basescan.org/tx/${result.approvalTxHash}` : null

  return (
    <div className="card results-panel">
      <div className="card-header">
        <span className="card-title">Swap Results</span>
        <span style={{
          fontSize: 12, padding: '3px 8px', borderRadius: 6, fontWeight: 600,
          background: 'var(--positive-bg)', color: 'var(--positive)',
        }}>
          Confirmed
        </span>
      </div>

      <div className="results-grid">
        <div className="result-box">
          <div className="result-box-label">Amount In</div>
          <div className="result-box-value actual">{result.amountInFormatted}</div>
          <div className="result-box-sub">{result.tokenInSymbol}</div>
        </div>
        <div className="result-box">
          <div className="result-box-label">Amount Out (realized)</div>
          <div className="result-box-value actual">{result.actualAmountOutFormatted}</div>
          <div className="result-box-sub">{result.tokenOutSymbol}</div>
        </div>
      </div>

      <div className="delta-section">
        <div className="delta-section-title">BalanceDelta — decoded from PoolManager Swap event</div>
        <div className="delta-hex">{result.balanceDelta.hex}</div>
        <div className="delta-rows">
          <div className={`delta-row ${result.balanceDelta.isAmount0Negative ? 'negative' : 'positive'}`}>
            <div className="delta-token">
              {result.balanceDelta.isAmount0Negative ? `${result.tokenInSymbol} (paid)` : `${result.tokenInSymbol} (received)`}
            </div>
            <span className={`delta-amount ${result.balanceDelta.isAmount0Negative ? 'negative' : 'positive'}`}>
              {result.balanceDelta.isAmount0Negative ? '−' : '+'}{result.balanceDelta.amount0Formatted}
            </span>
          </div>
          <div className={`delta-row ${result.balanceDelta.isAmount1Negative ? 'negative' : 'positive'}`}>
            <div className="delta-token">
              {result.balanceDelta.isAmount1Negative ? `${result.tokenOutSymbol} (paid)` : `${result.tokenOutSymbol} (received)`}
            </div>
            <span className={`delta-amount ${result.balanceDelta.isAmount1Negative ? 'negative' : 'positive'}`}>
              {result.balanceDelta.isAmount1Negative ? '−' : '+'}{result.balanceDelta.amount1Formatted}
            </span>
          </div>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-item" style={{ gridColumn: '1 / -1' }}>
          <span className="metric-label">Quoted Output</span>
          <span className="metric-value" style={{ color: 'var(--info)', fontSize: 18 }}>
            {result.quotedAmountOutFormatted} {result.tokenOutSymbol}
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Min Received ({result.txStatus === 'confirmed' ? 'slippage floor' : '—'})</span>
          <span className="metric-value">{result.amountOutMinimumFormatted} {result.tokenOutSymbol}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Realized Slippage</span>
          <span className={`metric-value ${Math.abs(result.realizedSlippage) < 0.1 ? 'good' : Math.abs(result.realizedSlippage) < 0.5 ? 'warn' : 'bad'}`}>
            {result.realizedSlippage.toFixed(4)}%
          </span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Executed Price</span>
          <span className="metric-value">{result.executedPrice}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Gas Used</span>
          <span className="metric-value">{result.gasUsedFormatted} units</span>
        </div>
      </div>

      {explorerUrl && (
        <div className="tx-hash-row">
          <span className="tx-hash-label">Swap TX</span>
          <a className="tx-hash-value" href={explorerUrl} target="_blank" rel="noopener noreferrer">
            {result.txHash!.slice(0, 42)}...
          </a>
        </div>
      )}
      {approvalUrl && (
        <div className="tx-hash-row" style={{ marginTop: 8 }}>
          <span className="tx-hash-label">Approval TX</span>
          <a className="tx-hash-value" href={approvalUrl} target="_blank" rel="noopener noreferrer">
            {result.approvalTxHash!.slice(0, 42)}...
          </a>
        </div>
      )}
    </div>
  )
}
