import { useState, useRef, useEffect } from 'react'
import type { Token } from '@uniswap/sdk-core'
import { TOKENS } from '../utils/tokens'

interface TokenSelectProps {
  selected: Token | null
  onSelect: (token: Token) => void
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
      <label className="field-label">{label}</label>
      <button className="token-trigger" onClick={() => setOpen(!open)} type="button">
        <span className="token-badge">
          {selected ? (
            <>
              <span className="token-icon-circle">{selected.symbol?.charAt(0) ?? '?'}</span>
              <span>{selected.symbol}</span>
            </>
          ) : (
            <span className="token-placeholder">Select token</span>
          )}
        </span>
        <span className={`chevron ${open ? 'open' : ''}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>
      {open && (
        <ul className="token-dropdown">
          {TOKENS.map((t) => (
            <li key={t.token.address}>
              <button
                type="button"
                className={`token-option ${selected?.address === t.token.address ? 'active' : ''}`}
                onClick={() => {
                  onSelect(t.token)
                  setOpen(false)
                }}
              >
                <span className="token-icon-circle">{t.symbol[0]}</span>
                <div className="token-meta">
                  <span className="token-symbol">{t.symbol}</span>
                  <span className="token-name">{t.name}</span>
                </div>
                {selected?.address === t.token.address && (
                  <span className="checkmark">✓</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
