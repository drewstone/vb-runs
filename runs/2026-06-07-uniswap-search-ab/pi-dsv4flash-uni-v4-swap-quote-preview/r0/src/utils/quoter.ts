import { createPublicClient, http, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'
import { QUOTER_ADDRESS, QUOTER_ABI, MAX_SQRT_PRICE_X96, MIN_SQRT_PRICE_X96 } from './chain.ts'

/**
 * A standalone viem public client used for on-chain Quoter reads.
 * Separate from the wagmi config so it can be called outside of React hooks.
 */
const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
})

export interface QuoterParams {
  tokenIn: Address
  tokenOut: Address
  amountIn: bigint
  fee: number
  tickSpacing: number
  zeroForOne: boolean
}

export interface QuoterResult {
  amountOut: bigint
  sqrtPriceX96After: bigint
  initializedTicksCrossed: number
  gasEstimate: bigint
}

/**
 * Call `quoteExactInputSingle` on the real V4 Quoter contract using viem's
 * `readContract`.  Returns the raw on-chain result or `null` on failure.
 */
export async function fetchQuoterQuote(params: QuoterParams): Promise<QuoterResult | null> {
  const { tokenIn, tokenOut, amountIn, fee, tickSpacing, zeroForOne } = params

  const sqrtPriceLimitX96 = zeroForOne ? MIN_SQRT_PRICE_X96 : MAX_SQRT_PRICE_X96

  try {
    const data = await publicClient.readContract({
      address: QUOTER_ADDRESS as Address,
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          tokenIn,
          tokenOut,
          amountIn,
          fee,
          tickSpacing,
          sqrtPriceLimitX96,
          hookData: '0x' as `0x${string}`,
        },
      ],
    })

    return {
      amountOut: data[0] as bigint,
      sqrtPriceX96After: data[1] as bigint,
      initializedTicksCrossed: Number(data[2]),
      gasEstimate: data[3] as bigint,
    }
  } catch (err) {
    console.warn('QuoterV4 readContract failed:', err)
    return null
  }
}
