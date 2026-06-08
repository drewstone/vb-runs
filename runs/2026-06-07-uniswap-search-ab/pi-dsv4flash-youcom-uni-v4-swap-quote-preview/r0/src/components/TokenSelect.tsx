import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import type { TokenInfo } from "../types";
import { TOKENS } from "../constants";

interface TokenSelectProps {
  label: string;
  selected: TokenInfo | null;
  onSelect: (token: TokenInfo) => void;
}

export function TokenSelect({ label, selected, onSelect }: TokenSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = search
    ? TOKENS.filter(
        (t) =>
          t.symbol.toLowerCase().includes(search.toLowerCase()) ||
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.address.toLowerCase().includes(search.toLowerCase()),
      )
    : TOKENS;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="token-select" ref={ref}>
      <label className="token-select__label">{label}</label>
      <button
        className="token-select__trigger"
        onClick={() => {
          setOpen(!open);
          setSearch("");
        }}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected ? (
          <>
            {selected.logo && (
              <img
                src={selected.logo}
                alt=""
                className="token-select__logo"
                width="24"
                height="24"
              />
            )}
            <span className="token-select__symbol">{selected.symbol}</span>
          </>
        ) : (
          <span className="token-select__placeholder">Select token</span>
        )}
        <svg
          className={`token-select__chevron ${open ? "token-select__chevron--open" : ""}`}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="token-select__dropdown" role="listbox">
          <div className="token-select__search">
            <svg className="token-select__search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or paste address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="token-select__search-input"
            />
          </div>
          <div className="token-select__list">
            {filtered.length === 0 ? (
              <div className="token-select__empty">No tokens found</div>
            ) : (
              filtered.map((token) => (
                <button
                  key={token.address}
                  className={`token-select__option ${selected?.address === token.address ? "token-select__option--active" : ""}`}
                  onClick={() => {
                    onSelect(token);
                    setOpen(false);
                  }}
                  role="option"
                  aria-selected={selected?.address === token.address}
                  type="button"
                >
                  {token.logo && (
                    <img
                      src={token.logo}
                      alt=""
                      className="token-select__logo"
                      width="24"
                      height="24"
                    />
                  )}
                  <div className="token-select__option-info">
                    <span className="token-select__option-symbol">
                      {token.symbol}
                    </span>
                    <span className="token-select__option-name">{token.name}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
