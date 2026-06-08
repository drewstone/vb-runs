import { useState, useMemo, useCallback } from 'react'
import { useReadContract } from 'wagmi'
import type { SwapQuote, Token } from '../types/index.ts'
import { getPoolTokens, computePoolId } from '../utils/pool.ts'
import { computeSwapQuote } from '../utils/swapQuote.ts'
import { parseTokenAmount } from '../utils/format.ts'
import {
  POOL_MANAGER_ADDRESS,
  POOL_MANAGER_ABI,
} from '../utils/chain.ts'

export interface UseSwapQuoteResult {
  inputToken: Token | null
  outputToken: Token | null
  inputAmount: string
  quote: SwapQuote | null
  quoteError: string | null
  isComputing: boolean
  sqrtPriceX96: bigint | null
  liquidity: bigint | null
  slot0Loading: boolean
  liquidityLoading: boolean
  poolError: string | null
  setInputToken: (t: Token) => void
  setOutputToken: (t: Token) => void
  setInputAmount: (v: string) => void
  swapTokens: () => void
}

// Default fee + tickSpacing for a 0.30% V4 pool
const DEFAULT_FEE = 3000
const DEFAULT_TICK_SPACING = 60
const HOOKS_ADDRESS = '0x0000000000000000000000000000000000000000'

export function useSwapQuote(): UseSwapQuoteResult {
  const [inputToken, setInputToken] = useState<Token | null>(null)
  const [outputToken, setOutputToken] = useState<Token | null>(null)
  const [inputAmount, setInputAmount] = useState('')

  // --- Pool identification ---
  const { poolIdArgs, tokenInIsToken0, tokenDecimalsIn, tokenDecimalsOut } =
    useMemo(() => {
      if (!inputToken || !outputToken) {
        return {
          poolIdArgs: null,
          tokenInIsToken0: true,
          tokenDecimalsIn: 18,
          tokenDecimalsOut: 6,
        }
      }
      const { token0: t0, token1: t1 } = getPoolTokens(inputToken, outputToken)
      const inIs0 =
        inputToken.address.toLowerCase() === t0.address.toLowerCase()
      return {
        poolIdArgs: {
          token0: t0.address as `0x${string}`,
          token1: t1.address as `0x${string}`,
          fee: DEFAULT_FEE,
          tickSpacing: DEFAULT_TICK_SPACING,
          hooks: HOOKS_ADDRESS as `0x${string}`,
        },
        tokenInIsToken0: inIs0,
        tokenDecimalsIn: inputToken.decimals,
        tokenDecimalsOut: outputToken.decimals,
      }
    }, [inputToken, outputToken])

  // PoolId for the on-chain read
  const poolId = useMemo<`0x${string}` | null>(() => {
    if (!poolIdArgs) return null
    return computePoolId(
      poolIdArgs.token0,
      poolIdArgs.token1,
      poolIdArgs.fee,
      poolIdArgs.tickSpacing,
      poolIdArgs.hooks,
    )
  }, [poolIdArgs])

  // --- On-chain reads via wagmi ---
  const slot0Query = useReadContract({
    address: POOL_MANAGER_ADDRESS as `0x${string}`,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSlot0',
    args: poolId ? [poolId] : undefined,
    query: { enabled: poolId !== null },
  })

  const liquidityQuery = useReadContract({
    address: POOL_MANAGER_ADDRESS as `0x${string}`,
    abi: POOL_MANAGER_ABI,
    functionName: 'getLiquidity',
    args: poolId ? [poolId] : undefined,
    query: { enabled: poolId !== null },
  })

  const sqrtPriceX96 = slot0Query.data?.[0] as bigint | undefined ?? null
  const liquidity = liquidityQuery.data as bigint | undefined ?? null

  const poolError: string | null = useMemo(() => {
    if (slot0Query.isError) return `Slot0 read failed: ${(slot0Query.error as Error)?.message ?? 'unknown'}`
    if (liquidityQuery.isError) return `Liquidity read failed: ${(liquidityQuery.error as Error)?.message ?? 'unknown'}`
    return null
  }, [slot0Query.isError, slot0Query.error, liquidityQuery.isError, liquidityQuery.error])

  // --- Quote computation via @uniswap/v4-sdk Pool ---
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [isComputing, setIsComputing] = useState(false)

  const slot0Loaded = !slot0Query.isLoading && !slot0Query.isError && !!sqrtPriceX96 && !!liquidity

  // Fire async quote computation when inputs change
  const stableInputs = JSON.stringify({
    sqrtPriceX96: sqrtPriceX96?.toString(),
    liquidity: liquidity?.toString(),
    inputAmount,
    tokenInAddress: inputToken?.address,
    tokenOutAddress: outputToken?.address,
    tokenInIsToken0,
    tokenDecimalsIn,
    tokenDecimalsOut,
  })

  const tick = slot0Query.data ? (slot0Query.data[1] as number) : 0

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useMemo(() => {
    let cancelled = false

    if (!inputToken || !outputToken || !slot0Loaded || !inputAmount) {
      setQuote(null)
      setQuoteError(null)
      setIsComputing(false)
      return
    }

    const parsed = parseTokenAmount(inputAmount, tokenDecimalsIn)
    if (parsed <= 0n) {
      setQuote(null)
      setQuoteError('Enter an amount above zero')
      setIsComputing(false)
      return
    }

    setIsComputing(true)
    setQuoteError(null)

    computeSwapQuote({
      sqrtPriceX96: sqrtPriceX96!,
      liquidity: liquidity!,
      tick,
      amountSpecified: parsed,
      zeroForOne: tokenInIsToken0,
      exactIn: true,
      swapFee: DEFAULT_FEE,
      tickSpacing: DEFAULT_TICK_SPACING,
      decimalsIn: tokenDecimalsIn,
      decimalsOut: tokenDecimalsOut,
      tokenInAddress: inputToken.address,
      tokenOutAddress: outputToken.address,
    })
      .then((q) => {
        if (!cancelled) {
          setQuote(q)
          setQuoteError(null)
          setIsComputing(false)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQuote(null)
          setQuoteError(err instanceof Error ? err.message : 'Quote computation failed')
          setIsComputing(false)
        }
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stableInputs])

  const handleSetInputToken = useCallback(
    (t: Token) => {
      setInputToken(t)
      if (outputToken?.address === t.address) setOutputToken(null)
    },
    [outputToken],
  )

  const handleSetOutputToken = useCallback(
    (t: Token) => {
      setOutputToken(t)
      if (inputToken?.address === t.address) setInputToken(null)
    },
    [inputToken],
  )

  const swapTokens = useCallback(() => {
    const tmp = inputToken
    setInputToken(outputToken)
    setOutputToken(tmp)
    setInputAmount('')
  }, [inputToken, outputToken])

    return {
    inputToken,
    outputToken,
    inputAmount,
    quote,
    quoteError,
    isComputing,
    sqrtPriceX96,
    liquidity,
    slot0Loading: slot0Query.isLoading,
    liquidityLoading: liquidityQuery.isLoading,
    poolError,
    setInputToken: handleSetInputToken,
    setOutputToken: handleSetOutputToken,
    setInputAmount,
    swapTokens,
  }
}
