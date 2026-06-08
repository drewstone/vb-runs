import type { FC } from 'react'
import { SwapWidget } from './components/SwapWidget.tsx'

const App: FC = () => {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <a href="/" className="app-logo">
            <span className="app-logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <rect width="24" height="24" rx="6" fill="#FF007A" />
                <path d="M7 15L12 7L17 15H7Z" fill="white" opacity="0.9" />
              </svg>
            </span>
            <span className="app-logo-text">Uniswap V4</span>
          </a>
          <nav className="app-nav">
            <a href="/" className="app-nav-link active">Swap</a>
            <a href="/" className="app-nav-link">Pool</a>
            <a href="/" className="app-nav-link">Tokens</a>
          </nav>
          <div className="app-header-right">
            <button type="button" className="app-connect-btn" disabled>
              <span className="connect-dot" />
              Connect Wallet
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="app-main-inner">
          <SwapWidget />
        </div>
      </main>

      <footer className="app-footer">
        <div className="app-footer-inner">
          <p className="app-footer-note">
            Powered by @uniswap/v4-sdk · Pool.getOutputAmount · Base Sepolia
          </p>
          <p className="app-footer-fyi">
            On-chain pool state read from PoolManager · QuoterV4 via RPC
          </p>
        </div>
      </footer>
    </div>
  )
}

export default App
