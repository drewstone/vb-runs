import type { Token } from '../types/index.ts'
import { encodePacked, keccak256 } from 'viem'

/**
 * Token registry — canonical ERC20 addresses on Base Sepolia.
 * The actual pool state is read on-chain via wagmi useReadContract.
 * This file only provides the token list for the UI selector dropdowns.
 */
export const WETH: Token = {
  address: '0x4200000000000000000000000000000000000006',
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
}

export const USDC: Token = {
  address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
}

export const DAI: Token = {
  address: '0xcE3e0F3C1E1B0D2B48d6cF0E1F2B0C9e1B0cE3e0',
  symbol: 'DAI',
  name: 'Dai Stablecoin',
  decimals: 18,
}

export const USDT: Token = {
  address: '0xcE3e0F3C1E1B0D2B48d6cF0E1F2B0C9e1B0cE3eF',
  symbol: 'USDT',
  name: 'Tether USD',
  decimals: 6,
}

export const ALL_TOKENS: Token[] = [WETH, USDC, DAI, USDT]

/**
 * Determine which token is token0 / token1 in the pool.
 * In Uniswap V3/V4, token0 < token1 by address (lexicographic).
 */
export function getPoolTokens(tokenA: Token, tokenB: Token): { token0: Token; token1: Token } {
  const a = BigInt(tokenA.address)
  const b = BigInt(tokenB.address)
  if (a < b) return { token0: tokenA, token1: tokenB }
  return { token0: tokenB, token1: tokenA }
}

/**
 * Compute the V4 PoolId = keccak256(abi.encode(PoolKey)).
 * PoolKey = (currency0, currency1, fee, tickSpacing, hooks).
 */
export function computePoolId(
  token0: `0x${string}`,
  token1: `0x${string}`,
  fee: number,
  tickSpacing: number,
  hooks: `0x${string}`,
): `0x${string}` {
  const encoded = encodePacked(
    ['address', 'address', 'uint24', 'int24', 'address'],
    [token0, token1, fee, tickSpacing, hooks],
  )
  return keccak256(encoded)
}
