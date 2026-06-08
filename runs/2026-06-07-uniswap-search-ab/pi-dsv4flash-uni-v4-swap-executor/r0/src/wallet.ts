import { http, createConfig } from 'wagmi';
import { mainnet, base, arbitrum, optimism, polygon } from 'wagmi/chains';
import { walletConnect, injected } from 'wagmi/connectors';

/**
 * Wagmi config for wallet connection.
 * Supports WalletConnect + injected wallets (MetaMask, etc.)
 */
export const wagmiConfig = createConfig({
  chains: [mainnet, base, arbitrum, optimism, polygon],
  connectors: [
    walletConnect({
      projectId: 'ad0b89ae9e9a6c2af12b7ea7fccdadd7', // public WC project ID for demo
      showQrModal: false,
    }),
    injected(),
  ],
  transports: {
    [mainnet.id]: http('https://rpc.ankr.com/eth'),
    [base.id]: http('https://mainnet.base.org'),
    [arbitrum.id]: http('https://arb1.arbitrum.io/rpc'),
    [optimism.id]: http('https://mainnet.optimism.io'),
    [polygon.id]: http('https://polygon-rpc.com'),
  },
});
