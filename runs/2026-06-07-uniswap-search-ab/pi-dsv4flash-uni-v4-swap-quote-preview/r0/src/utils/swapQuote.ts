import { Pool } from '@uniswap/v4-sdk'
import { CurrencyAmount, Token as SDKToken } from '@uniswap/sdk-core'
import type { SwapQuote } from '../types/index.ts'
import { Q96, MAX_SQRT_PRICE_X96, MIN_SQRT_PRICE_X96 } from './chain.ts'
import JSBI from 'jsbi'

// ---------------------------------------------------------------------------
// Helpers — convert between native JS BigInt and JSBI
// ---------------------------------------------------------------------------

function toJSBI(n: bigint): JSBI {
  return JSBI.BigInt(n.toString())
}

function fromJSBI(n: JSBI): bigint {
  return BigInt(n.toString())
}

// ---------------------------------------------------------------------------
// SDK-based swap quote computation via @uniswap/v4-sdk
// ---------------------------------------------------------------------------

export interface ComputeQuoteParams {
  sqrtPriceX96: bigint
  liquidity: bigint
  tick: number
  amountSpecified: bigint
  zeroForOne: boolean
  exactIn: boolean
  swapFee: number
  tickSpacing: number
  decimalsIn: number
  decimalsOut: number
  tokenInAddress: string
  tokenOutAddress: string
}

/**
 * Compute a swap quote using @uniswap/v4-sdk's Pool class.
 *
 * Pool.getOutputAmount internally calls v3Swap → SqrtPriceMath for the
 * exact amount0Delta / amount1Delta computations.  No direct v3 imports.
 */
export async function computeSwapQuote(params: ComputeQuoteParams): Promise<SwapQuote> {
  const {
    sqrtPriceX96,
    liquidity,
    tick,
    amountSpecified,
    zeroForOne,
    exactIn,
    swapFee,
    tickSpacing,
    decimalsIn,
    decimalsOut,
    tokenInAddress,
    tokenOutAddress,
  } = params

  if (amountSpecified <= 0n) throw new Error('Amount must be positive')

  // Build Currency objects for the Pool constructor.
  // Pool uses sortsBefore to determine currency0/currency1 internally.
  const tokenIn = new SDKToken(8453, tokenInAddress as `0x${string}`, decimalsIn, '', '')
  const tokenOut = new SDKToken(8453, tokenOutAddress as `0x${string}`, decimalsOut, '', '')
  const hooks = '0x0000000000000000000000000000000000000000'

  const v4Pool = new Pool(
    tokenIn,
    tokenOut,
    swapFee,
    tickSpacing,
    hooks,
    toJSBI(sqrtPriceX96),
    toJSBI(liquidity),
    tick,
  )

  // sqrtPriceLimitX96 — bound based on swap direction
  const sqrtPriceLimitX96: bigint = zeroForOne
    ? MIN_SQRT_PRICE_X96  // price decreases when selling token0
    : MAX_SQRT_PRICE_X96  // price increases when selling token1

  // Build input CurrencyAmount
  const inputAmount = CurrencyAmount.fromRawAmount(
    zeroForOne ? tokenIn : tokenOut,
    toJSBI(amountSpecified),
  )

  let amountIn: bigint
  let amountOut: bigint
  let sqrtPriceAfter: bigint

  if (exactIn) {
    // getOutputAmount returns [outputAmount, updatedPool]
    const [output, updatedPool] = await v4Pool.getOutputAmount(inputAmount, toJSBI(sqrtPriceLimitX96))
    amountIn = amountSpecified
    amountOut = fromJSBI(output.quotient)
    sqrtPriceAfter = fromJSBI(updatedPool.sqrtRatioX96)
  } else {
    const [input, updatedPool] = await v4Pool.getInputAmount(inputAmount, toJSBI(sqrtPriceLimitX96))
    amountIn = fromJSBI(input.quotient)
    amountOut = amountSpecified
    sqrtPriceAfter = fromJSBI(updatedPool.sqrtRatioX96)
  }

  // Mid price = (sqrtPrice / 2^96)^2
  const midPriceFloat = (Number(sqrtPriceX96) / Number(Q96)) ** 2

  // Execution price = output / input (decimal-adjusted)
  const amountInAdjusted = Number(amountIn) / 10 ** decimalsIn
  const amountOutAdjusted = Number(amountOut) / 10 ** decimalsOut
  const executionPrice = amountInAdjusted > 0 ? amountOutAdjusted / amountInAdjusted : 0

  // Price impact = |1 - executionPrice / midPrice|
  const priceImpact =
    midPriceFloat > 0
      ? Math.abs(1 - executionPrice / midPriceFloat)
      : 0

  return {
    amountIn,
    amountOut,
    amountInFormatted: amountInAdjusted.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    }),
    amountOutFormatted: amountOutAdjusted.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    }),
    sqrtPriceBefore: sqrtPriceX96,
    sqrtPriceAfter,
    sqrtPriceLimitX96,
    midPrice: midPriceFloat.toFixed(8),
    executionPrice: executionPrice.toFixed(8),
    priceImpactPercent:
      priceImpact < 0.00001
        ? '<0.001%'
        : `${(priceImpact * 100).toFixed(priceImpact < 0.001 ? 4 : priceImpact < 0.1 ? 3 : 2)}%`,
    liquidity,
    tick,
    zeroForOne,
  }
}
