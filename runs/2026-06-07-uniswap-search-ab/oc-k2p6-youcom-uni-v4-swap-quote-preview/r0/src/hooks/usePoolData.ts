import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, parseAbi } from 'viem'
import { arbitrumSepolia } from 'viem/chains'
import type { Token } from '../utils/tokens'
import type { PoolKey } from '@uniswap/v4-sdk'
import { ADDRESSES, RPC_URL } from '../config'

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(RPC_URL),
})

const stateViewAbi = parseAbi([
  'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) external view returns (uint128 liquidity)',
])

export interface PoolData {
  poolKey: PoolKey
  sqrtPriceX96: bigint
  liquidity: bigint
  tick: number
  fee: number
  token0: string
  token1: string
  loading: boolean
  error: string | null
}

function sortsBefore(a: string, b: string): boolean {
  return a.toLowerCase() < b.toLowerCase()
}

export function usePoolData(tokenIn: Token, tokenOut: Token): PoolData {
  const [poolData, setPoolData] = useState<PoolData>({
    poolKey: {
      currency0: '0x0000000000000000000000000000000000000000',
      currency1: '0x0000000000000000000000000000000000000000',
      fee: 0,
      tickSpacing: 0,
      hooks: '0x0000000000000000000000000000000000000000',
    },
    sqrtPriceX96: 0n,
    liquidity: 0n,
    tick: 0,
    fee: 0,
    token0: '',
    token1: '',
    loading: true,
    error: null,
  })

  const fetchPoolData = useCallback(async () => {
    setPoolData((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const { Pool } = await import('@uniswap/v4-sdk')

      const [currency0, currency1] = sortsBefore(tokenIn.address, tokenOut.address)
        ? [tokenIn.address, tokenOut.address]
        : [tokenOut.address, tokenIn.address]

      const poolKey: PoolKey = {
        currency0,
        currency1,
        fee: 500,
        tickSpacing: 10,
        hooks: '0x0000000000000000000000000000000000000000',
      }

      const poolId = Pool.getPoolId(
        { address: poolKey.currency0, isNative: poolKey.currency0 === '0x0000000000000000000000000000000000000000' } as any,
        { address: poolKey.currency1, isNative: poolKey.currency1 === '0x0000000000000000000000000000000000000000' } as any,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      )

      const [slot0, liquidity] = await Promise.all([
        client.readContract({
          address: ADDRESSES.stateView,
          abi: stateViewAbi,
          functionName: 'getSlot0',
          args: [poolId as `0x${string}`],
        }),
        client.readContract({
          address: ADDRESSES.stateView,
          abi: stateViewAbi,
          functionName: 'getLiquidity',
          args: [poolId as `0x${string}`],
        }),
      ])

      setPoolData({
        poolKey,
        sqrtPriceX96: slot0[0],
        liquidity,
        tick: slot0[1],
        fee: slot0[3],
        token0: poolKey.currency0,
        token1: poolKey.currency1,
        loading: false,
        error: null,
      })
    } catch (err) {
      setPoolData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch pool data',
      }))
    }
  }, [tokenIn, tokenOut])

  useEffect(() => {
    fetchPoolData()
  }, [fetchPoolData])

  return poolData
}
