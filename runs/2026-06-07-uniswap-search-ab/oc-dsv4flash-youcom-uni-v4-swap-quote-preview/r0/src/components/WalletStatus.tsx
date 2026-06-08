import { useAccount, useConnect, useDisconnect } from 'wagmi'

export function WalletStatus() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    const short = `${address.slice(0, 6)}...${address.slice(-4)}`
    return (
      <div className="wallet-status connected">
        <span className="wallet-dot" />
        <span className="wallet-addr">{short}</span>
        <button className="wallet-disconnect" onClick={() => disconnect()} type="button">
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="wallet-status">
      {connectors.map((connector) => (
        <button
          key={connector.id}
          className="wallet-connect"
          onClick={() => connect({ connector })}
          type="button"
        >
          Connect wallet
        </button>
      ))}
    </div>
  )
}
