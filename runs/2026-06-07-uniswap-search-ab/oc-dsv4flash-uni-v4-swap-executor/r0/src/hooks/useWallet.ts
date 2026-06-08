import { useAccount, useBalance, useConnect, useDisconnect } from 'wagmi'

export function useWallet() {
  const { address, isConnected, chainId, connector } = useAccount()
  const { data: balance } = useBalance({ address })
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const openWallet = () => {
    const injectedConnector = connectors.find(c => c.id === 'injected')
    if (injectedConnector) {
      connect({ connector: injectedConnector })
    }
  }

  return {
    address,
    isConnected,
    chainId,
    connector,
    balance,
    openWallet,
    connect,
    connectors,
    disconnect,
  }
}
