import { SwapCard } from './components/SwapCard'
import { WalletStatus } from './components/WalletStatus'
import './App.css'

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="logo-area">
          <span className="logo-icon">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" stroke="var(--color-primary)" strokeWidth="1.5" fill="none" />
              <path d="M10 16l4 4 8-8" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </span>
          <span className="logo-text">V4 Quote</span>
        </div>
        <WalletStatus />
      </header>
      <main className="app-main">
        <SwapCard />
      </main>
      <footer className="app-footer">
        <span>Uniswap V4 — swap quoting via SqrtPriceMath</span>
        <a
          href="https://docs.uniswap.org/contracts/v4/overview"
          target="_blank"
          rel="noopener noreferrer"
        >
          V4 docs
        </a>
      </footer>
    </div>
  )
}
