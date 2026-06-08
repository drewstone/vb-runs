import { useState, useRef, useEffect } from 'react'
import type { TokenInfo } from '../types'
import { POPULAR_TOKENS } from '../config/tokens'

interface TokenSelectProps {
  selected: TokenInfo | null
  onSelect: (token: TokenInfo) => void
  label: string
}

export function TokenSelect({ selected, onSelect, label }: TokenSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="token-select" ref={ref}>
      <span className="token-select-label">{label}</span>
      <button className="token-select-btn" onClick={() => setOpen(!open)} type="button">
        {selected ? (
          <>
            <span className="token-icon">{selected.symbol[0]}</span>
            <span className="token-symbol">{selected.symbol}</span>
          </>
        ) : (
          <span className="token-symbol muted">Select token</span>
        )}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {open && (
        <div className="token-dropdown">
          {POPULAR_TOKENS.map(token => (
            <button
              key={token.address}
              className={`token-option ${selected?.address === token.address ? 'active' : ''}`}
              onClick={() => { onSelect(token); setOpen(false) }}
              type="button"
            >
              <span className="token-icon" style={{ backgroundColor: token.symbol === 'ETH' ? '#627EEA' : '#2775CA' }}>
                {token.symbol[0]}
              </span>
              <div className="token-option-info">
                <span className="token-option-symbol">{token.symbol}</span>
                <span className="token-option-name">{token.name}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
