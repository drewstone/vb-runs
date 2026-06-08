import type { PoolConfig } from '../types.ts'
import type { PoolKey } from '@uniswap/v4-sdk'
import { getSortedTokens } from '../utils/tokens.ts'
import { sqrtPriceX96ToPrice } from '../utils/priceCalc.ts'

interface SummaryPanelProps {
  config: PoolConfig
  poolKey: PoolKey | null
}

export function SummaryPanel({ config, poolKey }: SummaryPanelProps) {
  const [token0, token1] = config.token0 && config.token1
    ? getSortedTokens(config.token0, config.token1)
    : [null, null]

  const humanPrice = token0 && token1 && /^\d+$/.test(config.sqrtPriceX96) && BigInt(config.sqrtPriceX96) > 0n
    ? sqrtPriceX96ToPrice(config.sqrtPriceX96, token0.decimals, token1.decimals)
    : '\u2014'

  return (
    <div className="summary-panel">
      <div className="summary-row">
        <span className="summary-key">currency0</span>
        <span className="summary-value">
          {token0 ? `${token0.symbol}` : '\u2014'}
        </span>
      </div>
      <div className="summary-row">
        <span className="summary-key">currency1</span>
        <span className="summary-value">
          {token1 ? `${token1.symbol}` : '\u2014'}
        </span>
      </div>
      <div className="summary-row">
        <span className="summary-key">Pool</span>
        <span className="summary-value">
          {token0 && token1 ? `${token0.symbol} / ${token1.symbol}` : '\u2014'}
        </span>
      </div>
      <div className="summary-row">
        <span className="summary-key">Fee Tier</span>
        <span className="summary-value">
          {config.feeTier ? config.feeTier.label : '\u2014'}
        </span>
      </div>
      <div className="summary-row">
        <span className="summary-key">Tick Spacing</span>
        <span className="summary-value">{config.tickSpacing}</span>
      </div>
      <div className="summary-row">
        <span className="summary-key">Hooks</span>
        <span className="summary-value address">
          {config.hooksAddress === '0x0000000000000000000000000000000000000000'
            ? 'Zero (no hooks)'
            : `${config.hooksAddress.slice(0, 10)}\u2026${config.hooksAddress.slice(-6)}`}
        </span>
      </div>
      <div className="summary-row">
        <span className="summary-key">sqrtPriceX96</span>
        <span className="summary-value" style={{ fontSize: 12 }}>
          {config.sqrtPriceX96.slice(0, 16)}\u2026{config.sqrtPriceX96.slice(-8)}
        </span>
      </div>
      <div className="summary-row">
        <span className="summary-key">Initial Price</span>
        <span className="summary-value accent">
          {humanPrice !== '\u2014' ? `1 ${token0?.symbol} \u2248 ${humanPrice} ${token1?.symbol}` : '\u2014'}
        </span>
      </div>

      {poolKey && (
        <>
          <div className="divider" />
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            <div style={{ marginBottom: 4 }}>Pool Key Parameters</div>
            <div>fee: {poolKey.fee} ({config.feeTier?.label})</div>
            <div>tickSpacing: {poolKey.tickSpacing}</div>
          </div>
        </>
      )}
    </div>
  )
}
