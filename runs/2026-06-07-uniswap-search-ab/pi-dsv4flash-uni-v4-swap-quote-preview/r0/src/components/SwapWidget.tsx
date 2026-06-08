import { useState, useEffect, useMemo, type FC } from 'react'
import { useSwapQuote } from '../hooks/useSwapQuote.ts'
import { TokenSelect } from './TokenSelect.tsx'
import { QuotePreview } from './QuotePreview.tsx'
import { ALL_TOKENS, getPoolTokens } from '../utils/pool.ts'
import { fetchQuoterQuote } from '../utils/quoter.ts'
import { parseTokenAmount } from '../utils/format.ts'

// Default fee + tickSpacing for a 0.30% V4 pool
const DEFAULT_FEE = 3000
const DEFAULT_TICK_SPACING = 60

export const SwapWidget: FC = () => {
  const {
    inputToken,
    outputToken,
    inputAmount,
    quote,
    quoteError,
    isComputing,
    sqrtPriceX96,
    liquidity,
    slot0Loading,
    poolError,
    setInputToken,
    setOutputToken,
    setInputAmount,
    swapTokens,
  } = useSwapQuote()

  const handleAmountChange = (value: string) => {
    if (/^[0-9]*\.?[0-9]*$/.test(value) || value === '') {
      setInputAmount(value)
    }
  }

  // ── Quoter call via viem readContract ──────────────────────────────

  const [quoterAmountOut, setQuoterAmountOut] = useState<string | null>(null)
  const [quoterLoading, setQuoterLoading] = useState(false)

  const quoterKey = useMemo(() => {
    if (!inputToken || !outputToken || !inputAmount) return null
    const parsed = parseTokenAmount(inputAmount, inputToken.decimals)
    if (parsed <= 0n) return null
    const { token0: t0 } = getPoolTokens(inputToken, outputToken)
    const zeroForOne = inputToken.address.toLowerCase() === t0.address.toLowerCase()
    return {
      tokenIn: (zeroForOne ? t0.address : outputToken.address) as `0x${string}`,
      tokenOut: (zeroForOne ? outputToken.address : t0.address) as `0x${string}`,
      amountIn: parsed,
      fee: DEFAULT_FEE,
      tickSpacing: DEFAULT_TICK_SPACING,
      zeroForOne,
      decimals: outputToken.decimals,
    }
  }, [inputToken, outputToken, inputAmount])

  useEffect(() => {
    if (!quoterKey) {
      setQuoterAmountOut(null)
      setQuoterLoading(false)
      return
    }

    let cancelled = false
    setQuoterLoading(true)

    fetchQuoterQuote({
      tokenIn: quoterKey.tokenIn,
      tokenOut: quoterKey.tokenOut,
      amountIn: quoterKey.amountIn,
      fee: quoterKey.fee,
      tickSpacing: quoterKey.tickSpacing,
      zeroForOne: quoterKey.zeroForOne,
    })
      .then((result) => {
        if (!cancelled) {
          if (result) {
            const formatted = (Number(result.amountOut) / 10 ** quoterKey.decimals).toLocaleString(
              'en-US',
              { minimumFractionDigits: 0, maximumFractionDigits: 8 },
            )
            setQuoterAmountOut(formatted)
          } else {
            setQuoterAmountOut(null)
          }
          setQuoterLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuoterAmountOut(null)
          setQuoterLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [quoterKey])

  return (
    <div className="swap-widget">
      <div className="swap-header">
        <h2>Swap</h2>
        <div className="swap-header-badge">V4 SDK</div>
      </div>

      {/* You Pay */}
      <div className="swap-section">
        <div className="swap-section-label">You pay</div>
        <div className="swap-input-row">
          <input
            type="text"
            className="swap-amount-input"
            placeholder="0.0"
            inputMode="decimal"
            autoComplete="off"
            value={inputAmount}
            onChange={(e) => handleAmountChange(e.target.value)}
          />
          <TokenSelect
            tokens={ALL_TOKENS}
            selected={inputToken}
            onChange={setInputToken}
            label="Input token"
          />
        </div>
      </div>

      {/* Swap direction */}
      <div className="swap-direction">
        <button
          type="button"
          className="swap-direction-btn"
          onClick={swapTokens}
          aria-label="Switch input and output tokens"
          disabled={!inputToken && !outputToken}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M11 1L14 4M14 4L11 7M14 4H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 9L2 12M2 12L5 15M2 12H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* You Receive */}
      <div className="swap-section">
        <div className="swap-section-label">You receive</div>
        <div className="swap-input-row">
          <div className="swap-amount-display">
            {quote && inputToken && outputToken ? (
              <span className="swap-amount-value">{quote.amountOutFormatted}</span>
            ) : (
              <span className="swap-amount-placeholder">0.0</span>
            )}
          </div>
          <TokenSelect
            tokens={ALL_TOKENS.filter((t) => t.address !== inputToken?.address)}
            selected={outputToken}
            onChange={setOutputToken}
            label="Output token"
          />
        </div>
      </div>

      {/* Chain connection status */}
      {poolError && (
        <div className="swap-chain-status">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#F59E0B" strokeWidth="1.3" />
            <path d="M7 4V7.5" stroke="#F59E0B" strokeWidth="1.3" strokeLinecap="round" />
            <circle cx="7" cy="10" r="0.7" fill="#F59E0B" />
          </svg>
          <span>{poolError}</span>
        </div>
      )}

      {/* Quote preview — SDK math */}
      {quote && inputToken && outputToken && (
        <QuotePreview
          quote={quote}
          inputToken={inputToken}
          outputToken={outputToken}
        />
      )}

      {/* Quoter contract result — viem readContract on the real Quoter */}
      {quoterAmountOut && (
        <div className="quoter-result">
          <div className="quoter-header">
            <span className="quoter-badge">V4 Quoter</span>
            <span className="quoter-label">viem readContract · {QUOTER_ADDRESS_SHORT}</span>
          </div>
          <div className="quoter-amount">
            <span className="quoter-value">{quoterAmountOut}</span>
            <span className="quoter-token">{outputToken?.symbol}</span>
          </div>
        </div>
      )}

      {quoterLoading && !quoterAmountOut && quote && (
        <div className="swap-empty-state">
          <p>Quoter RPC call in progress...</p>
        </div>
      )}

      {/* Loading */}
      {slot0Loading && inputToken && outputToken && (
        <div className="swap-empty-state">
          <p>Reading pool state from chain...</p>
        </div>
      )}

      {/* Computing */}
      {isComputing && !slot0Loading && (
        <div className="swap-empty-state">
          <p>Computing quote...</p>
        </div>
      )}

      {/* Error */}
      {quoteError && (
        <div className="swap-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="#EF4444" strokeWidth="1.5" />
            <path d="M5.5 5.5L10.5 10.5M10.5 5.5L5.5 10.5" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>{quoteError}</span>
        </div>
      )}

      {/* Empty / idle */}
      {!quote && !quoteError && !slot0Loading && !isComputing && !poolError && inputToken && outputToken && !inputAmount && (
        <div className="swap-empty-state">
          {sqrtPriceX96 && liquidity ? (
            <p>Enter an amount to preview your swap</p>
          ) : (
            <p>Waiting for pool state...</p>
          )}
        </div>
      )}

      {!inputToken && !outputToken && (
        <div className="swap-empty-state">
          <p>Select tokens to get started</p>
        </div>
      )}
    </div>
  )
}

// Short Quoter address for display
const QUOTER_ADDRESS_SHORT = '0x339D...9e496'
