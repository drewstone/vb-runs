import { useState, useCallback } from 'react'
import type { Token } from '@uniswap/sdk-core'
import { useAccount } from 'wagmi'
import { bySymbol } from '../utils/tokens'
import { useSwapQuote } from '../hooks/useSwapQuote'
import { TokenSelect } from './TokenSelect'
import { PriceInfo } from './PriceInfo'

const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n

export function SwapCard() {
  const { isConnected } = useAccount()
  const [tokenIn, setTokenIn] = useState<Token | null>(bySymbol('WETH')?.token ?? null)
  const [tokenOut, setTokenOut] = useState<Token | null>(bySymbol('USDC')?.token ?? null)
  const [amountIn, setAmountIn] = useState('')
  const [sqrtPriceLimit, setSqrtPriceLimit] = useState('')
  const [reverseAnim, setReverseAnim] = useState(false)

  const sqrtPriceLimitX96 = sqrtPriceLimit
    ? BigInt(sqrtPriceLimit)
    : MAX_SQRT_PRICE

  const { quote, loading } = useSwapQuote(tokenIn, tokenOut, amountIn, sqrtPriceLimitX96)

  const handleReverse = useCallback(() => {
    setReverseAnim(true)
    const tmp = tokenIn
    setTokenIn(tokenOut)
    setTokenOut(tmp)
    setTimeout(() => setReverseAnim(false), 300)
  }, [tokenIn, tokenOut])

  const handleMax = useCallback(() => {
    setAmountIn('100')
  }, [])

  const actionDisabled = !isConnected || !amountIn || parseFloat(amountIn) <= 0 || !tokenIn || !tokenOut
  const actionLabel = !isConnected ? 'Connect wallet' : !amountIn ? 'Enter an amount' : loading ? 'Loading...' : 'Preview swap'

  return (
    <div className="swap-card">
      <div className="swap-header">
        <h2 className="swap-title">Swap</h2>
        <span className="swap-badge">V4 Quote Preview</span>
      </div>

      <div className="swap-panel you-pay">
        <div className="panel-row">
          <TokenSelect
            selected={tokenIn}
            onSelect={setTokenIn}
            label="You pay"
          />
        </div>
        <div className="panel-row amount-row">
          <div className="amount-wrap">
            <input
              className="amount-input"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => {
                const v = e.target.value
                if (/^\d*\.?\d*$/.test(v) || v === '') setAmountIn(v)
              }}
            />
            <button className="max-btn" onClick={handleMax} type="button">
              MAX
            </button>
          </div>
        </div>
      </div>

      <div className="swap-direction">
        <button
          className={`reverse-btn ${reverseAnim ? 'spin' : ''}`}
          onClick={handleReverse}
          type="button"
          aria-label="Reverse tokens"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 16l-4-4 4-4" />
            <path d="M3 12h18" />
            <path d="M17 8l4 4-4 4" />
          </svg>
        </button>
      </div>

      <div className="swap-panel you-receive">
        <div className="panel-row">
          <TokenSelect
            selected={tokenOut}
            onSelect={setTokenOut}
            label="You receive"
          />
        </div>
        <div className="panel-row amount-row">
          <div className="amount-wrap">
            <input
              className="amount-input output"
              type="text"
              readOnly
              placeholder="0.0"
              value={quote?.amountOutStr ?? ''}
            />
          </div>
        </div>
      </div>

      <PriceInfo quote={quote} tokenIn={tokenIn} tokenOut={tokenOut} />

      <div className="sqrt-limit-row">
        <label className="field-label">sqrtPriceLimitX96 (optional)</label>
        <input
          className="amount-input"
          type="text"
          inputMode="numeric"
          placeholder={MAX_SQRT_PRICE.toString().slice(0, 16) + '...'}
          value={sqrtPriceLimit}
          onChange={(e) => {
            const v = e.target.value
            if (/^\d*$/.test(v) || v === '') setSqrtPriceLimit(v)
          }}
        />
      </div>

      <button
        className={`action-btn ${actionDisabled ? 'disabled' : 'active'}`}
        disabled={actionDisabled}
        type="button"
      >
        {actionLabel}
      </button>
    </div>
  )
}
