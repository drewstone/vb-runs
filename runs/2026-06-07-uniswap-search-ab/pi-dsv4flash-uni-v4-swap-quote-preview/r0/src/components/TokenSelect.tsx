import { useState, useRef, useEffect } from 'react'
import type { Token } from '../types/index.ts'

interface TokenSelectProps {
  tokens: Token[]
  selected: Token | null
  onChange: (t: Token) => void
  label: string
}

export function TokenSelect({ tokens, selected, onChange, label }: TokenSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(ev: MouseEvent) {
      if (ref.current && !ref.current.contains(ev.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="token-select" ref={ref}>
      <button
        type="button"
        className="token-select-trigger"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            <span className="token-icon" data-symbol={selected.symbol}>
              {selected.symbol[0]}
            </span>
            <span className="token-symbol">{selected.symbol}</span>
          </>
        ) : (
          <span className="token-placeholder">Select token</span>
        )}
        <svg className="chevron-down" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul className="token-dropdown" role="listbox" aria-label={label}>
          {tokens.map((t) => (
            <li
              key={t.address}
              role="option"
              aria-selected={selected?.address === t.address}
              className={`token-option ${selected?.address === t.address ? 'selected' : ''}`}
              onClick={() => {
                onChange(t)
                setOpen(false)
              }}
            >
              <span className="token-icon" data-symbol={t.symbol}>
                {t.symbol[0]}
              </span>
              <div className="token-info">
                <span className="token-option-symbol">{t.symbol}</span>
                <span className="token-option-name">{t.name}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
