/** Represents an ERC20 token for pool creation */
export interface TokenInfo {
  address: string
  symbol: string
  name: string
  decimals: number
  /** Color for the token icon badge */
  color: string
}

/** Fee tier configuration for Uniswap V4 */
export interface FeeTier {
  /** Fee in hundredths of a bip (i.e., 3000 = 0.30%) */
  fee: number
  /** Human-readable percentage string */
  label: string
  /** Tick spacing for this fee tier */
  tickSpacing: number
}

/** Result from PoolManager.initialize() */
export interface InitializeResult {
  poolId: string
  txHash?: string
  blockNumber?: number
}

/** Wizard step */
export type WizardStep = 'tokens' | 'fees' | 'hooks' | 'price' | 'review' | 'result'

/** Complete pool configuration state */
export interface PoolConfig {
  token0: TokenInfo | null
  token1: TokenInfo | null
  feeTier: FeeTier | null
  tickSpacing: number
  customTickSpacing: boolean
  hooksAddress: string
  sqrtPriceX96: string
}

/** Default empty pool config */
export const EMPTY_POOL_CONFIG: PoolConfig = {
  token0: null,
  token1: null,
  feeTier: null,
  tickSpacing: 60,
  customTickSpacing: false,
  hooksAddress: '0x0000000000000000000000000000000000000000',
  sqrtPriceX96: '79228162514264337593543950336',
}
