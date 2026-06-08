import type { Token } from '@uniswap/sdk-core'

export interface TokenInfo {
  token: Token
  symbol: string
  name: string
  logo?: string
}

export interface PoolState {
  sqrtPriceX96: bigint
  liquidity: bigint
  tick: number
}

export interface SwapQuote {
  amountOut: bigint
  amountOutStr: string
  midPrice: string
  executionPrice: string
  priceImpact: string
  priceImpactRaw: number
  sqrtPriceX96: bigint
  sqrtPriceNextX96: bigint
  liquidity: bigint
  zeroForOne: boolean
  sqrtPriceLimitX96: bigint
}

export interface TokenPair {
  tokenIn: Token
  tokenOut: Token
}
