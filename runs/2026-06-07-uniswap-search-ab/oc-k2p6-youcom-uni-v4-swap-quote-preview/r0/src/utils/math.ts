/**
 * Token formatting and parsing utilities.
 * Uses real SqrtPriceMath from @uniswap/v3-sdk (which @uniswap/v4-sdk depends on internally).
 */
import { SqrtPriceMath } from '@uniswap/v3-sdk'
import JSBI from 'jsbi'

export function toJSBI(n: bigint): JSBI {
  return JSBI.BigInt(n.toString())
}

export function fromJSBI(n: JSBI): bigint {
  return BigInt(n.toString())
}

export function getAmount0Delta(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint,
): bigint {
  return fromJSBI(
    SqrtPriceMath.getAmount0Delta(
      toJSBI(sqrtPriceAX96),
      toJSBI(sqrtPriceBX96),
      toJSBI(liquidity),
      false,
    ),
  )
}

export function getAmount1Delta(
  sqrtPriceAX96: bigint,
  sqrtPriceBX96: bigint,
  liquidity: bigint,
): bigint {
  return fromJSBI(
    SqrtPriceMath.getAmount1Delta(
      toJSBI(sqrtPriceAX96),
      toJSBI(sqrtPriceBX96),
      toJSBI(liquidity),
      false,
    ),
  )
}

export function getNextSqrtPriceFromInput(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  amountIn: bigint,
  zeroForOne: boolean,
): bigint {
  return fromJSBI(
    SqrtPriceMath.getNextSqrtPriceFromInput(
      toJSBI(sqrtPriceX96),
      toJSBI(liquidity),
      toJSBI(amountIn),
      zeroForOne,
    ),
  )
}

export function formatPrice(
  price: number,
  tokenInSymbol: string,
  tokenOutSymbol: string,
): string {
  if (price <= 0 || !Number.isFinite(price)) return '—'
  if (price >= 1) {
    return `1 ${tokenInSymbol} = ${price.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${tokenOutSymbol}`
  }
  return `1 ${tokenOutSymbol} = ${(1 / price).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${tokenInSymbol}`
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const sign = amount < 0 ? '-' : ''
  const abs = amount < 0 ? -amount : amount
  const str = abs.toString().padStart(decimals + 1, '0')
  const intPart = str.slice(0, -decimals) || '0'
  const fracPart = str.slice(-decimals).replace(/0+$/, '')
  if (!fracPart) return `${sign}${intPart}`
  return `${sign}${intPart}.${fracPart}`
}

export function parseTokenAmount(value: string, decimals: number): bigint {
  const [intPart, fracPart = ''] = value.split('.')
  const cleanFrac = fracPart.slice(0, decimals).padEnd(decimals, '0')
  return BigInt(intPart || '0') * BigInt(10) ** BigInt(decimals) + BigInt(cleanFrac)
}
