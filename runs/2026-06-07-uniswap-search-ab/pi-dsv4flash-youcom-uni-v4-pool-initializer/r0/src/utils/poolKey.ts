import { Token } from "@uniswap/sdk-core";
import type { PoolKey } from "@uniswap/v4-sdk";

/**
 * Create a Token (Currency) from an address and decimals.
 * Used when calling Pool.getPoolKey / Pool.getPoolId which require Currency args.
 */
export function addressToToken(
  address: string,
  decimals: number,
): Token {
  return new Token(1, address, decimals);
}

/**
 * Sort token addresses to determine currency0/currency1.
 * Lower address = currency0.
 * Returns [currency0, currency1] with addresses sorted ascending.
 */
export function sortTokens(a: string, b: string): [string, string] {
  const aBig = BigInt(a);
  const bBig = BigInt(b);
  if (aBig < bBig) return [a, b];
  if (bBig < aBig) return [b, a];
  throw new Error("Identical token addresses — pool would be degenerate");
}

export type { PoolKey };
