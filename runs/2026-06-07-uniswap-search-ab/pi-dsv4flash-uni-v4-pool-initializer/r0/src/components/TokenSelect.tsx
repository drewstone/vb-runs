import { useState, useRef, useEffect } from 'react'
import type { TokenInfo } from '../types.ts'
import { TOKENS } from '../utils/tokens.ts'

interface TokenSelectProps {
  selected: TokenInfo | null
  otherSelected: TokenInfo | null
  onChange: (token: TokenInfo | null) => void
  label: string
}

export function TokenSelect({ selected, otherSelected, onChange, label }: TokenSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredTokens = TOKENS.filter(
    t => t.address !== otherSelected?.address,
  )

  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div className="token-select-wrapper" ref={ref}>
        <button
          className={`token-select-trigger ${open ? 'open' : ''}`}
          onClick={() => setOpen(!open)}
          type="button"
        >
          {selected ? (
            <>
              <div
                className="token-icon"
                style={{ background: selected.color }}
              >
                {selected.symbol[0]}
              </div>
              <span>{selected.symbol}</span>
              <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, fontSize: 13 }}>
                {selected.name}
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--text-tertiary)' }}>Select token</span>
          )}
          <span className="chevron">▼</span>
        </button>
        <div className={`token-dropdown ${open ? 'open' : ''}`}>
          {filteredTokens.map(token => (
            <div
              key={token.address}
              className={`token-option ${selected?.address === token.address ? 'selected' : ''}`}
              onClick={() => {
                onChange(token)
                setOpen(false)
              }}
            >
              <div
                className="token-icon"
                style={{ background: token.color, width: 24, height: 24, fontSize: 11 }}
              >
                {token.symbol[0]}
              </div>
              <div>
                <div className="token-symbol">{token.symbol}</div>
                <div className="token-name">{token.name}</div>
              </div>
            </div>
          ))}
          {filteredTokens.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              No other tokens available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
