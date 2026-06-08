/** ERC20 token metadata */
export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logo?: string
}

/** Direction of the swap */
export type SwapDirection = 'exactIn' | 'exactOut'

/** A quote result from the pool */
export interface SwapQuote {
  /** Amount in, in raw (non-decimal) units */
  amountIn: bigint
  /** Amount out, in raw (non-decimal) units */
  amountOut: bigint
  /** Formatted amount in (decimal string) */
  amountInFormatted: string
  /** Formatted amount out (decimal string) */
  amountOutFormatted: string
  /** The sqrtPrice before the swap */
  sqrtPriceBefore: bigint
  /** The sqrtPrice after the swap */
  sqrtPriceAfter: bigint
  /** sqrtPriceLimitX96 — price bound for the swap direction */
  sqrtPriceLimitX96: bigint
  /** Mid price (from current sqrtPrice) as decimal string */
  midPrice: string
  /** Execution price (amountOut / amountIn) as decimal string */
  executionPrice: string
  /** Price impact as percentage string */
  priceImpactPercent: string
  /** Liquidity used */
  liquidity: bigint
  /** Effective tick if applicable */
  tick: number
  /** swap direction: true when selling token0 */
  zeroForOne: boolean
}

/** Pool state as read from a Uniswap V4 Pool */
export interface PoolState {
  sqrtPriceX96: bigint
  liquidity: bigint
  tick: number
  token0: Token
  token1: Token
  fee: number
  tickSpacing: number
}

/** A token option for the selector dropdowns */
export interface TokenOption {
  token: Token
  pool?: PoolState
}
