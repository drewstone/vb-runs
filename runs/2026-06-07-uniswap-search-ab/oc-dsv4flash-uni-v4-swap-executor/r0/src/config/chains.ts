import { mainnet, base, arbitrum, optimism, polygon } from 'wagmi/chains'
import { http, createConfig } from 'wagmi'
import { walletConnect, injected } from 'wagmi/connectors'

const projectId = '24c3c2b4b5e2b9e4a5c4f5a6b7c8d9e0'

export const SUPPORTED_CHAINS = [mainnet, base, arbitrum, optimism, polygon] as const

export const wagmiConfig = createConfig({
  chains: SUPPORTED_CHAINS,
  connectors: [
    walletConnect({ projectId }),
    injected(),
  ],
  transports: {
    [mainnet.id]: http('https://eth.merkle.io'),
    [base.id]: http('https://base.llamarpc.com'),
    [arbitrum.id]: http('https://arbitrum.llamarpc.com'),
    [optimism.id]: http('https://optimism.llamarpc.com'),
    [polygon.id]: http('https://polygon.llamarpc.com'),
  },
})

export const CHAIN_ID = 1

export function getUniversalRouterAddress(chainId: number): string {
  const addresses: Record<number, string> = {
    1: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
    8453: '0xb1bE0000C6B3C62749b5F0c92480146452D15423',
    42161: '0xb1bE0000C6B3C62749b5F0c92480146452D15423',
    10: '0xb1bE0000C6B3C62749b5F0c92480146452D15423',
    137: '0xb1bE0000C6B3C62749b5F0c92480146452D15423',
  }
  return addresses[chainId] || addresses[1]
}

export function getPermit2Address(chainId: number): string {
  const addresses: Record<number, string> = {
    1: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    8453: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    42161: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    10: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    137: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
  }
  return addresses[chainId] || addresses[1]
}
