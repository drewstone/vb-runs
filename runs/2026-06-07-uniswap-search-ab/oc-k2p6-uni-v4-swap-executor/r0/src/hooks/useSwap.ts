import { useState, useCallback } from 'react'
import {
  useWriteContract,
  useAccount,
} from 'wagmi'
import {
  parseAbi,
  decodeEventLog,
  type Address,
  type TransactionReceipt,
} from 'viem'
import { waitForTransactionReceipt } from 'wagmi/actions'
import { config } from '../wagmi'
import {
  encodeV4SwapExactInSingle,
  encodeV4SwapExactIn,
  calculateSlippage,
} from '../utils/v4Swap'
import type { Token, SwapPath } from '../types'

const UNIVERSAL_ROUTER_ABI = parseAbi([
  'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable',
])

const POOL_MANAGER_ABI = parseAbi([
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)',
])

const UNIVERSAL_ROUTER_ADDRESS: Address = '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD'

export interface SwapParams {
  tokenIn: Token
  tokenOut: Token
  amountIn: bigint
  amountOutMinimum: bigint
  path: SwapPath
  deadline: bigint
}

export interface SwapResult {
  txHash: string
  balanceDelta: { amount0: bigint; amount1: bigint }
  amountOut: bigint
  realizedSlippage: number
  gasUsed: bigint
  receipt: TransactionReceipt
}

export function useSwap() {
  const { address } = useAccount()
  const { writeContractAsync, isPending } = useWriteContract()

  const [result, setResult] = useState<SwapResult | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const executeSwap = useCallback(
    async (params: SwapParams): Promise<SwapResult | null> => {
      if (!address) return null

      setIsConfirming(true)
      setError(null)
      setResult(null)

      try {
        let encodedAction: string

        if (params.path.steps.length === 1) {
          const step = params.path.steps[0]
          encodedAction = encodeV4SwapExactInSingle(
            step.poolKey,
            step.zeroForOne,
            params.amountIn,
            params.amountOutMinimum,
            '0x',
          )
        } else {
          encodedAction = encodeV4SwapExactIn(
            params.path,
            params.amountIn,
            params.amountOutMinimum,
            '0x',
          )
        }

        const commands = '0x10'
        const inputs = [encodedAction as `0x${string}`]

        const hash = await writeContractAsync({
          address: UNIVERSAL_ROUTER_ADDRESS,
          abi: UNIVERSAL_ROUTER_ABI,
          functionName: 'execute',
          args: [
            commands as `0x${string}`,
            inputs,
            params.deadline,
          ],
          value: params.tokenIn.address === '0x0000000000000000000000000000000000000000' ? params.amountIn : 0n,
        })

        const receipt = await waitForTransactionReceipt(config, {
          hash,
          confirmations: 1,
        })

        let amount0 = 0n
        let amount1 = 0n

        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: POOL_MANAGER_ABI,
              data: log.data,
              topics: log.topics,
            })
            if (decoded.eventName === 'Swap') {
              amount0 = decoded.args.amount0
              amount1 = decoded.args.amount1
              break
            }
          } catch {
            // not a Swap event, continue
          }
        }

        const balanceDelta = { amount0, amount1 }
        const amountOut = amount1 < 0n ? -amount1 : amount1
        const realizedSlippage = calculateSlippage(params.amountOutMinimum, amountOut)

        const swapResult: SwapResult = {
          txHash: hash,
          balanceDelta,
          amountOut,
          realizedSlippage,
          gasUsed: receipt.gasUsed,
          receipt,
        }

        setResult(swapResult)
        return swapResult
      } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err))
        setError(e)
        throw e
      } finally {
        setIsConfirming(false)
      }
    },
    [address, writeContractAsync]
  )

  return {
    executeSwap,
    result,
    isPending,
    isConfirming,
    error,
  }
}
