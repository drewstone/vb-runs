import { useCallback } from 'react'
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from 'wagmi'
import { parseAbi, type Address } from 'viem'

const PERMIT2_ABI = parseAbi([
  'function approve(address token, address spender, uint160 amount, uint48 expiration) external',
  'function allowance(address owner, address token, address spender) external view returns (uint160 amount, uint48 expiration, uint48 nonce)',
])

const PERMIT2_ADDRESS: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'

export interface Permit2ApprovalParams {
  token: Address
  spender: Address
  amount: bigint
  expiration?: number
}

export function usePermit2Approval() {
  const { address } = useAccount()
  const { writeContract, data: hash, error, isPending } = useWriteContract()
  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash })

  const approve = useCallback(
    (params: Permit2ApprovalParams) => {
      if (!address) return

      const expiration = params.expiration || Math.floor(Date.now() / 1000) + 3600

      writeContract({
        address: PERMIT2_ADDRESS,
        abi: PERMIT2_ABI,
        functionName: 'approve',
        args: [
          params.token,
          params.spender,
          params.amount,
          expiration,
        ],
      })
    },
    [address, writeContract]
  )

  return {
    approve,
    hash,
    receipt,
    error,
    isPending,
    isConfirming,
  }
}
