/**
 * Integer square root (Newton's method) for native BigInt.
 * Returns floor(sqrt(value)).
 */
function sqrtBigInt(value: bigint): bigint {
  if (value < 0n) throw new Error("negative value");
  if (value < 2n) return value;
  let x = value;
  let y = (x + 1n) >> 1n;
  while (y < x) {
    x = y;
    y = (y + value / y) >> 1n;
  }
  return x;
}

/**
 * Returns the sqrt ratio as a Q64.96 corresponding to a given ratio of amount1 and amount0.
 * Replicates the v4 SDK's encodeSqrtRatioX96 using native BigInt math.
 *
 * sqrtPriceX96 = sqrt(amount1 / amount0) * 2^96
 *
 * @param amount1 The numerator amount i.e., the amount of token1
 * @param amount0 The denominator amount i.e., the amount of token0
 * @returns The sqrt ratio as a string (Q64.96)
 */
export function encodeSqrtRatioX96(
  amount1: string | number | bigint,
  amount0: string | number | bigint,
): string {
  const numerator = BigInt(amount1) << 192n;
  const denominator = BigInt(amount0);
  const ratioX192 = numerator / denominator;
  return sqrtBigInt(ratioX192).toString();
}

const Q96 = 2n ** 96n;

/**
 * Convert a human-readable price (token1 per token0) to sqrtPriceX96.
 * Uses encodeSqrtRatioX96: sqrt(amount1/amount0) * Q96.
 *
 * @param price - human-readable price of token0 in terms of token1
 * @param decimals0 - decimals of token0
 * @param decimals1 - decimals of token1
 * @returns sqrtPriceX96 as a string
 */
export function priceToSqrtPriceX96(
  price: number,
  decimals0: number = 18,
  decimals1: number = 18,
): string {
  // Adjust for decimal differences: multiply price by 10^(decimals0 - decimals1)
  const decimalAdjustment = 10 ** (decimals0 - decimals1);
  const adjustedPrice = price * decimalAdjustment;

  const ratio1 = Math.floor(adjustedPrice * 10 ** 18).toString();
  const ratio0 = (10 ** 18).toString();
  return encodeSqrtRatioX96(ratio1, ratio0);
}

/**
 * Convert sqrtPriceX96 (string) to a human-readable price.
 * price = (sqrtPriceX96 / Q96)^2
 * Returns token1-per-token0 (how much token1 equals 1 token0).
 *
 * @param sqrtPriceX96 - the Q64.96 square root price as a string
 * @param decimals0 - decimals of token0
 * @param decimals1 - decimals of token1
 * @returns human-readable price string
 */
export function sqrtPriceX96ToPrice(
  sqrtPriceX96: string,
  decimals0: number = 18,
  decimals1: number = 18,
): string {
  try {
    const sqrt = BigInt(sqrtPriceX96);
    if (sqrt <= 0n) return "0";

    const numerator = Number(sqrt) * Number(sqrt);
    const denominator = Number(Q96) * Number(Q96);
    const rawPrice = numerator / denominator;

    const decimalAdjustment = 10 ** (decimals1 - decimals0);
    const adjustedPrice = rawPrice * decimalAdjustment;

    return adjustedPrice.toPrecision(8);
  } catch {
    return "0";
  }
}

/**
 * Safely parse a string into a bigint for sqrtPriceX96.
 */
export function parseSqrtPrice(input: string): bigint {
  try {
    const parsed = BigInt(input);
    return parsed > 0n ? parsed : 0n;
  } catch {
    return 0n;
  }
}
