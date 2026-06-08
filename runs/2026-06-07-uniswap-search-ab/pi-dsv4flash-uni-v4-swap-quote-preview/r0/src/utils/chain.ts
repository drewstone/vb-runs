import { encodePacked, keccak256 } from 'viem'

/**
 * Uniswap V4 on-chain constants, ABIs, and helper types for Base Sepolia.
 *
 * These are the canonical addresses from the V4 universal-router deployments.
 * Swap the POOL_MANAGER / QUOTER addresses per target chain at build time.
 */

// ---------------------------------------------------------------------------
// Contract addresses (Base Sepolia)
// ---------------------------------------------------------------------------

/** V4 PoolManager — source of truth for pool slot0 + liquidity */
export const POOL_MANAGER_ADDRESS = '0x498581fF718a67F70bF6e0F25D15d8B3C8E9E2e'

/** V4 Quoter — on-chain quoting via simulateContract */
export const QUOTER_ADDRESS = '0x339Df640b887a7705426826F55BFf09BF718e496'

// ---------------------------------------------------------------------------
// Magic constants
// ---------------------------------------------------------------------------

/** 2^96 — the Q64.96 denominator */
export const Q96 = 1n << 96n

/** Max sqrtPriceX96 = type(uint160).max. Used as the limit when selling token1. */
export const MAX_SQRT_PRICE_X96 = 1461501637330902918203684832716283019655932542975n

/** Min sqrtPriceX96 (tick −887272). Used as the limit when selling token0. */
export const MIN_SQRT_PRICE_X96 = 4295128739n

// ---------------------------------------------------------------------------
// PoolManager ABI — minimal subset for reading slot0 / liquidity
// ---------------------------------------------------------------------------

export const POOL_MANAGER_ABI = [
  {
    type: 'function',
    name: 'getSlot0',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160', internalType: 'uint160' },
      { name: 'tick', type: 'int24', internalType: 'int24' },
      { name: 'protocolFee', type: 'uint16', internalType: 'uint16' },
      { name: 'swapFee', type: 'uint24', internalType: 'uint24' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLiquidity',
    inputs: [{ name: 'poolId', type: 'bytes32', internalType: 'PoolId' }],
    outputs: [{ name: 'liquidity', type: 'uint128', internalType: 'uint128' }],
    stateMutability: 'view',
  },
] as const

// ---------------------------------------------------------------------------
// QuoterV4 ABI — minimal subset for quoting
// ---------------------------------------------------------------------------

export const QUOTER_ABI = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
          { name: 'hookData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'quoteExactOutputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
          { name: 'hookData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const

// ---------------------------------------------------------------------------
// Compute PoolId from a PoolKey
// PoolId = keccak256(abi.encode(PoolKey))
// PoolKey = (currency0, currency1, fee, tickSpacing, hooks)
// ---------------------------------------------------------------------------

export function getPoolKey(
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
