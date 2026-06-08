import { useState, useMemo } from 'react'
import { useChainId } from 'wagmi'
import { usePoolState } from './usePoolState'
import { useOnChainQuote } from './useOnChainQuote'
import { computeQuote } from './quoteMath'
import type { QuoteResult } from './quoteMath'
import { POOLS, toPoolId } from './pools'
import type { PoolDef } from './pools'
import { POOL_MANAGER_ADDRESSES, V4_QUOTER_ADDRESSES, MIN_SQRT_RATIO, MAX_SQRT_RATIO } from './contracts'
import './App.css'

/* ── Formatting ─────────────────────────────────────────────── */

function fmt(n: number, dec = 6): string {
  if (!isFinite(n) || n === 0) return '0'
  if (Math.abs(n) < 0.000001) return n.toExponential(4)
  if (Math.abs(n) > 1e12) return n.toExponential(4)
  const [intStr, frac] = n.toFixed(dec).split('.')
  const intComma = (intStr ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return frac ? `${intComma}.${frac}` : intComma
}

function fmtBigint(b: bigint): string {
  const s = b.toString()
  return s.length > 18 ? s.slice(0, 6) + '…' + s.slice(-4) : s
}

function impactCls(pct: number): string {
  if (pct < 1) return 'impact-low'
  if (pct < 3) return 'impact-med'
  return 'impact-high'
}

function parseInputToRaw(inputVal: string, decimals: number): bigint | null {
  if (!inputVal || parseFloat(inputVal) <= 0) return null
  const parts = inputVal.split('.')
  const intPart = parts[0] || '0'
  const fracPart = (parts[1] || '').slice(0, decimals)
  const fracPadded = fracPart.padEnd(decimals, '0')
  const raw = BigInt(intPart) * 10n ** BigInt(decimals) + BigInt(fracPadded || '0')
  return raw > 0n ? raw : null
}

/* ── App ─────────────────────────────────────────────────────── */

export default function App() {
  const chainId = useChainId()
  const [poolIdx, setPoolIdx] = useState(0)
  const [reversed, setReversed] = useState(false)
  const [inputVal, setInputVal] = useState('')

  const pool: PoolDef = POOLS[poolIdx]!
  const inputIsToken0 = !reversed

  const inputToken = inputIsToken0
    ? { symbol: pool.token0Symbol, decimals: pool.token0Decimals, color: pool.token0Color, address: pool.token0Address }
    : { symbol: pool.token1Symbol, decimals: pool.token1Decimals, color: pool.token1Color, address: pool.token1Address }
  const outputToken = inputIsToken0
    ? { symbol: pool.token1Symbol, decimals: pool.token1Decimals, color: pool.token1Color, address: pool.token1Address }
    : { symbol: pool.token0Symbol, decimals: pool.token0Decimals, color: pool.token0Color, address: pool.token0Address }

  // Derive zeroForOne from input/output token selection vs pool ordering
  const zeroForOne = inputIsToken0
    ? pool.poolKey.currency0.toLowerCase() === pool.token0Address.toLowerCase()
    : pool.poolKey.currency0.toLowerCase() === pool.token1Address.toLowerCase()

  // sqrtPriceLimitX96: 0 = no limit (used in Quoter params and displayed)
  const sqrtPriceLimitX96 = 0n

  // Read live pool state via wagmi + StateLibrary
  const { sqrtPriceX96, tick, liquidity, isLoading, isError } = usePoolState(
    pool.poolKey,
    chainId,
  )

  // Parse input to raw amount
  const exactAmountRaw = useMemo(
    () => parseInputToRaw(inputVal, inputToken.decimals),
    [inputVal, inputToken.decimals],
  )

  // On-chain quote via V4Quoter.quoteExactInputSingle
  const onChainQuote = useOnChainQuote(
    pool.poolKey,
    chainId,
    zeroForOne,
    exactAmountRaw,
    sqrtPriceLimitX96,
  )

  const onChainData = onChainQuote.data as readonly [bigint, bigint] | undefined
  const onChainAmountOut = onChainData?.[0]
  const onChainGasEstimate = onChainData?.[1]
  const onChainOutputHuman = onChainAmountOut != null
    ? Number(onChainAmountOut) / 10 ** outputToken.decimals
    : null

  // Client-side quote using V4 SqrtPriceMath (pure BigInt, no Pool.getOutputAmount)
  const sdkQuote: QuoteResult | null = useMemo(() => {
    if (!sqrtPriceX96 || !liquidity || tick == null) return null
    return computeQuote(
      sqrtPriceX96,
      liquidity,
      tick,
      inputToken.decimals,
      outputToken.decimals,
      zeroForOne,
      inputVal,
    )
  }, [sqrtPriceX96, liquidity, tick, inputToken.decimals, outputToken.decimals, zeroForOne, inputVal])

  // Derive on-chain price impact from pool mid price vs execution price
  const onChainExecPrice = (onChainOutputHuman != null && parseFloat(inputVal) > 0)
    ? onChainOutputHuman / parseFloat(inputVal)
    : null

  const onChainMidPrice = sqrtPriceX96 != null
    ? (() => {
        const sp = Number(sqrtPriceX96) / (2 ** 96)
        const raw = sp * sp
        return zeroForOne
          ? raw * 10 ** (inputToken.decimals - outputToken.decimals)
          : (1 / raw) * 10 ** (inputToken.decimals - outputToken.decimals)
      })()
    : null

  const onChainPriceImpact = (onChainExecPrice != null && onChainMidPrice != null && onChainMidPrice > 0)
    ? Math.abs((onChainMidPrice - onChainExecPrice) / onChainMidPrice) * 100
    : null

  const hasChain = !!POOL_MANAGER_ADDRESSES[chainId]
  const hasQuoter = !!V4_QUOTER_ADDRESSES[chainId]
  const poolIdHex = useMemo(() => toPoolId(pool.poolKey), [pool.poolKey])

  // Best available output for the big display
  const bestOutput = onChainOutputHuman ?? sdkQuote?.outputHuman ?? null

  return (
    <>
    <div className="bg-gradient" />
    <div className="app-shell">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">V4</div>
          <div>
            <div className="header-title">Swap Quote</div>
            <div className="header-subtitle">Uniswap V4 · V4Quoter + SqrtPriceMath</div>
          </div>
        </div>
        <div className="header-badge">
          {hasChain ? `Chain ${chainId}` : 'Unsupported'}
        </div>
      </header>

      {/* ── Swap Card ─────────────────────────────────────── */}
      <div className="swap-card">
        <div className="swap-card-header">
          <span className="swap-card-title">Swap Preview</span>
          <span className="direction-badge">
            {zeroForOne ? '0→1' : '1→0'}
            {' · '}
            {sqrtPriceLimitX96 === 0n ? 'no limit' : 'limited'}
          </span>
        </div>

        {/* Pool Selector */}
        <div className="pool-selector-wrap">
          <select
            className="pool-selector"
            value={poolIdx}
            onChange={(e) => {
              setPoolIdx(Number(e.target.value))
              setReversed(false)
              setInputVal('')
            }}
            aria-label="Select pool"
          >
            {POOLS.map((p, i) => (
              <option key={p.id} value={i}>
                {p.label} ({p.feeLabel})
              </option>
            ))}
          </select>
        </div>

        {/* Pool Info Bar */}
        <div className="pool-info-bar">
          <span><span className="pool-info-dot" /> Fee: {pool.feeLabel}</span>
          <span>Ticks: {pool.poolKey.tickSpacing}</span>
          <span>Chain: {chainId}</span>
        </div>

        {/* Input Token */}
        <div className="token-input-section">
          <div className="token-input-box">
            <div className="token-selector-btn">
              <span className="token-icon" style={{ background: inputToken.color }}>
                {inputToken.symbol[0]}
              </span>
              <span>{inputToken.symbol}</span>
            </div>
            <input
              type="number"
              className="token-amount-input"
              placeholder="0.0"
              min="0"
              step="any"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              aria-label="Input amount"
            />
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="swap-direction-wrap">
          <button className="swap-direction-btn" onClick={() => setReversed((r) => !r)} aria-label="Swap tokens">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </button>
        </div>

        {/* Output Token */}
        <div className="token-output-section">
          <div className="token-output-box">
            <div className="token-selector-btn">
              <span className="token-icon" style={{ background: outputToken.color }}>
                {outputToken.symbol[0]}
              </span>
              <span>{outputToken.symbol}</span>
            </div>
            <div className={`output-value ${bestOutput != null ? '' : 'empty'}`}>
              {bestOutput != null ? fmt(bestOutput, 8) : '0.0'}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="quote-details">
            <div className="loading-state">
              <span className="loading-spinner" />
              Reading pool state via StateLibrary…
            </div>
          </div>
        )}

        {/* Error States */}
        {isError && !isLoading && (
          <div className="quote-details">
            <div className="error-state">
              ⚠ Failed to read pool state. Pool may not exist on this chain, or RPC unavailable.
            </div>
          </div>
        )}
        {!hasChain && (
          <div className="quote-details">
            <div className="error-state">
              ⚠ No PoolManager on chain {chainId}. Switch to Mainnet, Sepolia, or Base.
            </div>
          </div>
        )}

        {/* ── On-chain Quote (V4Quoter) ────────────────────── */}
        {sqrtPriceX96 != null && inputVal && parseFloat(inputVal) > 0 && (
          <div className="quote-details">
            <div className="quote-details-title">On-Chain Quote · V4Quoter</div>

            {onChainQuote.isLoading && (
              <div className="loading-state">
                <span className="loading-spinner" />
                Calling quoteExactInputSingle…
              </div>
            )}

            {onChainQuote.isError && !onChainQuote.isLoading && (
              <div className="error-state">
                ⚠ Quoter call failed — pool may not have liquidity on this chain.
                {!hasQuoter && ' No V4Quoter deployed on this chain.'}
              </div>
            )}

            {onChainAmountOut != null && (
              <>
                <div className="quote-row">
                  <span className="quote-row-label">Amount Out</span>
                  <span className="quote-row-value highlight">
                    {fmt(onChainOutputHuman!, 8)} {outputToken.symbol}
                  </span>
                </div>

                {/* Execution Price vs Mid Price — side by side */}
                <div className="quote-row">
                  <span className="quote-row-label">Exec Price</span>
                  <span className="quote-row-value">
                    {onChainExecPrice != null
                      ? `1 ${inputToken.symbol} = ${fmt(onChainExecPrice, 8)} ${outputToken.symbol}`
                      : '—'}
                  </span>
                </div>
                <div className="quote-row">
                  <span className="quote-row-label">Mid Price</span>
                  <span className="quote-row-value">
                    {onChainMidPrice != null
                      ? `1 ${inputToken.symbol} = ${fmt(onChainMidPrice, 8)} ${outputToken.symbol}`
                      : '—'}
                  </span>
                </div>

                {/* Price Impact */}
                {onChainPriceImpact != null && (
                  <div className="quote-row">
                    <span className="quote-row-label">Price Impact</span>
                    <span className={`quote-row-value ${impactCls(onChainPriceImpact)}`}>
                      {onChainPriceImpact.toFixed(4)}%
                    </span>
                  </div>
                )}

                <div className="quote-divider" />

                {/* Swap direction & params */}
                <div className="quote-row">
                  <span className="quote-row-label">zeroForOne</span>
                  <span className="quote-row-value">{zeroForOne ? 'true · token0→token1' : 'false · token1→token0'}</span>
                </div>
                <div className="quote-row">
                  <span className="quote-row-label">sqrtPriceLimitX96</span>
                  <span className="quote-row-value">
                    {sqrtPriceLimitX96 === 0n
                      ? '0 (none)'
                      : fmtBigint(sqrtPriceLimitX96)}
                  </span>
                </div>
                {onChainGasEstimate != null && (
                  <div className="quote-row">
                    <span className="quote-row-label">Gas Estimate</span>
                    <span className="quote-row-value">{onChainGasEstimate.toString()}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Client-side Quote (V4 SqrtPriceMath) ─────────── */}
        {sqrtPriceX96 != null && inputVal && parseFloat(inputVal) > 0 && sdkQuote && (
          <div className="quote-details">
            <div className="quote-details-title">Client-side · V4 SqrtPriceMath</div>

            <div className="quote-row">
              <span className="quote-row-label">Amount Out</span>
              <span className="quote-row-value highlight">
                {fmt(sdkQuote.outputHuman, 8)} {outputToken.symbol}
              </span>
            </div>

            {/* Execution Price vs Mid Price */}
            <div className="quote-row">
              <span className="quote-row-label">Exec Price</span>
              <span className="quote-row-value">
                1 {inputToken.symbol} = {fmt(sdkQuote.execPrice, 8)} {outputToken.symbol}
              </span>
            </div>
            <div className="quote-row">
              <span className="quote-row-label">Mid Price</span>
              <span className="quote-row-value">
                1 {inputToken.symbol} = {fmt(sdkQuote.midPrice, 8)} {outputToken.symbol}
              </span>
            </div>

            {/* Price Impact */}
            <div className="quote-row">
              <span className="quote-row-label">Price Impact</span>
              <span className={`quote-row-value ${impactCls(sdkQuote.priceImpact)}`}>
                {sdkQuote.priceImpact.toFixed(4)}%
              </span>
            </div>

            <div className="quote-divider" />

            {/* Pool state from StateLibrary */}
            <div className="quote-row">
              <span className="quote-row-label">sqrtPriceX96</span>
              <span className="quote-row-value">{fmtBigint(sqrtPriceX96)}</span>
            </div>
            <div className="quote-row">
              <span className="quote-row-label">Liquidity</span>
              <span className="quote-row-value">{liquidity ? fmtBigint(liquidity) : '—'}</span>
            </div>
            <div className="quote-row">
              <span className="quote-row-label">Tick</span>
              <span className="quote-row-value">{tick ?? '—'}</span>
            </div>
            <div className="quote-row">
              <span className="quote-row-label">New sqrtPriceX96</span>
              <span className="quote-row-value">{fmtBigint(sdkQuote.newSqrtPriceX96)}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── StateLibrary Code Panel ────────────────────────── */}
      <div className="state-panel">
        <div className="state-panel-title">
          <span className="dot" />
          StateLibrary Read
        </div>
        <div className="code-block">
          <span className="cmt">// Pool: {pool.label} ({pool.feeLabel})</span>
          <br />
          <span className="kw">import</span> {'{'} <span className="fn">StateLibrary</span> {'}'}{' '}
          <span className="kw">from</span> <span className="str">'@uniswap/v4-core'</span>
          <br /><br />
          <span className="kw">const</span> poolKey = {'{'}
          <br />&nbsp;&nbsp;currency0: <span className="str">{pool.poolKey.currency0.slice(0, 10)}…</span>,{' '}
          <span className="cmt">// {pool.token0Symbol}</span>
          <br />&nbsp;&nbsp;currency1: <span className="str">{pool.poolKey.currency1.slice(0, 10)}…</span>,{' '}
          <span className="cmt">// {pool.token1Symbol}</span>
          <br />&nbsp;&nbsp;fee: <span className="num">{pool.poolKey.fee}</span>,
          <br />&nbsp;&nbsp;tickSpacing: <span className="num">{pool.poolKey.tickSpacing}</span>,
          <br />&nbsp;&nbsp;hooks: <span className="str">{pool.poolKey.hooks.slice(0, 10)}…</span>
          <br />{'}'}
          <br />
          <span className="kw">const</span> poolId = <span className="fn">toPoolId</span>(poolKey)
          <br />
          <span className="cmt">// → {poolIdHex.slice(0, 18)}…</span>
          <br /><br />
          <span className="kw">const</span> {'{'} sqrtPriceX96, liquidity, tick {'}'} ={' '}
          <span className="kw">await</span> StateLibrary.<span className="fn">getState</span>(poolManager, poolId)
          <br /><br />
          <span className="cmt">// On-chain:</span>
          <br />
          <span className="cmt">//&nbsp;&nbsp;sqrtPriceX96 = <span className="num">{sqrtPriceX96 ? fmtBigint(sqrtPriceX96) : '…'}</span></span>
          <br />
          <span className="cmt">//&nbsp;&nbsp;liquidity&nbsp;&nbsp;&nbsp; = <span className="num">{liquidity ? fmtBigint(liquidity) : '…'}</span></span>
          <br />
          <span className="cmt">//&nbsp;&nbsp;tick&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; = <span className="num">{tick ?? '…'}</span></span>
        </div>
      </div>

      {/* ── V4Quoter Code Panel ─────────────────────────────── */}
      <div className="state-panel">
        <div className="state-panel-title">
          <span className="dot" />
          V4Quoter.quoteExactInputSingle
        </div>
        <div className="code-block">
          <span className="cmt">// Quoter: {V4_QUOTER_ADDRESSES[chainId]?.slice(0, 10) ?? 'not deployed'}…</span>
          <br />
          <span className="kw">const</span> {'{'} amountOut, gasEstimate {'}'} ={' '}
          <span className="kw">await</span> quoter.<span className="fn">quoteExactInputSingle</span>({'{'}
          <br />&nbsp;&nbsp;poolKey,
          <br />&nbsp;&nbsp;zeroForOne: <span className="num">{zeroForOne ? 'true' : 'false'}</span>,
          <br />&nbsp;&nbsp;exactAmount: <span className="num">{exactAmountRaw?.toString() ?? '0'}</span>,
          <br />&nbsp;&nbsp;hookData: <span className="str">'0x'</span>
          <br />{'}'})
          <br /><br />
          <span className="cmt">// sqrtPriceLimitX96: <span className="num">{sqrtPriceLimitX96.toString()}</span> (0 = no limit)</span>
          <br />
          <span className="cmt">// MIN_SQRT_RATIO = <span className="num">{MIN_SQRT_RATIO.toString()}</span></span>
          <br />
          <span className="cmt">// MAX_SQRT_RATIO = <span className="num">{MAX_SQRT_RATIO.toString()}</span></span>
        </div>
      </div>

      {/* ── SqrtPriceMath Steps ──────────────────────────────── */}
      {sdkQuote && (
        <div className="math-panel">
          <div className="math-panel-title">SqrtPriceMath Steps (V4 Core)</div>
          <div className="code-block">
            <span className="cmt">// Pure BigInt — V4 core SqrtPriceMath.sol formulas</span>
            <br />
            <span className="cmt">// getNextSqrtPriceFromInput / getAmount0Delta / getAmount1Delta</span>
            <br /><br />
            {sdkQuote.steps.map((s, i) => (
              <span key={i}>
                <span className="cmt">// {s.label}:</span>
                <br />
                <span className={s.highlight ? 'step-highlight' : 'step-value'}>{s.value}</span>
                {i < sdkQuote.steps.length - 1 && <br />}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        Uniswap V4 · V4Quoter · SqrtPriceMath · StateLibrary
        <br />
        Live on-chain data via wagmi/viem
      </div>
    </div>
    </>
  )
}
