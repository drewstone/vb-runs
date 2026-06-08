import JSBI from 'jsbi'

const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))

function bigintSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('negative')
  if (n < 2n) return n
  let lo = 1n
  let hi = n
  while (lo <= hi) {
    const mid = (lo + hi) / 2n
    const sq = mid * mid
    if (sq === n) return mid
    if (sq < n) lo = mid + 1n
    else hi = mid - 1n
  }
  return hi
}

export function encodeSqrtRatioX96(amount1: bigint, amount0: bigint): JSBI {
  const numerator = JSBI.BigInt(amount1.toString())
  const denominator = JSBI.BigInt(amount0.toString())
  const ratio = JSBI.divide(JSBI.multiply(numerator, Q96), denominator)
  const sqrtRatio = bigintSqrt(BigInt(ratio.toString()))
  return JSBI.BigInt(sqrtRatio.toString())
}

export function decodeSqrtRatioX96(sqrtPriceX96: bigint, decimals0: number, decimals1: number): string {
  const Q96B = 2n ** 96n
  const numerator = sqrtPriceX96 * sqrtPriceX96 * 10n ** BigInt(decimals0)
  const denominator = Q96B * Q96B * 10n ** BigInt(decimals1)
  const scaled = (numerator * 10n ** 18n) / denominator
  const str = scaled.toString().padStart(19, '0')
  const intPart = str.slice(0, -18) || '0'
  const fracPart = str.slice(-18).replace(/0+$/, '')
  return fracPart ? `${intPart}.${fracPart}` : intPart
}

export { Q96 }
