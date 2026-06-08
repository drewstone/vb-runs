import type { TokenInfo } from '../types'

export const ETH: TokenInfo = {
  address: '0x0000000000000000000000000000000000000000',
  symbol: 'ETH',
  name: 'Ether',
  decimals: 18,
  chainId: 1,
}

export const WETH: TokenInfo = {
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
  chainId: 1,
}

export const USDC: TokenInfo = {
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  chainId: 1,
}

export const DAI: TokenInfo = {
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  symbol: 'DAI',
  name: 'Dai Stablecoin',
  decimals: 18,
  chainId: 1,
}

export const USDT: TokenInfo = {
  address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  symbol: 'USDT',
  name: 'Tether USD',
  decimals: 6,
  chainId: 1,
}

export const WBTC: TokenInfo = {
  address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  symbol: 'WBTC',
  name: 'Wrapped Bitcoin',
  decimals: 8,
  chainId: 1,
}

export const UNI: TokenInfo = {
  address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
  symbol: 'UNI',
  name: 'Uniswap',
  decimals: 18,
  chainId: 1,
}

export const POPULAR_TOKENS: TokenInfo[] = [ETH, USDC, DAI, USDT, WBTC, UNI, WETH]

export type { TokenInfo }
