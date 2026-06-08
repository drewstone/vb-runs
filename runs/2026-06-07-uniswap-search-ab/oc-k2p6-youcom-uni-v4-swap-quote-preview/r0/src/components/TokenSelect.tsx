import { useState } from 'react'
import { useAccount, useConnect, useDisconnect, useConnectors } from 'wagmi'
import type { Token } from '../utils/tokens'

interface TokenSelectProps {
  selected: Token
  onSelect: (token: Token) => void
  tokens: Token[]
  label: string
}

export default function TokenSelect({ selected, onSelect, tokens, label }: TokenSelectProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="token-select">
      <label className="token-label">{label}</label>
      <button
        className="token-trigger"
        onClick={() => setOpen(!open)}
        type="button"
      >
        <span
          className="token-dot"
          style={{ backgroundColor: selected.color }}
        />
        <span className="token-symbol">{selected.symbol}</span>
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
          <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div className="token-overlay" onClick={() => setOpen(false)} />
          <div className="token-dropdown">
            {tokens.map((token) => (
              <button
                key={token.symbol}
                className={`token-option ${token.symbol === selected.symbol ? 'active' : ''}`}
                onClick={() => {
                  onSelect(token)
                  setOpen(false)
                }}
                type="button"
              >
                <span
                  className="token-dot"
                  style={{ backgroundColor: token.color }}
                />
                <div className="token-info">
                  <span className="token-info-symbol">{token.symbol}</span>
                  <span className="token-info-name">{token.name}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function WalletButton() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()
  const connectors = useConnectors()
  const injected = connectors.find((c) => c.id === 'injected')

  if (isConnected && address) {
    return (
      <button className="wallet-btn connected" onClick={() => disconnect()}>
        <span className="wallet-dot" />
        {address.slice(0, 6)}...{address.slice(-4)}
      </button>
    )
  }

  return (
    <button
      className="wallet-btn"
      onClick={() => {
        if (injected) connect({ connector: injected })
      }}
    >
      Connect Wallet
    </button>
  )
}
