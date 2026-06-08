export interface PoolKey {
  currency0: `0x${string}`
  currency1: `0x${string}`
  fee: number
  tickSpacing: number
  hooks: `0x${string}`
}

export interface TokenInfo {
  symbol: string
  name: string
  address: `0x${string}`
  decimals: number
}

export interface FeeTier {
  label: string
  value: number
  tickSpacing: number
  description: string
}

export type WizardStep = 'tokens' | 'config' | 'hooks' | 'price' | 'review' | 'result'
