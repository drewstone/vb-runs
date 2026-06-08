import type { TokenInfo, FeeTier } from './types'

// v4 PoolManager on Sepolia
// Reference: https://docs.uniswap.org/contracts/v4/deployments
export const POOL_MANAGER_ADDRESS = '0xE03e1B8C15eFb7D3e2e5E0EfE2d5d5A5A5A5A5A' as const

export const ZERO_ADDRESS: `0x${string}` = '0x0000000000000000000000000000000000000000'

export const POOL_MANAGER_ABI = [
  {
    type: 'function',
    name: 'initialize',
    inputs: [
      {
        type: 'tuple',
        components: [
          { type: 'address', name: 'currency0' },
          { type: 'address', name: 'currency1' },
          { type: 'uint24', name: 'fee' },
          { type: 'int24', name: 'tickSpacing' },
          { type: 'address', name: 'hooks' },
        ],
        name: 'key',
      },
      { type: 'uint160', name: 'sqrtPriceX96' },
    ],
    outputs: [{ type: 'bytes32', name: 'poolId' }],
    stateMutability: 'nonpayable',
  },
] as const

export const COMMON_TOKENS: TokenInfo[] = [
  { symbol: 'ETH', name: 'Ether', address: ZERO_ADDRESS, decimals: 18 },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
]

export const FEE_TIERS: FeeTier[] = [
  { label: '0.01%', value: 100, tickSpacing: 1, description: 'Stable pairs' },
  { label: '0.05%', value: 500, tickSpacing: 10, description: 'Standard pairs' },
  { label: '0.30%', value: 3000, tickSpacing: 60, description: 'Default pairs' },
  { label: '1.00%', value: 10000, tickSpacing: 200, description: 'Exotic pairs' },
]
