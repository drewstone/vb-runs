import { useState, useMemo, useCallback } from 'react'
import { TickMath } from '@uniswap/v3-sdk'
import type { Token } from '../utils/tokens'
import { TOKENS } from '../utils/tokens'
import { usePoolData } from '../hooks/usePoolData'
import { useQuoter } from '../hooks/useQuoter'
import {
  formatTokenAmount,
  parseTokenAmount,
  formatPrice,
  getAmount0Delta,
  getAmount1Delta,
  getNextSqrtPriceFromInput,
} from '../utils/math'
import TokenSelect, { WalletButton } from './TokenSelect'

const Q96 = BigInt(1) << BigInt(96)

export default function SwapCard() {
  const [tokenIn, setTokenIn] = useState<Token>(TOKENS[0])
  const [tokenOut, setTokenOut] = useState<Token>(TOKENS[1])
  const [amountInStr, setAmountInStr] = useState('1')
  const [direction, setDirection] = useState<'exactIn' | 'exactOut'>('exactIn')
  const [sqrtPriceLimitStr, setSqrtPriceLimitStr] = useState('')

  const pool = usePoolData(tokenIn, tokenOut)

  // zeroForOne is true if the input token is token0 (the token with the lower address)
  const zeroForOne = pool.token0 !== '' && tokenIn.address.toLowerCase() === pool.token0.toLowerCase()

  const amountIn = useMemo(() => {
    if (!amountInStr) return 0n
    try {
      return parseTokenAmount(amountInStr, tokenIn.decimals)
    } catch {
      return 0n
    }
  }, [amountInStr, tokenIn])

  const sqrtPriceLimitX96 = useMemo(() => {
    if (sqrtPriceLimitStr) return BigInt(sqrtPriceLimitStr)
    return zeroForOne
      ? BigInt(TickMath.MIN_SQRT_RATIO.toString())
      : BigInt(TickMath.MAX_SQRT_RATIO.toString())
  }, [sqrtPriceLimitStr, zeroForOne])

  const quoter = useQuoter(tokenIn, tokenOut, amountIn, zeroForOne, sqrtPriceLimitX96)

  const handleSwitch = useCallback(() => {
    setTokenIn(tokenOut)
    setTokenOut(tokenIn)
  }, [tokenIn, tokenOut])

  // Mid price: (sqrtPriceX96 / 2^96)^2 gives token1/token0 price
  const midPrice = useMemo(() => {
    if (pool.sqrtPriceX96 === 0n) return 0
    const ratio = Number(pool.sqrtPriceX96) / Number(Q96)
    const price = ratio * ratio
    // Adjust for decimals
    const [dec0, dec1] = [tokenIn.decimals, tokenOut.decimals]
    const decimalFactor = Math.pow(10, dec0 - dec1)
    const humanPrice = price * decimalFactor
    // If zeroForOne, price is token1/token0 which is tokenOut/tokenIn
    // If !zeroForOne, price is token1/token0 which is tokenIn/tokenOut, so invert
    return zeroForOne ? humanPrice : 1 / humanPrice
  }, [pool.sqrtPriceX96, zeroForOne, tokenIn, tokenOut])

  // Computed output using real SqrtPriceMath
  const computedOutput = useMemo(() => {
    if (pool.sqrtPriceX96 === 0n || amountIn === 0n) return 0n
    try {
      const newSqrtPrice = getNextSqrtPriceFromInput(
        pool.sqrtPriceX96,
        pool.liquidity,
        amountIn,
        zeroForOne,
      )
      if (zeroForOne) {
        return getAmount1Delta(newSqrtPrice, pool.sqrtPriceX96, pool.liquidity)
      } else {
        return getAmount0Delta(newSqrtPrice, pool.sqrtPriceX96, pool.liquidity)
      }
    } catch {
      return 0n
    }
  }, [pool.sqrtPriceX96, pool.liquidity, amountIn, zeroForOne])

  // Execution price from quoter result
  const executionPrice = useMemo(() => {
    if (quoter.amountOut === 0n || amountIn === 0n) return 0
    return (
      Number(quoter.amountOut) / Math.pow(10, tokenOut.decimals)
    ) / (
      Number(amountIn) / Math.pow(10, tokenIn.decimals)
    )
  }, [quoter.amountOut, amountIn, tokenIn, tokenOut])

  // Price impact: (midPrice - executionPrice) / midPrice * 100
  const priceImpact = useMemo(() => {
    if (midPrice <= 0 || executionPrice <= 0) return 0
    return Math.abs((midPrice - executionPrice) / midPrice)
  }, [midPrice, executionPrice])

  const midPriceFormatted = useMemo(() => {
    if (midPrice <= 0) return '—'
    return formatPrice(midPrice, tokenIn.symbol, tokenOut.symbol)
  }, [midPrice, tokenIn, tokenOut])

  const executionPriceFormatted = useMemo(() => {
    if (executionPrice <= 0) return '—'
    return formatPrice(executionPrice, tokenIn.symbol, tokenOut.symbol)
  }, [executionPrice, tokenIn, tokenOut])

  return (
    <div className="swap-shell">
      <header className="swap-header">
        <div className="swap-brand">
          <div className="swap-logo">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#3b82f6"/>
              <path d="M2 17L12 22L22 17" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1>Uniswap V4 Swap Quote</h1>
        </div>
        <WalletButton />
      </header>

      <main className="swap-card">
        <div className="swap-card-header">
          <h2>Swap</h2>
          <div className="swap-direction">
            <button
              className={direction === 'exactIn' ? 'active' : ''}
              onClick={() => setDirection('exactIn')}
              type="button"
            >
              Exact In
            </button>
            <button
              className={direction === 'exactOut' ? 'active' : ''}
              onClick={() => setDirection('exactOut')}
              type="button"
            >
              Exact Out
            </button>
          </div>
        </div>

        <div className="swap-meta">
          <span className="swap-meta-label">Direction</span>
          <span className="swap-meta-value">
            {tokenIn.symbol} → {tokenOut.symbol}
            <span className="swap-meta-badge">{zeroForOne ? 'zeroForOne = true' : 'zeroForOne = false'}</span>
          </span>
        </div>

        <div className="swap-input-group">
          <div className="swap-input-box">
            <div className="swap-input-top">
              <TokenSelect
                selected={tokenIn}
                onSelect={setTokenIn}
                tokens={TOKENS.filter((t) => t.symbol !== tokenOut.symbol)}
                label={direction === 'exactIn' ? 'You pay' : 'You pay (max)'}
              />
              <div className="swap-balance">
                Balance: —
              </div>
            </div>
            <input
              type="text"
              inputMode="decimal"
              className="swap-amount-input"
              placeholder="0.0"
              value={amountInStr}
              onChange={(e) => {
                const v = e.target.value
                if (/^\d*\.?\d*$/.test(v)) setAmountInStr(v)
              }}
            />
          </div>

          <button className="swap-switch-btn" onClick={handleSwitch} type="button" aria-label="Switch tokens">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M7 16V4M7 4L3 8M7 4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          <div className="swap-input-box">
            <div className="swap-input-top">
              <TokenSelect
                selected={tokenOut}
                onSelect={setTokenOut}
                tokens={TOKENS.filter((t) => t.symbol !== tokenIn.symbol)}
                label={direction === 'exactIn' ? 'You receive' : 'You receive (min)'}
              />
              <div className="swap-balance">
                Balance: —
              </div>
            </div>
            <input
              type="text"
              inputMode="decimal"
              className="swap-amount-input"
              placeholder="0.0"
              readOnly
              value={quoter.amountOut > 0n ? formatTokenAmount(quoter.amountOut, tokenOut.decimals) : ''}
            />
          </div>
        </div>

        <div className="swap-advanced">
          <label className="swap-advanced-label">_sqrtPriceLimitX96 (optional)</label>
          <input
            type="text"
            className="swap-advanced-input"
            placeholder={zeroForOne
              ? TickMath.MIN_SQRT_RATIO.toString()
              : TickMath.MAX_SQRT_RATIO.toString()}
            value={sqrtPriceLimitStr}
            onChange={(e) => {
              const v = e.target.value
              if (/^\d*$/.test(v)) setSqrtPriceLimitStr(v)
            }}
          />
        </div>

        {pool.loading && (
          <div className="swap-loading">Loading pool state...</div>
        )}

        {pool.error && (
          <div className="swap-error">Pool error: {pool.error}</div>
        )}

        {quoter.error && (
          <div className="swap-error">Quoter error: {quoter.error}</div>
        )}

        {(quoter.amountOut > 0n || quoter.loading) && (
          <div className="swap-details">
            <div className="swap-detail-row">
              <span>Expected Output (Quoter)</span>
              <strong className={quoter.loading ? 'muted' : 'accent'}>
                {quoter.loading
                  ? 'Loading...'
                  : `${formatTokenAmount(quoter.amountOut, tokenOut.decimals)} ${tokenOut.symbol}`}
              </strong>
            </div>

            {computedOutput > 0n && (
              <div className="swap-detail-row">
                <span>Expected Output (Computed)</span>
                <strong>
                  {formatTokenAmount(computedOutput, tokenOut.decimals)} {tokenOut.symbol}
                </strong>
              </div>
            )}

            <div className="swap-detail-row">
              <span>Price Impact</span>
              <strong className={priceImpact > 0.01 ? 'danger' : 'success'}>
                {(priceImpact * 100).toFixed(2)}%
              </strong>
            </div>

            <div className="swap-detail-row">
              <span>Mid Price</span>
              <strong>{midPriceFormatted}</strong>
            </div>

            <div className="swap-detail-row">
              <span>Execution Price</span>
              <strong>{executionPriceFormatted}</strong>
            </div>

            <div className="swap-detail-row">
              <span>Pool Liquidity</span>
              <strong>{formatTokenAmount(pool.liquidity, 18)} L</strong>
            </div>

            <div className="swap-detail-row">
              <span>Pool Fee</span>
              <strong>{(pool.fee / 10000).toFixed(2)}%</strong>
            </div>

            <div className="swap-detail-row">
              <span>Gas Estimate</span>
              <strong>{quoter.gasEstimate.toLocaleString()} gas</strong>
            </div>

            <div className="swap-detail-row mono">
              <span>sqrtPriceX96</span>
              <strong>{pool.sqrtPriceX96.toString()}</strong>
            </div>

            <div className="swap-detail-row mono">
              <span>Tick</span>
              <strong>{pool.tick}</strong>
            </div>
          </div>
        )}

        <button className="swap-action-btn" type="button">
          Preview Swap
        </button>
      </main>

      <footer className="swap-footer">
        <p>
          Live pool state via StateView on Arbitrum Sepolia.
          Quotes from V4Quoter via @uniswap/v4-periphery.
          Math via SqrtPriceMath from @uniswap/v3-sdk.
        </p>
      </footer>
    </div>
  )
}
