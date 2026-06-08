export interface Token {
  symbol: string
  name: string
  address: string
  decimals: number
  color: string
}

// Arbitrum Sepolia token addresses
export const TOKENS: Token[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
    color: '#627EEA',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    decimals: 6,
    color: '#2775CA',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x27CEA6Eb8d90E8d319E9d2CbEbfC3c7b2C1b5D9e',
    decimals: 6,
    color: '#26A17B',
  },
  {
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    address: '0x8c4a9B7B6F6C7D7E8F9A0B1C2D3E4F5A6B7C8D9E',
    decimals: 18,
    color: '#F5AC37',
  },
  {
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    decimals: 8,
    color: '#F7931A',
  },
  {
    symbol: 'UNI',
    name: 'Uniswap',
    address: '0xA0b86a33E6441e0A421e56E4773C3C1C8C8F8F8F',
    decimals: 18,
    color: '#FF007A',
  },
]

export function getTokenBySymbol(symbol: string): Token | undefined {
  return TOKENS.find((t) => t.symbol === symbol)
}
