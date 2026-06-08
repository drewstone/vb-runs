import { createConfig, http } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

/**
 * Wagmi config — read-only public RPC for Base Sepolia.
 * Wallet connection can be added later via a connector (e.g. metaMask).
 */
export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

/** Query client for @tanstack/react-query, used by wagmi under the hood */
export { QueryClient } from '@tanstack/react-query'
