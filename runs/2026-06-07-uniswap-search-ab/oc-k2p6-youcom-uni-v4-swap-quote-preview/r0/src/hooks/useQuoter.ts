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

const quoterAbi = parseAbi([
  'function quoteExactInputSingle((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) poolKey, bool zeroForOne, uint128 exactAmount, bytes hookData) external returns (uint256 amountOut, uint256 gasEstimate)',
])

export interface QuoterResult {
  amountOut: bigint
  gasEstimate: bigint
  loading: boolean
  error: string | null
}

export function useQuoter(
  tokenIn: Token,
  tokenOut: Token,
  amountIn: bigint,
  zeroForOne: boolean,
  sqrtPriceLimitX96: bigint,
): QuoterResult {
  const [result, setResult] = useState<QuoterResult>({
    amountOut: 0n,
    gasEstimate: 0n,
    loading: false,
    error: null,
  })

  const fetchQuote = useCallback(async () => {
    if (amountIn <= 0n) {
      setResult({ amountOut: 0n, gasEstimate: 0n, loading: false, error: null })
      return
    }

    setResult((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const [currency0, currency1] = zeroForOne
        ? [tokenIn.address, tokenOut.address]
        : [tokenOut.address, tokenIn.address]

      const poolKey: PoolKey = {
        currency0,
        currency1,
        fee: 500,
        tickSpacing: 10,
        hooks: '0x0000000000000000000000000000000000000000',
      }

      const res = await client.readContract({
        address: ADDRESSES.v4Quoter,
        abi: quoterAbi,
        functionName: 'quoteExactInputSingle',
        args: [poolKey, zeroForOne, amountIn, '0x'],
      }) as [bigint, bigint]
      const [amountOut, gasEstimate] = res

      setResult({ amountOut, gasEstimate, loading: false, error: null })
    } catch (err) {
      setResult({
        amountOut: 0n,
        gasEstimate: 0n,
        loading: false,
        error: err instanceof Error ? err.message : 'Quoter failed',
      })
    }
  }, [tokenIn, tokenOut, amountIn, zeroForOne, sqrtPriceLimitX96])

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchQuote()
    }, 300)
    return () => clearTimeout(timeout)
  }, [fetchQuote])

  return result
}
