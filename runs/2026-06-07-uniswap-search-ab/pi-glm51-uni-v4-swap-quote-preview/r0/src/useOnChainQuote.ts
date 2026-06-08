import { useReadContract } from 'wagmi'
import type { Address } from 'viem'
import { v4QuoterAbi, V4_QUOTER_ADDRESSES } from './contracts'
import type { PoolKey } from './pools'

/**
 * Calls V4Quoter.quoteExactInputSingle on-chain.
 *
 * Note: quoteExactInputSingle is NOT a view function (uses try/catch reverts).
 * wagmi's useReadContract sends eth_call which simulates the call.
 *
 * @param sqrtPriceLimitX96  The Q64.96 price limit. 0 = no limit.
 */
export function useOnChainQuote(
  poolKey: PoolKey | null,
  chainId: number,
  zeroForOne: boolean,
  exactAmountRaw: bigint | null,
  _sqrtPriceLimitX96: bigint,
) {
  const quoter = V4_QUOTER_ADDRESSES[chainId] as Address | undefined
  const enabled = !!quoter && !!poolKey && !!exactAmountRaw && exactAmountRaw > 0n

  return useReadContract({
    address: quoter,
    abi: v4QuoterAbi,
    functionName: 'quoteExactInputSingle',
    args: enabled
      ? [
          {
            poolKey: {
              currency0: poolKey!.currency0,
              currency1: poolKey!.currency1,
              fee: poolKey!.fee,
              tickSpacing: poolKey!.tickSpacing,
              hooks: poolKey!.hooks,
            },
            zeroForOne,
            exactAmount: exactAmountRaw!,
            hookData: '0x' as `0x${string}`,
          },
        ]
      : undefined,
    chainId,
    query: {
      enabled,
      retry: 1,
    },
  })
}
