import SwapQuote from './components/SwapQuote'

export default function App() {
  return (
    <div className="app-shell">
      <header className="header">
        <div className="logo">
          <div className="logo-icon">V4</div>
          <span className="logo-text">Swap Quote</span>
        </div>
        <span className="header-badge">Mainnet</span>
      </header>
      <SwapQuote />
      <footer className="footer">
        Pool state read from PoolManager via StateLibrary. Quote computed
        client-side with SqrtPriceMath from @uniswap/v3-sdk.
      </footer>
    </div>
  )
}
