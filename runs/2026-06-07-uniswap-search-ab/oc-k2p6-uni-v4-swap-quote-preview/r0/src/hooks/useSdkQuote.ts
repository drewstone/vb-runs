import { Token, CurrencyAmount } from '@uniswap/sdk-core'
import { Pool, type PoolKey } from '@uniswap/v4-sdk'
import { useMemo, useState, useEffect } from 'react'
import type { PoolState, Token as AppToken } from '../types'
import { JSBI, MAX_SQRT_PRICE, MIN_SQRT_PRICE } from '../utils/v4Math'
import { parseTokenAmount } from '../utils/math'

export interface SdkQuoteResult {
  amountOut: bigint
  newSqrtPriceX96: bigint
}

export function useSdkQuote(
  poolKey: PoolKey | null,
  poolState: PoolState | null,
  tokenIn: AppToken,
  tokenOut: AppToken,
  amountInStr: string,
  sqrtPriceLimitX96: bigint | null,
): SdkQuoteResult | null {
  const [result, setResult] = useState<SdkQuoteResult | null>(null)

  const amountIn = useMemo(() => {
    if (!amountInStr) return 0n
    return parseTokenAmount(amountInStr, tokenIn.decimals)
  }, [amountInStr, tokenIn.decimals])

  const pool = useMemo(() => {
    if (!poolKey || !poolState) return null

    const currencyA = new Token(
      11155111, // sepolia
      tokenIn.address as `0x${string}`,
      tokenIn.decimals,
      tokenIn.symbol,
      tokenIn.name,
    )
    const currencyB = new Token(
      11155111,
      tokenOut.address as `0x${string}`,
      tokenOut.decimals,
      tokenOut.symbol,
      tokenOut.name,
    )

    try {
      return new Pool(
        currencyA,
        currencyB,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks as `0x${string}`,
        poolState.slot0.sqrtPriceX96.toString(),
        poolState.liquidity.toString(),
        poolState.slot0.tick,
      )
    } catch {
      return null
    }
  }, [poolKey, poolState, tokenIn, tokenOut])

  useEffect(() => {
    if (!pool || amountIn === 0n) {
      setResult(null)
      return
    }

    const zeroForOne =
      tokenIn.address.toLowerCase() < tokenOut.address.toLowerCase()

    const limit = sqrtPriceLimitX96 ?? (zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE)

    const inputAmount = CurrencyAmount.fromRawAmount(
      zeroForOne ? pool.currency0 : pool.currency1,
      amountIn.toString(),
    )

    pool
      .getOutputAmount(inputAmount, JSBI.BigInt(limit.toString()))
      .then(([outputAmount, nextPool]) => {
        setResult({
          amountOut: BigInt(outputAmount.quotient.toString()),
          newSqrtPriceX96: BigInt(nextPool.sqrtRatioX96.toString()),
        })
      })
      .catch(() => {
        setResult(null)
      })
  }, [pool, amountIn, tokenIn, tokenOut, sqrtPriceLimitX96])

  return result
}
