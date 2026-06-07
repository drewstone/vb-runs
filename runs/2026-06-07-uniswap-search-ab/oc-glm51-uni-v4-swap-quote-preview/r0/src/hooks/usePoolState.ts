import { useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import { Token } from '@uniswap/sdk-core'
import { Pool } from '@uniswap/v4-sdk'
import {
  POOL_MANAGER_ADDRESS,
  POOL_MANAGER_ABI,
  ADDRESS_ZERO,
  type TokenInfo,
  type FeeTier,
} from '../lib/constants'

export interface PoolState {
  sqrtPriceX96: bigint
  tick: number
  protocolFee: number
  lpFee: number
  liquidity: bigint
  poolId: string
  zeroForOne: boolean
  token0: TokenInfo
  token1: TokenInfo
}

export function usePoolState(
  tokenA: TokenInfo,
  tokenB: TokenInfo,
  feeTier: FeeTier,
) {
  const sorted = useMemo(() => {
    const isSorted =
      tokenA.address.toLowerCase() < tokenB.address.toLowerCase()
    return {
      token0: isSorted ? tokenA : tokenB,
      token1: isSorted ? tokenB : tokenA,
      zeroForOne: isSorted,
    }
  }, [tokenA, tokenB])

  const poolId = useMemo(() => {
    const t0 = new Token(
      1,
      sorted.token0.address,
      sorted.token0.decimals,
      sorted.token0.symbol,
    )
    const t1 = new Token(
      1,
      sorted.token1.address,
      sorted.token1.decimals,
      sorted.token1.symbol,
    )
    return Pool.getPoolId(t0, t1, feeTier.fee, feeTier.tickSpacing, ADDRESS_ZERO)
  }, [sorted, feeTier])

  const { data, isLoading, error } = useReadContracts({
    contracts: [
      {
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'getSlot0' as const,
        args: [poolId as `0x${string}`],
      },
      {
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'getLiquidity' as const,
        args: [poolId as `0x${string}`],
      },
    ],
  })

  const poolState = useMemo<PoolState | null>(() => {
    if (!data) return null
    const [slot0Result, liquidityResult] = data
    if (slot0Result.status !== 'success' || liquidityResult.status !== 'success')
      return null
    const [sqrtPriceX96, tick, protocolFee, lpFee] = slot0Result.result as [
      bigint,
      number,
      number,
      number,
    ]
    const liquidity = liquidityResult.result as bigint
    if (sqrtPriceX96 === 0n) return null
    return {
      sqrtPriceX96,
      tick,
      protocolFee,
      lpFee,
      liquidity,
      poolId,
      zeroForOne: sorted.zeroForOne,
      token0: sorted.token0,
      token1: sorted.token1,
    }
  }, [data, poolId, sorted])

  return { poolState, isLoading, error, poolId }
}
