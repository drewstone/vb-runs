import { useState } from 'react'
import { DEFAULT_TOKENS, type Token } from '../types'

interface TokenSelectorProps {
  selectedToken: Token | null
  onSelect: (token: Token) => void
  label: string
}

export default function TokenSelector({ selectedToken, onSelect, label }: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTokens = DEFAULT_TOKENS.filter(
    token =>
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-defi-textSecondary mb-2">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="token-select w-full justify-between"
      >
        {selectedToken ? (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-defi-accent/20 flex items-center justify-center text-defi-accent font-bold text-sm">
              {selectedToken.symbol.slice(0, 2)}
            </div>
            <div className="text-left">
              <div className="font-semibold text-defi-text">{selectedToken.symbol}</div>
              <div className="text-xs text-defi-textMuted">{selectedToken.name}</div>
            </div>
          </div>
        ) : (
          <span className="text-defi-textMuted">Select token</span>
        )}
        <svg
          className={`w-5 h-5 text-defi-textSecondary transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-2 w-full bg-defi-card border border-defi-border rounded-xl shadow-xl overflow-hidden">
            <div className="p-3 border-b border-defi-border">
              <input
                type="text"
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="input-field w-full text-sm"
                autoFocus
              />
            </div>
            <div className="max-h-60 overflow-y-auto">
              {filteredTokens.map(token => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => {
                    onSelect(token)
                    setIsOpen(false)
                    setSearchQuery('')
                  }}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-defi-bg transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-defi-accent/20 flex items-center justify-center text-defi-accent font-bold text-sm">
                    {token.symbol.slice(0, 2)}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-defi-text">{token.symbol}</div>
                    <div className="text-xs text-defi-textMuted">{token.name}</div>
                  </div>
                </button>
              ))}
              {filteredTokens.length === 0 && (
                <div className="px-4 py-8 text-center text-defi-textMuted">
                  No tokens found
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
