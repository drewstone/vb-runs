import { useWallet } from '../hooks/useWallet'
import { shortenAddress } from '../utils/format'

export function WalletStatus() {
  const { address, isConnected, balance, openWallet, disconnect } = useWallet()

  if (isConnected && address) {
    const balanceStr = balance
      ? `${Number(balance.value) / 10 ** balance.decimals} ${balance.symbol}`
      : '...'

    return (
      <div className="wallet-status connected">
        <div className="wallet-info">
          <span className="wallet-balance">
            {balanceStr}
          </span>
          <button className="wallet-address" onClick={() => disconnect()}>
            {shortenAddress(address)}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button className="btn btn-primary wallet-connect-btn" onClick={openWallet}>
      Connect Wallet
    </button>
  )
}
