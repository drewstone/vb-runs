// @uniswap/v4-sdk does not publicly re-export the low-level math libraries it uses
// internally; they live in @uniswap/v3-sdk (the same SqrtPriceMath/TickMath). This
// module surfaces them as the V4 math primitives used by the rest of the app.
export { SqrtPriceMath, TickMath } from '@uniswap/v3-sdk'
export { default as JSBI } from 'jsbi'

// TickMath.MIN_SQRT_RATIO + 1 / TickMath.MAX_SQRT_RATIO - 1 mirrors the default
// sqrtPriceLimitX96 values used by the V4Quoter contract.
export const MIN_SQRT_PRICE = 4295128739n + 1n
export const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n - 1n
