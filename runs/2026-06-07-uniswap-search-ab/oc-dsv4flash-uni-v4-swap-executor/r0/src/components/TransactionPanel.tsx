import type { TransactionResult, BalanceDelta } from '../types'
import { shortenAddress } from '../utils/format'
import { computeSlippagePercent } from '../utils/balanceDelta'

interface TransactionPanelProps {
  tx: TransactionResult | null
  inputDecimals?: number
  outputDecimals?: number
}

export function TransactionPanel({ tx, inputDecimals, outputDecimals }: TransactionPanelProps) {
  if (!tx) return null

  const explorerUrl = `https://etherscan.io/tx/${tx.hash}`

  const amountInNum = parseFloat(tx.amountIn || '0')
  const amountOutNum = parseFloat(tx.amountOut || '0')
  const quotedOutNum = parseFloat(tx.quotedAmountOut || '0')
  const realizedSlip = tx.realizedSlippage ?? computeSlippagePercent(tx.quotedAmountOut || '0', tx.amountOut || '0')
  const price = tx.executedPrice || (amountInNum > 0 && amountOutNum > 0 ? (amountOutNum / amountInNum).toFixed(8) : '—')

  return (
    <div className="tx-panel">
      <h3 className="section-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
        Transaction Receipt
      </h3>

      <div className="tx-details">
        <div className="tx-row">
          <span className="tx-label">Status</span>
          <span className={`tx-status tx-${tx.status}`}>{tx.status}</span>
        </div>

        <div className="tx-row">
          <span className="tx-label">Hash</span>
          <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="tx-hash">
            {shortenAddress(tx.hash, 8)}
          </a>
        </div>

        {tx.blockNumber && (
          <div className="tx-row">
            <span className="tx-label">Block</span>
            <span className="tx-value">#{tx.blockNumber.toLocaleString()}</span>
          </div>
        )}

        <div className="tx-row">
          <span className="tx-label">Time</span>
          <span className="tx-value">{new Date(tx.timestamp).toLocaleTimeString()}</span>
        </div>

        {tx.amountIn && tx.amountOut && (
          <>
            <div className="tx-row">
              <span className="tx-label">You Paid</span>
              <span className="tx-value">{parseFloat(tx.amountIn).toFixed(6)}</span>
            </div>
            <div className="tx-row">
              <span className="tx-label">You Received</span>
              <span className="tx-value">{parseFloat(tx.amountOut).toFixed(6)}</span>
            </div>
            <div className="tx-row">
              <span className="tx-label">Executed Price</span>
              <span className="tx-value">{price}</span>
            </div>
          </>
        )}

        {tx.gasUsed && (
          <div className="tx-row">
            <span className="tx-label">Gas Cost (ETH)</span>
            <span className="tx-value">{tx.gasUsed}</span>
          </div>
        )}

        {tx.quotedAmountOut && (
          <div className="tx-row">
            <span className="tx-label">Quoted Out</span>
            <span className="tx-value">{parseFloat(tx.quotedAmountOut).toFixed(6)}</span>
          </div>
        )}

        <div className="tx-row">
          <span className="tx-label">Slippage Tolerance</span>
          <span className="tx-value">{(tx.quotedSlippage ?? 0.5).toFixed(2)}%</span>
        </div>

        <div className="tx-row">
          <span className="tx-label">Realized Slippage</span>
          <span className={`tx-value ${realizedSlip <= (tx.quotedSlippage ?? 0.5) ? 'good' : 'bad'}`}>
            {realizedSlip.toFixed(4)}%
            {realizedSlip <= (tx.quotedSlippage ?? 0.5)
              ? ' ✓ within tolerance'
              : ' ✗ exceeded'
            }
          </span>
        </div>

        <div className="tx-row">
          <span className="tx-label">Quoted → Actual</span>
          <span className="tx-value">
            {quotedOutNum > 0
              ? (amountOutNum >= quotedOutNum
                ? `+${((amountOutNum - quotedOutNum) / quotedOutNum * 100).toFixed(3)}% better`
                : `${((amountOutNum - quotedOutNum) / quotedOutNum * 100).toFixed(3)}% worse`)
              : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
