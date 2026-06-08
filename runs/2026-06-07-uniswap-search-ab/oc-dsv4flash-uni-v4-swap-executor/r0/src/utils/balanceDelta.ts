import type { BalanceDelta } from '../types'

export function decodeBalanceDeltaFromBigInts(
  amount0: bigint,
  amount1: bigint,
  token0Decimals: number,
  token1Decimals: number,
) {
  const abs0 = amount0 < 0n ? -amount0 : amount0
  const abs1 = amount1 < 0n ? -amount1 : amount1
  const sign0 = amount0 >= 0n
  const sign1 = amount1 >= 0n

  const fmt = (val: bigint, decimals: number, positive: boolean): string => {
    const scale = 10n ** BigInt(decimals)
    const intPart = val / scale
    const fracPart = val % scale
    const frac = fracPart.toString().padStart(decimals, '0').replace(/0+$/, '')
    return `${positive ? '+' : '-'}${intPart.toString()}${frac ? '.' + frac : ''}`
  }

  return {
    raw: { amount0, amount1 },
    formatted0: fmt(abs0, token0Decimals, sign0),
    formatted1: fmt(abs1, token1Decimals, sign1),
    netFlow: `${fmt(abs0, token0Decimals, sign0)} / ${fmt(abs1, token1Decimals, sign1)}`,
  }
}

export function computeSlippagePercent(quotedAmount: string, actualAmount: string): number {
  const q = parseFloat(quotedAmount)
  const a = parseFloat(actualAmount)
  if (q === 0) return 0
  return ((a - q) / q) * 100
}

export function bigIntToDecimalString(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals)
  const integer = value / divisor
  const fraction = value % divisor
  const frac = fraction.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${integer.toString()}${frac ? '.' + frac : ''}`
}
