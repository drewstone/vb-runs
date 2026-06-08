import { useState, useMemo } from 'react'
import type { Token } from '../types'
import type { PoolKey } from '@uniswap/v4-sdk'
import { COMMON_TOKENS } from '../utils/constants'
import { usePoolState } from '../hooks/usePoolState'
import { useQuote } from '../hooks/useQuote'
import { formatTokenAmount } from '../utils/math'
import { MIN_SQRT_PRICE, MAX_SQRT_PRICE } from '../utils/v4Math'
import TokenSelector from './TokenSelector'

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export default function SwapCard() {
  const [tokenInAddress, setTokenInAddress] = useState(COMMON_TOKENS[0].address)
  const [tokenOutAddress, setTokenOutAddress] = useState(COMMON_TOKENS[1].address)
  const [fee, setFee] = useState(3000)
  const [tickSpacing, setTickSpacing] = useState(60)
  const [hooks, setHooks] = useState('0x0000000000000000000000000000000000000000')
  const [amountIn, setAmountIn] = useState('1')
  const [sqrtPriceLimitX96, setSqrtPriceLimitX96] = useState('')
  const [showTokenInSelector, setShowTokenInSelector] = useState(false)
  const [showTokenOutSelector, setShowTokenOutSelector] = useState(false)

  const zeroForOne =
    tokenInAddress.toLowerCase() < tokenOutAddress.toLowerCase()

  const poolKey: PoolKey | null = useMemo(() => {
    if (!isAddress(tokenInAddress) || !isAddress(tokenOutAddress)) return null
    return {
      currency0: tokenInAddress,
      currency1: tokenOutAddress,
      fee,
      tickSpacing,
      hooks,
    }
  }, [tokenInAddress, tokenOutAddress, fee, tickSpacing, hooks])

  const { poolState, isLoading: poolLoading, error: poolError } = usePoolState(poolKey)

  const tokenIn: Token = useMemo(() => {
    const found = COMMON_TOKENS.find(
      (t) => t.address.toLowerCase() === tokenInAddress.toLowerCase(),
    )
    if (found) return found
    return {
      address: tokenInAddress,
      symbol: tokenInAddress.slice(0, 6) + '...' + tokenInAddress.slice(-4),
      name: 'Unknown Token',
      decimals: 18,
    }
  }, [tokenInAddress])

  const tokenOut: Token = useMemo(() => {
    const found = COMMON_TOKENS.find(
      (t) => t.address.toLowerCase() === tokenOutAddress.toLowerCase(),
    )
    if (found) return found
    return {
      address: tokenOutAddress,
      symbol: tokenOutAddress.slice(0, 6) + '...' + tokenOutAddress.slice(-4),
      name: 'Unknown Token',
      decimals: 18,
    }
  }, [tokenOutAddress])

  const parsedSqrtPriceLimit = useMemo(() => {
    if (!sqrtPriceLimitX96.trim()) return null
    try {
      return BigInt(sqrtPriceLimitX96)
    } catch {
      return null
    }
  }, [sqrtPriceLimitX96])

  const quote = useQuote(
    poolKey,
    poolState,
    tokenIn,
    tokenOut,
    amountIn,
    parsedSqrtPriceLimit,
  )

  const setDefaultSqrtPriceLimit = () => {
    const limit = zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE
    setSqrtPriceLimitX96(limit.toString())
  }

  return (
    <div className="swap-container">
      <div className="swap-card">
        <div className="swap-header">
          <h2>Swap</h2>
          <span className="network-badge">Sepolia</span>
        </div>

        <div className="pool-config">
          <div className="pool-config-row">
            <div className="pool-config-field">
              <label>Token In Address</label>
              <input
                type="text"
                value={tokenInAddress}
                onChange={(e) => setTokenInAddress(e.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="pool-config-field">
              <label>Token Out Address</label>
              <input
                type="text"
                value={tokenOutAddress}
                onChange={(e) => setTokenOutAddress(e.target.value)}
                placeholder="0x..."
              />
            </div>
          </div>

          <div className="pool-config-row">
            <div className="pool-config-field">
              <label>Fee (bps)</label>
              <input
                type="number"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
              />
            </div>
            <div className="pool-config-field">
              <label>Tick Spacing</label>
              <input
                type="number"
                value={tickSpacing}
                onChange={(e) => setTickSpacing(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="pool-config-row">
            <div className="pool-config-field">
              <label>Hooks Address</label>
              <input
                type="text"
                value={hooks}
                onChange={(e) => setHooks(e.target.value)}
                placeholder="0x0000...0000"
              />
            </div>
          </div>
        </div>

        <div className="token-input-section">
          <div className="token-input-header">
            <label>You Pay</label>
            <button
              className="token-select-btn-small"
              onClick={() => setShowTokenInSelector(true)}
            >
              {tokenIn.symbol}
            </button>
          </div>
          <div className="token-input-row">
            <input
              type="text"
              className="amount-input"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => {
                const val = e.target.value
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  setAmountIn(val)
                }
              }}
            />
            <span className="token-decimals">{tokenIn.decimals} decimals</span>
          </div>
        </div>

        <button
          className="swap-direction-btn"
          onClick={() => {
            setTokenInAddress(tokenOutAddress)
            setTokenOutAddress(tokenInAddress)
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M10 3V17M10 17L4 11M10 17L16 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <div className="token-input-section">
          <div className="token-input-header">
            <label>You Receive</label>
            <button
              className="token-select-btn-small"
              onClick={() => setShowTokenOutSelector(true)}
            >
              {tokenOut.symbol}
            </button>
          </div>
          <div className="token-input-row">
            <input
              type="text"
              className="amount-input"
              placeholder={quote?.isLoading ? 'Quoting...' : '0.0'}
              value={quote?.amountOutHuman || ''}
              readOnly
            />
            <span className="token-decimals">{tokenOut.decimals} decimals</span>
          </div>
        </div>

        <div className="sqrt-price-limit-section">
          <label>SqrtPriceLimitX96 (optional)</label>
          <div className="sqrt-price-limit-row">
            <input
              type="text"
              className="sqrt-price-limit-input"
              placeholder={`Default: ${zeroForOne ? 'MIN' : 'MAX'} sqrt price`}
              value={sqrtPriceLimitX96}
              onChange={(e) => setSqrtPriceLimitX96(e.target.value)}
            />
            <button
              className="btn-secondary btn-small"
              onClick={setDefaultSqrtPriceLimit}
            >
              Set Default
            </button>
          </div>
        </div>

        {poolLoading && <div className="status-text">Loading pool state...</div>}
        {poolError && <div className="error-text">Pool: {poolError}</div>}
        {quote?.quoterError && <div className="error-text">Quoter: {quote.quoterError}</div>}

        {quote && (
          <div className="quote-details">
            <div className="quote-row">
              <span>Expected Output</span>
              <span className="quote-value">
                {quote.amountOutHuman} {tokenOut.symbol}
              </span>
            </div>
            <div className="quote-row">
              <span>Price Impact</span>
              <span
                className={`quote-value ${
                  quote.priceImpact > 1
                    ? 'impact-high'
                    : quote.priceImpact > 0.1
                      ? 'impact-medium'
                      : 'impact-low'
                }`}
              >
                {quote.priceImpact.toFixed(4)}%
              </span>
            </div>
            <div className="quote-row">
              <span>Mid Price</span>
              <span className="quote-value">
                1 {tokenIn.symbol} = {quote.midPrice.toFixed(6)} {tokenOut.symbol}
              </span>
            </div>
            <div className="quote-row">
              <span>Execution Price</span>
              <span className="quote-value">
                1 {tokenIn.symbol} = {quote.executionPrice.toFixed(6)} {tokenOut.symbol}
              </span>
            </div>
            <div className="quote-row">
              <span>New sqrtPriceX96</span>
              <span className="quote-value">{quote.newSqrtPriceX96.toString()}</span>
            </div>
            <div className="quote-row">
              <span>Gas Estimate</span>
              <span className="quote-value">{quote.gasEstimate.toString()}</span>
            </div>
          </div>
        )}

        {poolState && (
          <div className="pool-state-panel">
            <h4>Pool State</h4>
            <div className="pool-state-grid">
              <div className="pool-state-item">
                <label>sqrtPriceX96</label>
                <span className="pool-state-value">{poolState.slot0.sqrtPriceX96.toString()}</span>
              </div>
              <div className="pool-state-item">
                <label>Tick</label>
                <span className="pool-state-value">{poolState.slot0.tick}</span>
              </div>
              <div className="pool-state-item">
                <label>Liquidity</label>
                <span className="pool-state-value">{formatTokenAmount(poolState.liquidity, 18)}</span>
              </div>
              <div className="pool-state-item">
                <label>LP Fee</label>
                <span className="pool-state-value">{poolState.slot0.lpFee} bps</span>
              </div>
              <div className="pool-state-item">
                <label>Protocol Fee</label>
                <span className="pool-state-value">{poolState.slot0.protocolFee}</span>
              </div>
              <div className="pool-state-item">
                <label>Token0 Decimals</label>
                <span className="pool-state-value">{poolState.token0Decimals}</span>
              </div>
              <div className="pool-state-item">
                <label>Token1 Decimals</label>
                <span className="pool-state-value">{poolState.token1Decimals}</span>
              </div>
            </div>
          </div>
        )}

        <button className="swap-action-btn" disabled>
          Connect Wallet to Swap
        </button>
      </div>

      {showTokenInSelector && (
        <TokenSelector
          selected={tokenIn}
          onSelect={(t) => setTokenInAddress(t.address)}
          onClose={() => setShowTokenInSelector(false)}
          exclude={tokenOut}
        />
      )}
      {showTokenOutSelector && (
        <TokenSelector
          selected={tokenOut}
          onSelect={(t) => setTokenOutAddress(t.address)}
          onClose={() => setShowTokenOutSelector(false)}
          exclude={tokenIn}
        />
      )}
    </div>
  )
}
