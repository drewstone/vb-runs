import { useMemo } from 'react'
import { keccak256, encodeAbiParameters, parseAbiParameters } from 'viem'
import { sepolia } from 'viem/chains'
import { useReadContract } from 'wagmi'
import type { PoolKey } from '@uniswap/v4-sdk'
import { SEPOLIA_QUOTER } from '../utils/constants'

const quoterAbi = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { internalType: 'Currency', name: 'currency0', type: 'address' },
              { internalType: 'Currency', name: 'currency1', type: 'address' },
              { internalType: 'uint24', name: 'fee', type: 'uint24' },
              { internalType: 'int24', name: 'tickSpacing', type: 'int24' },
              { internalType: 'contract IHooks', name: 'hooks', type: 'address' },
            ],
            internalType: 'struct PoolKey',
            name: 'poolKey',
            type: 'tuple',
          },
          { internalType: 'bool', name: 'zeroForOne', type: 'bool' },
          { internalType: 'uint128', name: 'exactAmount', type: 'uint128' },
          { internalType: 'bytes', name: 'hookData', type: 'bytes' },
        ],
        internalType: 'struct IV4Quoter.QuoteExactSingleParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'quoteExactInputSingle',
    outputs: [
      { internalType: 'uint256', name: 'amountOut', type: 'uint256' },
      { internalType: 'uint256', name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

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

export interface QuoterResult {
  amountOut: bigint
  gasEstimate: bigint
  poolId: `0x${string}`
}

export function useQuoter(
  poolKey: PoolKey | null,
  amountIn: bigint,
  tokenInAddress: string,
  tokenOutAddress: string,
) {
  const zeroForOne =
    tokenInAddress.toLowerCase() < tokenOutAddress.toLowerCase()

  const poolId = useMemo(() => (poolKey ? getPoolId(poolKey) : undefined), [poolKey])

  const [currency0, currency1] = useMemo(() => {
    if (!poolKey) return [undefined, undefined]
    return sortAddresses(poolKey.currency0, poolKey.currency1)
  }, [poolKey])

  const args = useMemo(() => {
    if (!poolKey || !currency0 || !currency1) return undefined

    const encodedHookData = '0x' as `0x${string}`

    return [
      {
        poolKey: {
          currency0,
          currency1,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks as `0x${string}`,
        },
        zeroForOne,
        exactAmount: amountIn > 0n ? amountIn : 0n,
        hookData: encodedHookData,
      },
    ] as const
  }, [poolKey, currency0, currency1, zeroForOne, amountIn])

  const { data, isLoading, error, refetch } = useReadContract({
    address: SEPOLIA_QUOTER as `0x${string}`,
    abi: quoterAbi,
    functionName: 'quoteExactInputSingle',
    args,
    chainId: sepolia.id,
    query: {
      enabled: args !== undefined && amountIn > 0n,
    },
  })

  const result: QuoterResult | null = useMemo(() => {
    if (!data || !poolId) return null
    return {
      amountOut: data[0],
      gasEstimate: data[1],
      poolId,
    }
  }, [data, poolId])

  return {
    result,
    isLoading,
    error: error?.message || null,
    refetch,
  }
}
