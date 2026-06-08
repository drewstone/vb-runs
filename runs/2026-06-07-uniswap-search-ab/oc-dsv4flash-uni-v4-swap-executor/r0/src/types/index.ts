import type { PoolKey } from '@uniswap/v4-sdk'

export interface TokenInfo {
  address: string
  symbol: string
  name: string
  decimals: number
  logo?: string
  chainId: number
}

export interface BalanceDelta {
  amount0: bigint
  amount1: bigint
}

export interface SwapState {
  inputToken: TokenInfo | null
  outputToken: TokenInfo | null
  amountIn: string
  amountOut: string
  quotedAmountOut: string
  slippageTolerance: number
  deadline: number
  recipient: string
}

export interface TransactionResult {
  hash: string
  status: 'pending' | 'confirmed' | 'failed'
  blockNumber?: number
  balanceDelta?: BalanceDelta
  amountIn?: string
  amountOut?: string
  quotedAmountOut?: string
  executedPrice?: string
  gasUsed?: string
  realizedSlippage?: number
  quotedSlippage?: number
  timestamp: number
}
