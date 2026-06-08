export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
  logoURI?: string
}

export interface PoolKey {
  currency0: string
  currency1: string
  fee: number
  tickSpacing: number
  hooks: string
}

export interface SwapPath {
  steps: PathStep[]
}

export interface PathStep {
  poolKey: PoolKey
  zeroForOne: boolean
}

export interface SwapParams {
  amountIn: string
  amountOutMinimum: string
  path: SwapPath
  recipient: string
  deadline: number
}

export interface BalanceDelta {
  amount0: bigint
  amount1: bigint
}

export interface SwapResult {
  txHash: string
  balanceDelta: BalanceDelta
  amountOut: bigint
  slippage: number
}

export interface QuoteResult {
  expectedOutput: bigint
  executionPrice: number
  priceImpact: number
}

export const COMMANDS = {
  V4_SWAP: 0x10,
  PERMIT2_PERMIT: 0x0a,
  WRAP_ETH: 0x0b,
  UNWRAP_WETH: 0x0c,
} as const

export const V4_ACTIONS = {
  SWAP_EXACT_IN_SINGLE: 0x06,
  SWAP_EXACT_IN: 0x07,
  SWAP_EXACT_OUT_SINGLE: 0x08,
  SWAP_EXACT_OUT: 0x09,
} as const

export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'

export const DEFAULT_TOKENS: Token[] = [
  {
    address: '0x0000000000000000000000000000000000000000',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
  },
  {
    address: '0xA0b86a33E6441e3D4e274B28E7C7D3C4C5a1B2c3',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  {
    address: '0xB1c2d3E4F5a6B7C8D9E0F1A2B3C4D5E6F7A8B9C0',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
  },
  {
    address: '0xC2d3E4F5A6B7C8D9E0F1A2B3C4D5E6F7A8B9C0D1',
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
    decimals: 8,
  },
]

export const DEFAULT_POOL_KEYS: Record<string, PoolKey> = {
  'ETH-USDC': {
    currency0: '0x0000000000000000000000000000000000000000',
    currency1: '0xA0b86a33E6441e3D4e274B28E7C7D3C4C5a1B2c3',
    fee: 500,
    tickSpacing: 10,
    hooks: '0x0000000000000000000000000000000000000000',
  },
  'USDC-DAI': {
    currency0: '0xA0b86a33E6441e3D4e274B28E7C7D3C4C5a1B2c3',
    currency1: '0xB1c2d3E4F5a6B7C8D9E0F1A2B3C4D5E6F7A8B9C0',
    fee: 100,
    tickSpacing: 1,
    hooks: '0x0000000000000000000000000000000000000000',
  },
  'ETH-WBTC': {
    currency0: '0x0000000000000000000000000000000000000000',
    currency1: '0xC2d3E4F5A6B7C8D9E0F1A2B3C4D5E6F7A8B9C0D1',
    fee: 3000,
    tickSpacing: 60,
    hooks: '0x0000000000000000000000000000000000000000',
  },
}

export const UNIVERSAL_ROUTER_ADDRESS = '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD'
export const V4_POSITION_MANAGER_ADDRESS = '0x0000000000000000000000000000000000000000'
