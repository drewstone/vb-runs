import type { FeeTier } from '../types.ts'

export const FEE_TIERS: FeeTier[] = [
  { fee: 500, label: '0.05%', tickSpacing: 10 },
  { fee: 3000, label: '0.30%', tickSpacing: 60 },
  { fee: 10000, label: '1.00%', tickSpacing: 200 },
]
