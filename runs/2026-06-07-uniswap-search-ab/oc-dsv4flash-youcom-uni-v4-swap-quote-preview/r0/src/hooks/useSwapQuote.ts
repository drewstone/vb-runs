import { useMemo } from 'react'
import type { Token } from '@uniswap/sdk-core'
import { useReadContract } from 'wagmi'
import { POOL_MANAGER_ADDRESS, POOL_MANAGER_ABI } from '../config'
import { getPoolId, computeSwapQuote } from '../utils/quoteMath'
import type { SwapQuote } from '../types'

export function useSwapQuote(
  tokenIn: Token | null,
  tokenOut: Token | null,
  amountInStr: string,
  sqrtPriceLimitX96: bigint,
): {
  quote: SwapQuote | null
  loading: boolean
  error: Error | null
} {
  const poolId = useMemo(() => {
    if (!tokenIn || !tokenOut) return null
    return getPoolId(tokenIn, tokenOut) as `0x${string}`
  }, [tokenIn, tokenOut])

  const enabled = !!poolId

  const { data: slot0, error: slot0Err, isPending: slot0Loading } = useReadContract({
    address: POOL_MANAGER_ADDRESS,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSlot0',
    args: poolId ? [poolId] : undefined,
    query: { enabled },
  })

  const { data: liquidityRaw, error: liqErr, isPending: liqLoading } = useReadContract({
    address: POOL_MANAGER_ADDRESS,
    abi: POOL_MANAGER_ABI,
    functionName: 'getLiquidity',
    args: poolId ? [poolId] : undefined,
    query: { enabled },
  })

  const error = slot0Err ?? liqErr ?? null

  const quote = useMemo(() => {
    if (!tokenIn || !tokenOut || !amountInStr || parseFloat(amountInStr) <= 0) return null
    if (!slot0 || !liquidityRaw) return null

    const slot = slot0 as readonly [bigint, number, number, number]
    const sqrtPriceX96 = slot[0]
    const liquidity = liquidityRaw as bigint

    const amountDec = parseFloat(amountInStr)
    const amountWei = BigInt(Math.floor(amountDec * 10 ** tokenIn.decimals))

    return computeSwapQuote(sqrtPriceX96, liquidity, amountWei, tokenIn, tokenOut, sqrtPriceLimitX96)
  }, [tokenIn, tokenOut, amountInStr, slot0, liquidityRaw, sqrtPriceLimitX96])

  return { quote, loading: slot0Loading || liqLoading, error }
}
