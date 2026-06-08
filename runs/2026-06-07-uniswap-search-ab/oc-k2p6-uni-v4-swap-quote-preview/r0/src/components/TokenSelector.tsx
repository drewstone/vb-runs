import { useState, useCallback } from 'react'
import type { Token } from '../types'
import { COMMON_TOKENS } from '../utils/constants'

interface TokenSelectorProps {
  selected: Token | null
  onSelect: (token: Token) => void
  onClose: () => void
  exclude?: Token | null
}

export default function TokenSelector({
  selected,
  onSelect,
  onClose,
  exclude,
}: TokenSelectorProps) {
  const [search, setSearch] = useState('')


  const filtered = COMMON_TOKENS.filter(
    (t) =>
      (!exclude || t.address.toLowerCase() !== exclude.address.toLowerCase()) &&
      (t.symbol.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.address.toLowerCase().includes(search.toLowerCase())),
  )

  const handleCustomAdd = useCallback(() => {
    const addr = search.trim()
    if (addr.match(/^0x[a-fA-F0-9]{40}$/)) {
      const token: Token = {
        address: addr,
        symbol: addr.slice(0, 6) + '...' + addr.slice(-4),
        name: 'Custom Token',
        decimals: 18,
      }
      onSelect(token)
      onClose()
    }
  }, [search, onSelect, onClose])

  return (
    <div className="token-selector-overlay" onClick={onClose}>
      <div className="token-selector" onClick={(e) => e.stopPropagation()}>
        <div className="token-selector-header">
          <h3>Select Token</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <input
          type="text"
          className="token-search"
          placeholder="Search by name or paste address"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="token-list">
          {filtered.map((token) => (
            <button
              key={token.address}
              className={`token-item ${selected?.address === token.address ? 'selected' : ''}`}
              onClick={() => {
                onSelect(token)
                onClose()
              }}
            >
              <div className="token-icon">{token.symbol[0]}</div>
              <div className="token-info">
                <div className="token-symbol">{token.symbol}</div>
                <div className="token-name">{token.name}</div>
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && search.match(/^0x[a-fA-F0-9]{40}$/) && (
          <div className="custom-token">
            <p>Add custom token:</p>
            <button className="btn-primary" onClick={handleCustomAdd}>
              Add {search.slice(0, 6)}...{search.slice(-4)}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
