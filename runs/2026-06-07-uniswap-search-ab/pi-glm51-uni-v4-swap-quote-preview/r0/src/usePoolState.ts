import { useReadContract } from 'wagmi'
import { encodePacked, keccak256 } from 'viem'
import type { Address } from 'viem'
import { poolManagerAbi, POOL_MANAGER_ADDRESSES } from './contracts'
import type { PoolKey } from './pools'

/**
 * Reads pool state from the V4 PoolManager via StateLibrary-equivalent view functions.
 * Uses wagmi's useReadContract to call getSlot0 and getLiquidity.
 */
export function usePoolState(poolKey: PoolKey | null, chainId: number) {
  const poolManager = POOL_MANAGER_ADDRESSES[chainId] as Address | undefined

  // Compute poolId = keccak256(abi.encode(poolKey))
  const poolId: Address | undefined = poolKey
    ? keccak256(
        encodePacked(
          ['address', 'address', 'uint24', 'int24', 'address'],
          [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks],
        ),
      )
    : undefined

  const enabled = !!poolManager && !!poolId

  const slot0Query = useReadContract({
    address: poolManager,
    abi: poolManagerAbi,
    functionName: 'getSlot0',
    args: poolId ? [poolId] : undefined,
    chainId,
    query: { enabled },
  })

  const liquidityQuery = useReadContract({
    address: poolManager,
    abi: poolManagerAbi,
    functionName: 'getLiquidity',
    args: poolId ? [poolId] : undefined,
    chainId,
    query: { enabled },
  })

  const slot0Result = slot0Query.data as
    | readonly [bigint, number, number, number]
    | undefined

  return {
    sqrtPriceX96: slot0Result?.[0],
    tick: slot0Result?.[1],
    liquidity: liquidityQuery.data as bigint | undefined,
    poolId,
    isLoading: slot0Query.isLoading || liquidityQuery.isLoading,
    isError: slot0Query.isError || liquidityQuery.isError,
    error: slot0Query.error ?? liquidityQuery.error,
  }
}
