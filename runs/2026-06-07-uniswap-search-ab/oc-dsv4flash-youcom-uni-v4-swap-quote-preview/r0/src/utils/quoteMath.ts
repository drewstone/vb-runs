import { Pool } from '@uniswap/v4-sdk'
import type { Token } from '@uniswap/sdk-core'
import type { SwapQuote } from '../types'
import { DEFAULT_FEE, DEFAULT_TICK_SPACING, EMPTY_HOOK } from '../config'

const Q96 = 1n << 96n

function mulDiv(a: bigint, b: bigint, d: bigint, roundUp: boolean): bigint {
  const product = a * b
  const result = product / d
  if (roundUp && product % d !== 0n) return result + 1n
  return result
}

export function getNextSqrtPriceFromInput(
  sqrtP: bigint,
  liquidity: bigint,
  amountIn: bigint,
  zeroForOne: boolean,
): bigint {
  if (zeroForOne) {
    const liqShifted = liquidity << 96n
    const denominator = liqShifted + amountIn * sqrtP
    return mulDiv(liqShifted, sqrtP, denominator, true)
  } else {
    const delta = mulDiv(amountIn, Q96, liquidity, true)
    return sqrtP + delta
  }
}

export function getAmount0Delta(
  sqrtA: bigint,
  sqrtB: bigint,
  liquidity: bigint,
  roundUp: boolean,
): bigint {
  const [lower, upper] = sqrtA < sqrtB ? [sqrtA, sqrtB] : [sqrtB, sqrtA]
  const diff = upper - lower
  const numerator = liquidity * Q96 * diff
  const denominator = upper * lower
  const result = numerator / denominator
  if (roundUp && numerator % denominator !== 0n) return result + 1n
  return result
}

export function getAmount1Delta(
  sqrtA: bigint,
  sqrtB: bigint,
  liquidity: bigint,
  roundUp: boolean,
): bigint {
  const diff = sqrtA >= sqrtB ? sqrtA - sqrtB : sqrtB - sqrtA
  return mulDiv(liquidity, diff, Q96, roundUp)
}

export function getPoolId(tokenIn: Token, tokenOut: Token): string {
  return Pool.getPoolId(tokenIn, tokenOut, DEFAULT_FEE, DEFAULT_TICK_SPACING, EMPTY_HOOK)
}

export function getPoolKey(tokenIn: Token, tokenOut: Token): {
  currency0: string
  currency1: string
  fee: number
  tickSpacing: number
  hooks: string
} {
  return Pool.getPoolKey(tokenIn, tokenOut, DEFAULT_FEE, DEFAULT_TICK_SPACING, EMPTY_HOOK)
}

export function getZeroForOne(tokenIn: Token, tokenOut: Token): boolean {
  const key = getPoolKey(tokenIn, tokenOut)
  const tokenInAddr = tokenIn.wrapped.address.toLowerCase()
  return tokenInAddr === key.currency0.toLowerCase()
}

export function decodeSqrtPriceX96(sqrtPriceX96: bigint): number {
  const priceNum = Number((sqrtPriceX96 * sqrtPriceX96) / Q96)
  return priceNum / Number(Q96)
}

export function computeSwapQuote(
  sqrtPriceX96: bigint,
  liquidity: bigint,
  amountIn: bigint,
  tokenIn: Token,
  tokenOut: Token,
  sqrtPriceLimitX96?: bigint,
): SwapQuote {
  const zeroForOne = getZeroForOne(tokenIn, tokenOut)
  const token0 = zeroForOne ? tokenIn : tokenOut
  const token1 = zeroForOne ? tokenOut : tokenIn

  const sqrtNextX96 = getNextSqrtPriceFromInput(sqrtPriceX96, liquidity, amountIn, zeroForOne)

  const amountOut = zeroForOne
    ? getAmount1Delta(sqrtPriceX96, sqrtNextX96, liquidity, false)
    : getAmount0Delta(sqrtPriceX96, sqrtNextX96, liquidity, false)

  const midPriceT1pT0 = decodeSqrtPriceX96(sqrtPriceX96) * 10 ** (token0.decimals - token1.decimals)

  const amountInDec = Number(amountIn) / 10 ** tokenIn.decimals
  const amountOutDec = Number(amountOut) / 10 ** tokenOut.decimals

  const execPrice = amountOutDec / amountInDec
  const fairPrice = zeroForOne ? midPriceT1pT0 : 1 / midPriceT1pT0

  const priceImpactRaw = fairPrice > 0 ? (execPrice - fairPrice) / fairPrice : 0
  const priceImpact = `${(priceImpactRaw * 100).toFixed(2)}%`

  const fmt = (v: number): string => {
    if (v === 0) return '0'
    if (v < 0.000001) return v.toExponential(4)
    if (v < 1) return v.toPrecision(6)
    if (v >= 10000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 })
    return v.toFixed(4)
  }

  const amountOutStr = amountOutDec < 0.000001
    ? amountOutDec.toExponential(4)
    : amountOutDec < 1
      ? amountOutDec.toPrecision(6)
      : amountOutDec.toLocaleString('en-US', { maximumFractionDigits: 4 })

  return {
    amountOut,
    amountOutStr,
    midPrice: fmt(fairPrice),
    executionPrice: fmt(execPrice),
    priceImpact,
    priceImpactRaw,
    sqrtPriceX96,
    sqrtPriceNextX96: sqrtNextX96,
    liquidity,
    zeroForOne,
    sqrtPriceLimitX96: sqrtPriceLimitX96 ?? 0n,
  }
}
