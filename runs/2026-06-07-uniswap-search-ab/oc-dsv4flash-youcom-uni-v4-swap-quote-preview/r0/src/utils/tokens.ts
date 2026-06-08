import { Token } from '@uniswap/sdk-core'
import type { TokenInfo } from '../types'
import { CHAIN_ID } from '../config'

function t(address: string, decimals: number, symbol: string, name: string): Token {
  return new Token(CHAIN_ID, address, decimals, symbol, name)
}

export const TOKENS: TokenInfo[] = [
  {
    token: t('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether'),
    symbol: 'WETH',
    name: 'Wrapped Ether',
  },
  {
    token: t('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin'),
    symbol: 'USDC',
    name: 'USD Coin',
  },
  {
    token: t('0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'Dai Stablecoin'),
    symbol: 'DAI',
    name: 'Dai Stablecoin',
  },
  {
    token: t('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 8, 'WBTC', 'Wrapped Bitcoin'),
    symbol: 'WBTC',
    name: 'Wrapped Bitcoin',
  },
  {
    token: t('0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'USDT', 'Tether USD'),
    symbol: 'USDT',
    name: 'Tether USD',
  },
  {
    token: t('0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 18, 'AAVE', 'Aave'),
    symbol: 'AAVE',
    name: 'Aave',
  },
  {
    token: t('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, 'UNI', 'Uniswap'),
    symbol: 'UNI',
    name: 'Uniswap',
  },
]

export function tokenById(address: string): TokenInfo | undefined {
  return TOKENS.find(
    (t) => t.token.address.toLowerCase() === address.toLowerCase(),
  )
}

export function bySymbol(symbol: string): TokenInfo | undefined {
  return TOKENS.find((t) => t.symbol === symbol.toUpperCase())
}
