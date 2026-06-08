import { SqrtPriceMath, TickMath, JSBI } from './v4Math'
import { Q96 } from './constants'

export { TickMath }
export { SqrtPriceMath }
export { JSBI }
export { Q96 }

export function getAmount0Delta(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint,
  roundUp = false,
): bigint {
  return jsbiToBigint(
    SqrtPriceMath.getAmount0Delta(
      bigintToJsbi(sqrtPriceAX96),
      bigintToJsbi(sqrtPriceBX96),
      bigintToJsbi(liquidity),
      roundUp,
    ),
  )
}

export function getAmount1Delta(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint,
  roundUp = false,
): bigint {
  return jsbiToBigint(
    SqrtPriceMath.getAmount1Delta(
      bigintToJsbi(sqrtPriceAX96),
      bigintToJsbi(sqrtPriceBX96),
      bigintToJsbi(liquidity),
      roundUp,
    ),
  )
}

export function bigintToJsbi(value: bigint): JSBI {
  return JSBI.BigInt(value.toString())
}

export function jsbiToBigint(value: JSBI): bigint {
  return BigInt(value.toString())
}

export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  const sqrtPrice = Number(sqrtPriceX96.toString()) / 2 ** 96
  return sqrtPrice * sqrtPrice
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals)
  const integerPart = amount / divisor
  const fractionalPart = amount % divisor

  if (fractionalPart === 0n) {
    return integerPart.toString()
  }

  let fractionalStr = fractionalPart.toString().padStart(decimals, '0')
  fractionalStr = fractionalStr.replace(/0+$/, '')

  if (fractionalStr.length === 0) {
    return integerPart.toString()
  }

  return `${integerPart}.${fractionalStr}`
}

export function parseTokenAmount(amountStr: string, decimals: number): bigint {
  const trimmed = amountStr.trim()
  if (!trimmed || trimmed === '.') return 0n

  const [intPart, fracPart = ''] = trimmed.split('.')
  const paddedFrac = fracPart.padEnd(decimals, '0').slice(0, decimals)
  const combined = intPart + paddedFrac

  return BigInt(combined)
}
