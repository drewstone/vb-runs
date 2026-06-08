import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, base } from 'wagmi/chains'

export const config = createConfig({
  chains: [mainnet, sepolia, base],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
})
