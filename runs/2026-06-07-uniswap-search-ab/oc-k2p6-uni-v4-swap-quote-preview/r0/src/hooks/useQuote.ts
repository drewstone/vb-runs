import { useMemo } from 'react'
import type { SwapQuote, Token, PoolState } from '../types'
import type { PoolKey } from '@uniswap/v4-sdk'
import { useQuoter } from './useQuoter'
import { useSdkQuote } from './useSdkQuote'
import { sqrtPriceX96ToPrice, formatTokenAmount, parseTokenAmount } from '../utils/math'

export function useQuote(
  poolKey: PoolKey | null,
  poolState: PoolState | null,
  tokenIn: Token,
  tokenOut: Token,
  amountInStr: string,
  sqrtPriceLimitX96?: bigint | null,
): SwapQuote | null {
  const amountIn = useMemo(() => {
    if (!amountInStr) return 0n
    return parseTokenAmount(amountInStr, tokenIn.decimals)
  }, [amountInStr, tokenIn.decimals])

  const zeroForOne = useMemo(() => {
    return tokenIn.address.toLowerCase() < tokenOut.address.toLowerCase()
  }, [tokenIn, tokenOut])

  // On-chain V4 Quoter for gasEstimate and baseline amountOut
  const { result: quoterResult, isLoading: quoterLoading, error: quoterError } = useQuoter(
    poolKey,
    amountIn,
    tokenIn.address,
    tokenOut.address,
  )

  // V4 SDK quote with sqrtPriceLimitX96
  const sdkResult = useSdkQuote(
    poolKey,
    poolState,
    tokenIn,
    tokenOut,
    amountInStr,
    sqrtPriceLimitX96 ?? null,
  )

  return useMemo(() => {
    if (!poolState || amountIn === 0n) return null

    const amountOut = sdkResult?.amountOut ?? quoterResult?.amountOut
    if (amountOut === undefined) return null

    const midPrice = sqrtPriceX96ToPrice(poolState.slot0.sqrtPriceX96)
    const displayMidPrice = zeroForOne ? midPrice : 1 / midPrice

    const amountInNum = Number(formatTokenAmount(amountIn, tokenIn.decimals))
    const amountOutNum = Number(formatTokenAmount(amountOut, tokenOut.decimals))
    const executionPrice = amountInNum > 0 ? amountOutNum / amountInNum : 0

    const priceImpact =
      displayMidPrice > 0
        ? Math.abs((displayMidPrice - executionPrice) / displayMidPrice) * 100
        : 0

    return {
      amountIn,
      amountOut,
      amountInHuman: formatTokenAmount(amountIn, tokenIn.decimals),
      amountOutHuman: formatTokenAmount(amountOut, tokenOut.decimals),
      executionPrice,
      midPrice: displayMidPrice,
      priceImpact,
      gasEstimate: quoterResult?.gasEstimate ?? 0n,
      newSqrtPriceX96: sdkResult?.newSqrtPriceX96 ?? 0n,
      quoterError: quoterError,
      isLoading: quoterLoading,
    }
  }, [
    poolState,
    amountIn,
    sdkResult,
    quoterResult,
    zeroForOne,
    tokenIn,
    tokenOut,
    quoterError,
    quoterLoading,
  ])
}
