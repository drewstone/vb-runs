import { useState, useCallback } from 'react'
import { usePoolState } from '../hooks/usePoolState'
import { useSwapQuote } from '../hooks/useSwapQuote'
import {
  TOKENS,
  FEE_TIERS,
  type TokenInfo,
  type FeeTier,
} from '../lib/constants'

function formatNumber(n: number, maxDecimals = 6): string {
  if (!n || !isFinite(n)) return '—'
  if (n < 0.000001 && n > 0) return '< 0.000001'
  if (n >= 1_000_000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  if (n >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: maxDecimals })
  return n.toLocaleString('en-US', { maximumFractionDigits: Math.max(maxDecimals, 8) })
}

function formatPrice(n: number): string {
  if (!n || !isFinite(n)) return '—'
  if (n >= 1) return formatNumber(n, 4)
  return formatNumber(n, 10)
}

function formatBigInt(n: bigint): string {
  const s = n.toString()
  if (s.length <= 18) return s
  return s.slice(0, 8) + '…' + s.slice(-6)
}

function impactClass(impact: number): string {
  if (impact > 3) return 'impact-high'
  if (impact > 1) return 'impact-medium'
  return 'impact-low'
}

export default function SwapQuote() {
  const [inputToken, setInputToken] = useState<TokenInfo>(TOKENS[0])
  const [outputToken, setOutputToken] = useState<TokenInfo>(TOKENS[1])
  const [feeTier, setFeeTier] = useState<FeeTier>(FEE_TIERS[2])
  const [inputAmount, setInputAmount] = useState('')

  const { poolState, isLoading, error, poolId } = usePoolState(
    inputToken,
    outputToken,
    feeTier,
  )

  const quote = useSwapQuote(poolState, inputToken, outputToken, inputAmount)

  const handleSwapDirection = useCallback(() => {
    setInputToken(outputToken)
    setOutputToken(inputToken)
    setInputAmount('')
  }, [inputToken, outputToken])

  const handleInputTokenChange = useCallback(
    (symbol: string) => {
      const t = TOKENS.find((tk) => tk.symbol === symbol)
      if (!t) return
      if (t.symbol === outputToken.symbol) setOutputToken(inputToken)
      setInputToken(t)
      setInputAmount('')
    },
    [inputToken, outputToken],
  )

  const handleOutputTokenChange = useCallback(
    (symbol: string) => {
      const t = TOKENS.find((tk) => tk.symbol === symbol)
      if (!t) return
      if (t.symbol === inputToken.symbol) setInputToken(outputToken)
      setOutputToken(t)
    },
    [inputToken, outputToken],
  )

  return (
    <div className="swap-card">
      <div className="swap-header">
        <h2>V4 Swap Quote</h2>
        <span className="pool-badge">
          <span className="pool-badge-dot" />
          {inputToken.symbol}/{outputToken.symbol} {feeTier.label}
        </span>
      </div>

      <div className="fee-selector">
        {FEE_TIERS.map((ft) => (
          <button
            key={ft.fee}
            className={`fee-btn ${ft.fee === feeTier.fee ? 'active' : ''}`}
            onClick={() => setFeeTier(ft)}
          >
            {ft.label}
          </button>
        ))}
      </div>

      <div className="token-row">
        <div className="token-row-header">
          <span className="token-label">You pay</span>
        </div>
        <div className="token-row-body">
          <select
            className="token-select"
            value={inputToken.symbol}
            onChange={(e) => handleInputTokenChange(e.target.value)}
          >
            {TOKENS.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="amount-input"
            placeholder="0.0"
            min="0"
            step="any"
            value={inputAmount}
            onChange={(e) => setInputAmount(e.target.value)}
          />
        </div>
      </div>

      <div className="swap-direction-container">
        <button className="swap-direction-btn" onClick={handleSwapDirection}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      <div className="token-row">
        <div className="token-row-header">
          <span className="token-label">You receive</span>
        </div>
        <div className="token-row-body">
          <select
            className="token-select"
            value={outputToken.symbol}
            onChange={(e) => handleOutputTokenChange(e.target.value)}
          >
            {TOKENS.map((t) => (
              <option key={t.symbol} value={t.symbol}>
                {t.symbol}
              </option>
            ))}
          </select>
          <div className={`output-display ${!quote ? 'empty' : ''}`}>
            {quote ? formatNumber(quote.outputAmount) : '0.0'}
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="status-msg">Loading pool state from chain…</div>
      )}

      {error && (
        <div className="status-msg error">
          Error reading pool state: {(error as Error).message ?? String(error)}
        </div>
      )}

      {!isLoading && !error && !poolState && inputAmount && (
        <div className="status-msg warn">
          No pool found for {inputToken.symbol}/{outputToken.symbol} at{' '}
          {feeTier.label} fee tier. Try a different pair or fee.
        </div>
      )}

      {quote && (
        <div className="quote-details animate-in">
          <div className="separator" />
          <div className="quote-row">
            <span className="quote-label">Price Impact</span>
            <span className={`quote-value ${impactClass(quote.priceImpact)}`}>
              {quote.priceImpact.toFixed(4)}%
            </span>
          </div>
          <div className="quote-row">
            <span className="quote-label">Execution Price</span>
            <span className="quote-value">
              {formatPrice(quote.executionPrice)} {outputToken.symbol} per{' '}
              {inputToken.symbol}
            </span>
          </div>
          <div className="quote-row">
            <span className="quote-label">Mid Price (Pool)</span>
            <span className="quote-value">
              {formatPrice(quote.midPrice)} {outputToken.symbol} per{' '}
              {inputToken.symbol}
            </span>
          </div>
          <div className="quote-row">
            <span className="quote-label">Pool Fee</span>
            <span className="quote-value">{quote.feePercent.toFixed(2)}%</span>
          </div>
          <div className="quote-row">
            <span className="quote-label">Min. Received (0.5% slippage)</span>
            <span className="quote-value">
              {formatNumber(quote.outputAmount * 0.995)} {outputToken.symbol}
            </span>
          </div>
        </div>
      )}

      <div className="pool-state-card">
        <div className="pool-state-header">
          <h3>Pool State</h3>
          <span className="pool-state-library">StateLibrary</span>
        </div>
        <div className="state-grid">
          <div className="state-item full-width">
            <span className="state-label">Pool ID</span>
            <span className="state-value mono">{formatBigInt(BigInt(poolId))}</span>
          </div>
          <div className="state-item">
            <span className="state-label">sqrtPriceX96</span>
            <span className="state-value mono">
              {poolState ? formatBigInt(poolState.sqrtPriceX96) : '—'}
            </span>
          </div>
          <div className="state-item">
            <span className="state-label">Liquidity</span>
            <span className="state-value mono">
              {poolState ? poolState.liquidity.toLocaleString() : '—'}
            </span>
          </div>
          <div className="state-item">
            <span className="state-label">Current Tick</span>
            <span className="state-value mono">
              {poolState ? poolState.tick.toLocaleString() : '—'}
            </span>
          </div>
          <div className="state-item">
            <span className="state-label">LP Fee</span>
            <span className="state-value mono">
              {poolState ? `${(poolState.lpFee / 1e6 * 100).toFixed(4)}%` : '—'}
            </span>
          </div>
        </div>
      </div>

      {quote && (
        <div className="math-card animate-in">
          <h3>Computation Trace</h3>
          <div className="math-step">
            <span className="math-comment">
              {'// StateLibrary.getSlot0(poolId) via readContract'}
            </span>
          </div>
          <div className="math-step">
            <span className="math-fn">sqrtPriceX96</span> ={' '}
            <span className="math-val">{formatBigInt(poolState!.sqrtPriceX96)}</span>
          </div>
          <div className="math-step">
            <span className="math-fn">liquidity</span> ={' '}
            <span className="math-val">{poolState!.liquidity.toLocaleString()}</span>
          </div>
          <div className="math-step">
            <span className="math-comment">
              {'// SqrtPriceMath.getNextSqrtPriceFromInput'}
            </span>
          </div>
          <div className="math-step">
            zeroForOne = <span className="math-val">{String(quote ? inputToken.address.toLowerCase() < outputToken.address.toLowerCase() : false)}</span>
          </div>
          <div className="math-step">
            <span className="math-fn">SqrtPriceMath.getAmount{inputToken.address.toLowerCase() < outputToken.address.toLowerCase() ? '1' : '0'}Delta</span>
            (newSqrtPrice, sqrtPriceX96, liquidity, roundUp=false)
          </div>
          <div className="math-step">
            output = <span className="math-val">{formatNumber(quote.outputAmount)}</span>{' '}
            {outputToken.symbol}
          </div>
        </div>
      )}
    </div>
  )
}
