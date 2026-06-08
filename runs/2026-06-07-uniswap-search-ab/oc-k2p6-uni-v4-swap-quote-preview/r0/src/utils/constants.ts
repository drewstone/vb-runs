export const SEPOLIA_POOL_MANAGER = '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543'
export const SEPOLIA_QUOTER = '0x61b3f2011A92d183c7dbadbda940a7555Ccf9227'
export const Q96 = 2n ** 96n

export interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
}

export const COMMON_TOKENS: Token[] = [
  {
    address: '0xfff9976782d46cc05630d1f6ebab18b2324d6b14',
    symbol: 'WETH',
    name: 'Wrapped Ether (Sepolia)',
    decimals: 18,
  },
  {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    symbol: 'USDC',
    name: 'USD Coin (Sepolia)',
    decimals: 6,
  },
  {
    address: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
    symbol: 'USDT',
    name: 'Tether USD (Sepolia)',
    decimals: 6,
  },
  {
    address: '0x509Cd4aAb2E4Fc460c07675197Ec55A58E060be3',
    symbol: 'DAI',
    name: 'Dai Stablecoin (Sepolia)',
    decimals: 18,
  },
]
