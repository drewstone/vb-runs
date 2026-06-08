import { createConfig, http } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import type { PoolKey } from '@uniswap/v4-sdk'

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})

export const CHAIN_ID = sepolia.id

// V4 PoolManager on Sepolia
export const POOL_MANAGER_ADDRESS = '0xE03C23519e725D8Cee9e54Cb0e71F8D3a5c2f9c7'

// StateLibrary.getSlot0 / getLiquidity — exposed by PoolManager contract
export const POOL_MANAGER_ABI = [
  {
    type: 'function' as const,
    name: 'getSlot0',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'swapFee', type: 'uint24' },
    ],
  },
  {
    type: 'function' as const,
    name: 'getLiquidity',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [{ name: 'liquidity', type: 'uint128' }],
  },
]

// USDC / ETH pool on Sepolia: currency0 = USDC (sorts before), currency1 = ETH
export const POOL_KEY: PoolKey = {
  currency0: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  currency1: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
  fee: 3000,
  tickSpacing: 60,
  hooks: '0x0000000000000000000000000000000000000000',
}

export const DEFAULT_FEE = 3000
export const DEFAULT_TICK_SPACING = 60
export const EMPTY_HOOK = '0x0000000000000000000000000000000000000000'
