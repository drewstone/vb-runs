import type { PoolKey as UniswapPoolKey } from '@uniswap/v4-sdk'

export type { UniswapPoolKey as PoolKey }

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
}

export interface Slot0 {
  sqrtPriceX96: bigint
  tick: number
  protocolFee: number
  lpFee: number
}

export interface PoolState {
  slot0: Slot0
  liquidity: bigint
  token0Decimals: number
  token1Decimals: number
}

export interface SwapQuote {
  amountIn: bigint
  amountOut: bigint
  amountInHuman: string
  amountOutHuman: string
  executionPrice: number
  midPrice: number
  priceImpact: number
  gasEstimate: bigint
  newSqrtPriceX96: bigint
  quoterError: string | null
  isLoading: boolean
}
