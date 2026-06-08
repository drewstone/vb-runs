import type { Address } from 'viem'

export interface TokenInfo {
  symbol: string
  name: string
  address: Address
  decimals: number
  color: string
}

export interface PoolKey {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

export interface FlowStep {
  id: string
  label: string
  description: string
  detail?: string
  status: 'pending' | 'active' | 'done' | 'error'
}

export interface DecodedDelta {
  amount0: bigint
  amount1: bigint
  amount0Formatted: string
  amount1Formatted: string
  isAmount0Negative: boolean
  isAmount1Negative: boolean
  hex: string
}

export interface SwapResult {
  amountIn: string
  amountInFormatted: string
  tokenInSymbol: string
  tokenOutSymbol: string
  quotedAmountOut: string
  quotedAmountOutFormatted: string
  amountOutMinimum: string
  amountOutMinimumFormatted: string
  actualAmountOut: bigint
  actualAmountOutFormatted: string
  executedPrice: string
  realizedSlippage: number
  balanceDelta: DecodedDelta
  gasUsed: bigint | null
  gasUsedFormatted: string
  txHash: Address | null
  approvalTxHash: Address | null
  txStatus: 'pending' | 'confirmed' | 'failed' | null
}

export const UNIVERSAL_ROUTER_ADDRESS: Address = '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD'
export const PERMIT2_ADDRESS: Address = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
