import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { useCallback } from 'react'

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export default function WalletConnect() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  const handleConnect = useCallback(() => {
    if (connectors[0]) {
      connect({ connector: connectors[0] })
    }
  }, [connect, connectors])

  if (isConnected && address) {
    return (
      <div className="wallet-status">
        <span className="wallet-dot" />
        <span className="wallet-address">{shortenAddress(address)}</span>
        <button className="btn btn-ghost btn-sm" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button className="btn btn-accent" onClick={handleConnect}>
      Connect Wallet
    </button>
  )
}
