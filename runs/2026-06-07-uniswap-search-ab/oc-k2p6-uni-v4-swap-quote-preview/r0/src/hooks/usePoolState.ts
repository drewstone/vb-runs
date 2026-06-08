import { useMemo } from 'react'
import { erc20Abi, keccak256, encodeAbiParameters, parseAbiParameters } from 'viem'
import { sepolia } from 'viem/chains'
import { useReadContracts } from 'wagmi'
import type { PoolKey } from '@uniswap/v4-sdk'
import type { PoolState } from '../types'
import { SEPOLIA_POOL_MANAGER } from '../utils/constants'

function sortAddresses(a: string, b: string): [`0x${string}`, `0x${string}`] {
  const lowerA = a.toLowerCase()
  const lowerB = b.toLowerCase()
  return lowerA < lowerB
    ? [(a as `0x${string}`), (b as `0x${string}`)]
    : [(b as `0x${string}`), (a as `0x${string}`)]
}

function getPoolId(poolKey: PoolKey): `0x${string}` {
  const [currency0, currency1] = sortAddresses(poolKey.currency0, poolKey.currency1)
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address, address, uint24, int24, address'), [
      currency0,
      currency1,
      poolKey.fee,
      poolKey.tickSpacing,
      poolKey.hooks as `0x${string}`,
    ]),
  )
}

const poolManagerAbi = [
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'getSlot0',
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint16' },
      { name: 'lpFee', type: 'uint24' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'getLiquidity',
    outputs: [{ name: '', type: 'uint128' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export function usePoolState(poolKey: PoolKey | null) {
  const poolId = useMemo(() => (poolKey ? getPoolId(poolKey) : undefined), [poolKey])

  const [currency0, currency1] = useMemo(() => {
    if (!poolKey) return [undefined, undefined]
    return sortAddresses(poolKey.currency0, poolKey.currency1)
  }, [poolKey])

  const contracts = useMemo(() => {
    if (!poolKey || !poolId || !currency0 || !currency1) return undefined

    return [
      {
        address: SEPOLIA_POOL_MANAGER as `0x${string}`,
        abi: poolManagerAbi,
        functionName: 'getSlot0' as const,
        args: [poolId],
        chainId: sepolia.id,
      },
      {
        address: SEPOLIA_POOL_MANAGER as `0x${string}`,
        abi: poolManagerAbi,
        functionName: 'getLiquidity' as const,
        args: [poolId],
        chainId: sepolia.id,
      },
      {
        address: currency0,
        abi: erc20Abi,
        functionName: 'decimals' as const,
        chainId: sepolia.id,
      },
      {
        address: currency1,
        abi: erc20Abi,
        functionName: 'decimals' as const,
        chainId: sepolia.id,
      },
    ] as const
  }, [poolKey, currency0, currency1])

  const { data, isLoading, error, refetch } = useReadContracts({
    contracts,
    query: {
      enabled: contracts !== undefined,
    },
  })

  const poolState: PoolState | null = useMemo(() => {
    if (!data || data.length < 4) return null

    const slot0Result = data[0]
    const liquidityResult = data[1]
    const decimals0Result = data[2]
    const decimals1Result = data[3]

    if (
      slot0Result.status !== 'success' ||
      liquidityResult.status !== 'success' ||
      decimals0Result.status !== 'success' ||
      decimals1Result.status !== 'success'
    ) {
      return null
    }

    const slot0Data = slot0Result.result as [bigint, number, number, number]

    return {
      slot0: {
        sqrtPriceX96: slot0Data[0],
        tick: slot0Data[1],
        protocolFee: slot0Data[2],
        lpFee: slot0Data[3],
      },
      liquidity: liquidityResult.result as bigint,
      token0Decimals: decimals0Result.result as number,
      token1Decimals: decimals1Result.result as number,
    }
  }, [data])

  return {
    poolState,
    isLoading,
    error: error?.message || null,
    refetch,
  }
}
