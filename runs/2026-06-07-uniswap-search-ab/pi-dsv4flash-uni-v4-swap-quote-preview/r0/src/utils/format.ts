import type { Token } from '../types/index.ts'

const Q96 = 1n << 96n

/** Format a raw token amount (BigInt) into a human-readable decimal string */
export function formatTokenAmount(amount: bigint, decimals: number, maxDecimals?: number): string {
  if (amount === 0n) return '0'
  const negative = amount < 0n
  const abs = negative ? -amount : amount
  const s = abs.toString().padStart(decimals + 1, '0')
  const before = s.slice(0, s.length - decimals) || '0'
  const after = s.slice(s.length - decimals).replace(/0+$/, '')
  const precision = maxDecimals ?? decimals
  const trimmed = after.length > precision ? after.slice(0, precision) : after
  return (negative ? '-' : '') + (trimmed ? `${before}.${trimmed}` : before)
}

/** Format a sqrtPriceX96 to a human-readable price (token1/token0) */
export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint, token0: Token, token1: Token): string {
  if (sqrtPriceX96 === 0n) return '0'
  // price = (sqrtPriceX96 / 2^96)^2
  // But we need to account for token decimals
  // price (in token1 per token0) = (sqrtPriceX96 / 2^96)^2 * 10^(token1.decimals - token0.decimals)
  // = sqrtPriceX96^2 * 10^(token1.decimals) / (2^192 * 10^(token0.decimals))
  const numerator = sqrtPriceX96 * sqrtPriceX96 * 10n ** BigInt(token1.decimals)
  const denominator = Q96 * Q96 * 10n ** BigInt(token0.decimals)
  const price = numerator / denominator
  
  if (price >= 10000n) {
    return formatTokenAmount(numerator, token1.decimals * 2 + 2 * 96, 6)
  }
  if (price >= 1n) {
    const before = (numerator / denominator).toString()
    const after = (numerator % denominator) * 10000n / denominator
    return `${before}.${after.toString().padStart(4, '0')}`
  }
  // Very small prices — show significant fractions
  const withPrecision = numerator * 1000000n / denominator
  return `0.${withPrecision.toString().padStart(6, '0')}`
}

/** Parse a human input string to raw BigInt for a given token */
export function parseTokenAmount(input: string, decimals: number): bigint {
  const cleaned = input.replace(/[,\s]/g, '')
  if (!cleaned || cleaned === '.' || cleaned === '-') return 0n
  
  const negative = cleaned.startsWith('-')
  const absInput = negative ? cleaned.slice(1) : cleaned
  const parts = absInput.split('.')
  const integer = parts[0] || '0'
  const fraction = (parts[1] || '').padEnd(decimals, '0').slice(0, decimals)
  const raw = BigInt(integer + fraction)
  return negative ? -raw : raw
}

/** Format a fractional percent string from a raw fraction (0.05 = 5%) */
export function formatPercent(fraction: number): string {
  if (fraction === 0) return '<0.001%'
  const pct = fraction * 100
  if (pct < 0.001) return '<0.001%'
  if (pct < 1) return pct.toFixed(3) + '%'
  if (pct < 10) return pct.toFixed(2) + '%'
  return pct.toFixed(1) + '%'
}

/** Format a price ratio */
export function formatPriceRatio(price: string): string {
  const num = Number.parseFloat(price)
  if (Number.isNaN(num)) return price
  if (num >= 10000) {
    return num.toExponential(4)
  }
  if (num >= 1) {
    return num.toFixed(6)
  }
  if (num > 0) {
    return num.toFixed(8)
  }
  return '0'
}
