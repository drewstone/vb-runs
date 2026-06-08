import { encodeSqrtRatioX96 } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'

const Q96 = 1n << 96n

/**
 * Convert sqrtPriceX96 to a human-readable price string.
 * price = (sqrtPriceX96 / 2^96)^2 * (10^decimals1 / 10^decimals0)
 */
export function sqrtPriceX96ToPrice(
  sqrtPriceX96: string,
  decimals0: number,
  decimals1: number,
): string {
  try {
    const sqrt = BigInt(sqrtPriceX96)
    if (sqrt <= 0n) return '0'

    const priceNum = sqrt * sqrt
    const q192 = Q96 * Q96

    const decimalShift = decimals1 - decimals0
    const scaleFactor = 10n ** BigInt(Math.abs(decimalShift))

    let adjusted: bigint
    if (decimalShift >= 0) {
      adjusted = (priceNum * scaleFactor) / q192
    } else {
      adjusted = priceNum / (q192 * scaleFactor)
    }

    if (adjusted === 0n) return '< 0.000001'

    return formatDecimals(adjusted)
  } catch {
    return '\u2014'
  }
}

/**
 * Convert a human-readable price string to sqrtPriceX96.
 * Uses encodeSqrtRatioX96 from @uniswap/v3-sdk.
 */
export function priceToSqrtPriceX96(price: string): string {
  try {
    const clean = price.replace(/,/g, '')
    if (!clean || Number(clean) <= 0) return '0'

    const parts = clean.split('.')
    const intPart = parts[0] || '0'
    const fracPart = (parts[1] || '').padEnd(18, '0').slice(0, 18)
    const decimals = fracPart.length

    const numerator = JSBI.BigInt(intPart + fracPart)
    const denominator = JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(decimals))

    if (JSBI.lessThanOrEqual(numerator, JSBI.BigInt(0))) return '0'

    const result = encodeSqrtRatioX96(numerator, denominator)
    return result.toString()
  } catch {
    return '0'
  }
}

function formatDecimals(value: bigint): string {
  const s = value.toString()
  if (s.length <= 6) {
    const padded = s.padStart(7, '0')
    const intPart = padded.slice(0, padded.length - 6)
    const fracPart = padded.slice(padded.length - 6).replace(/0+$/, '')
    return `${intPart}.${fracPart || '0'}`
  }

  const intPart = s.slice(0, s.length - 6)
  const fracPart = s.slice(s.length - 6).replace(/0+$/, '')
  return `${intPart}.${fracPart || '0'}`
}

/**
 * Format sqrtPriceX96 as a compact hex string for display.
 */
export function formatSqrtPriceX96(value: string): string {
  try {
    const big = BigInt(value)
    if (big === 0n) return '0x0'
    return '0x' + big.toString(16)
  } catch {
    return value
  }
}
