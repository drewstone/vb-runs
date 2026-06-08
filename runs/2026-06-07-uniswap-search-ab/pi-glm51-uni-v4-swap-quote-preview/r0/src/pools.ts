import type { Address } from 'viem'
import { encodePacked, keccak256 } from 'viem'

/**
 * PoolKey matches the V4 on-chain struct.
 * Uses viem's Address type (branded `0x${string}`) for type-safe contract calls.
 * Compatible with @uniswap/v4-sdk's Pool.getPoolKey() output shape.
 */
export interface PoolKey {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

export interface PoolDef {
  id: string
  label: string
  token0Symbol: string
  token1Symbol: string
  token0Decimals: number
  token1Decimals: number
  token0Color: string
  token1Color: string
  token0Address: Address
  token1Address: Address
  poolKey: PoolKey
  feeLabel: string
}

/** Compute poolId = keccak256(abi.encode(poolKey)) */
export function toPoolId(key: PoolKey): Address {
  return keccak256(
    encodePacked(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  )
}

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as Address

/**
 * Pre-configured pool definitions for known V4 pools on Ethereum mainnet.
 * Token addresses are real mainnet ERC-20 addresses.
 */
export const POOLS: PoolDef[] = [
  {
    id: 'usdc-weth-3000',
    label: 'USDC / WETH',
    token0Symbol: 'USDC',
    token1Symbol: 'WETH',
    token0Decimals: 6,
    token1Decimals: 18,
    token0Color: '#2775CA',
    token1Color: '#627EEA',
    token0Address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    token1Address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    poolKey: {
      currency0: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      currency1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      fee: 3000,
      tickSpacing: 60,
      hooks: ZERO_ADDR,
    },
    feeLabel: '0.30%',
  },
  {
    id: 'weth-usdt-500',
    label: 'WETH / USDT',
    token0Symbol: 'WETH',
    token1Symbol: 'USDT',
    token0Decimals: 18,
    token1Decimals: 6,
    token0Color: '#627EEA',
    token1Color: '#26A17B',
    token0Address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    token1Address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    poolKey: {
      currency0: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      currency1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      fee: 500,
      tickSpacing: 10,
      hooks: ZERO_ADDR,
    },
    feeLabel: '0.05%',
  },
  {
    id: 'wbtc-weth-3000',
    label: 'WBTC / WETH',
    token0Symbol: 'WBTC',
    token1Symbol: 'WETH',
    token0Decimals: 8,
    token1Decimals: 18,
    token0Color: '#F7931A',
    token1Color: '#627EEA',
    token0Address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    token1Address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    poolKey: {
      currency0: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      currency1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      fee: 3000,
      tickSpacing: 60,
      hooks: ZERO_ADDR,
    },
    feeLabel: '0.30%',
  },
  {
    id: 'dai-usdc-100',
    label: 'DAI / USDC',
    token0Symbol: 'DAI',
    token1Symbol: 'USDC',
    token0Decimals: 18,
    token1Decimals: 6,
    token0Color: '#F5AC37',
    token1Color: '#2775CA',
    token0Address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    token1Address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    poolKey: {
      currency0: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      currency1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      fee: 100,
      tickSpacing: 1,
      hooks: ZERO_ADDR,
    },
    feeLabel: '0.01%',
  },
]
