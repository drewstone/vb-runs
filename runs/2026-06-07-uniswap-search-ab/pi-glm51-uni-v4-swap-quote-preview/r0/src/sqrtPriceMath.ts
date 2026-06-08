/**
 * SqrtPriceMath — pure BigInt implementation of Uniswap V4 core math.
 *
 * These are the exact formulas from v4-core/src/libraries/SqrtPriceMath.sol,
 * re-implemented in TypeScript using native BigInt for precision.
 * No dependency on @uniswap/v3-sdk — this is the V4 math directly.
 *
 * References:
 *   https://github.com/Uniswap/v4-core/blob/main/src/libraries/SqrtPriceMath.sol
 *   https://docs.uniswap.org/contracts/v4/reference/core/libraries/SqrtPriceMath
 */

const Q96 = 2n ** 96n

// ─── getNextSqrtPriceFromInput ────────────────────────────────
// Given an input amount, compute the new sqrt price after the swap.
// zeroForOne=true  → price decreases (token0 in, token1 out)
// zeroForOne=false → price increases (token1 in, token0 out)

export function getNextSqrtPriceFromInput(
  sqrtPX96: bigint,
  liquidity: bigint,
  amountIn: bigint,
  zeroForOne: boolean,
): bigint {
  if (amountIn === 0n) return sqrtPX96
  return zeroForOne
    ? getNextSqrtPriceFromAmount0RoundingUp(sqrtPX96, liquidity, amountIn, false)
    : getNextSqrtPriceFromAmount1RoundingDown(sqrtPX96, liquidity, amountIn, true)
}

// ─── getAmount0Delta ──────────────────────────────────────────
// Amount of token0 between two sqrt prices.
// liquidity * (sqrtBX96 - sqrtAX96) / (sqrtAX96 * sqrtBX96)  [rounded]

export function getAmount0Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
  roundUp: boolean,
): bigint {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }
  const numerator1 = liquidity << 96n
  const numerator2 = sqrtRatioBX96 - sqrtRatioAX96
  if (roundUp) {
    // ceil(numerator1 * numerator2 / (sqrtRatioAX96 * sqrtRatioBX96))
    const product = numerator1 * numerator2
    const denominator = sqrtRatioAX96 * sqrtRatioBX96
    return (product + denominator - 1n) / denominator
  }
  return (numerator1 * numerator2) / (sqrtRatioAX96 * sqrtRatioBX96)
}

// ─── getAmount1Delta ──────────────────────────────────────────
// Amount of token1 between two sqrt prices.
// liquidity * (sqrtBX96 - sqrtAX96) / Q96  [rounded]

export function getAmount1Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
  roundUp: boolean,
): bigint {
  if (sqrtRatioAX96 > sqrtRatioBX96) {
    ;[sqrtRatioAX96, sqrtRatioBX96] = [sqrtRatioBX96, sqrtRatioAX96]
  }
  if (roundUp) {
    return (liquidity * (sqrtRatioBX96 - sqrtRatioAX96) + Q96 - 1n) / Q96
  }
  return (liquidity * (sqrtRatioBX96 - sqrtRatioAX96)) / Q96
}

// ─── Internal helpers ─────────────────────────────────────────

// Get next sqrt price from a change in token0 amount.
// add=false when swapping token0 in (price goes down), add=true when removing.
function getNextSqrtPriceFromAmount0RoundingUp(
  sqrtPX96: bigint,
  liquidity: bigint,
  amount: bigint,
  add: boolean,
): bigint {
  const numerator1 = liquidity << 96n
  if (add) {
    const product = amount * sqrtPX96
    const denominator = numerator1 + product
    // mulDivRoundingUp: ceil(numerator1 * sqrtPX96 / denominator)
    return divRoundingUp(numerator1 * sqrtPX96, denominator)
  } else {
    const product = amount * sqrtPX96
    const denominator = numerator1 - product
    // mulDivRoundingUp: ceil(numerator1 * sqrtPX96 / denominator)
    return divRoundingUp(numerator1 * sqrtPX96, denominator)
  }
}

// Get next sqrt price from a change in token1 amount.
// add=true when swapping token1 in (price goes up).
function getNextSqrtPriceFromAmount1RoundingDown(
  sqrtPX96: bigint,
  _liquidity: bigint,
  amount: bigint,
  add: boolean,
): bigint {
  // sqrtPX96 + (amount / liquidity)  [rounded down]  — when adding
  // sqrtPX96 - (amount / liquidity)  [rounded down]  — when removing
  if (add) {
    return sqrtPX96 + (amount << 96n) / _liquidity
  } else {
    return sqrtPX96 - (amount << 96n) / _liquidity
  }
}

function divRoundingUp(a: bigint, b: bigint): bigint {
  const q = a / b
  if (a % b > 0n) return q + 1n
  return q
}
