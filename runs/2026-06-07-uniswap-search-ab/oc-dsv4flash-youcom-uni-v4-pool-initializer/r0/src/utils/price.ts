const Q96 = 1n << 96n

export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  const s = Number(sqrtPriceX96) / Number(Q96)
  const price = s * s
  const adjusted = price * 10 ** (decimals0 - decimals1)
  return adjusted
}

export function priceToSqrtPriceX96(price: number, decimals0: number, decimals1: number): bigint {
  const adjusted = price * 10 ** (decimals1 - decimals0)
  const sqrtPrice = Math.sqrt(adjusted)
  return BigInt(Math.round(sqrtPrice * Number(Q96)))
}

export function formatSqrtPriceX96(value: bigint): string {
  return value.toString()
}

export function parseSqrtPriceX96(value: string): bigint {
  try {
    return BigInt(value)
  } catch {
    return 0n
  }
}
