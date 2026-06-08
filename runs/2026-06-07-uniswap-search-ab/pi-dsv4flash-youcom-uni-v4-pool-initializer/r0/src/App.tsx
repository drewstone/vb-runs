import { PoolInitializer } from "./components/PoolInitializer.tsx";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="14" fill="currentColor" opacity="0.12" />
              <path
                d="M16 6c-2.5 4-5 8-5 12a5 5 0 0010 0c0-4-2.5-8-5-12z"
                fill="currentColor"
                opacity="0.6"
              />
              <circle cx="12" cy="19" r="1.5" fill="currentColor" opacity="0.4" />
              <circle cx="20" cy="19" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <div className="brand-text">
            <span className="brand-name">Uniswap V4</span>
            <span className="brand-sub">Pool Initializer</span>
          </div>
        </div>
        <div className="header-right">
          <div className="network-badge">
            <span className="network-dot" />
            Ethereum
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="hero-section">
          <h1 className="hero-title">Initialize a V4 Pool</h1>
          <p className="hero-desc">
            Deploy a new concentrated liquidity pool on Uniswap V4.
            Configure tokens, fee tier, hooks, and initial price — then call
            <code className="inline-code">PoolManager.initialize</code> to create the pool.
          </p>
        </div>

        <PoolInitializer />

        <footer className="app-footer">
          <p>
            Powered by <strong>Uniswap V4</strong> &mdash;
            PoolManager contract at 0x0000...7F
          </p>
        </footer>
      </main>
    </div>
  );
}
