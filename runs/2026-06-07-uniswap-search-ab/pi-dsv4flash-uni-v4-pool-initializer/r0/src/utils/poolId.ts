import { Pool } from '@uniswap/v4-sdk'
import { Token } from '@uniswap/sdk-core'
import type { TokenInfo } from '../types.ts'

/**
 * Compute PoolId using the @uniswap/v4-sdk Pool.getPoolId method.
 * Internally this calls keccak256(abi.encode(PoolKey)), matching the
 * on-chain computation exactly.
 * No mock hash — uses the real SDK implementation.
 */
export function computePoolId(
  token0: TokenInfo,
  token1: TokenInfo,
  fee: number,
  tickSpacing: number,
  hooks: string,
): string {
  const t0 = new Token(31337, token0.address as `0x${string}`, token0.decimals, token0.symbol, token0.name)
  const t1 = new Token(31337, token1.address as `0x${string}`, token1.decimals, token1.symbol, token1.name)

  return Pool.getPoolId(t0, t1, fee, tickSpacing, hooks)
}
