export function Header() {
  return (
    <header className="app-header">
      <a href="/" className="app-logo">
        <div className="app-logo-icon">⟠</div>
        <div>
          <div className="app-logo-text">
            V4 Pool Initializer
            <span className="app-logo-sub" style={{ marginLeft: 8 }}>Uniswap</span>
          </div>
        </div>
      </a>
      <div className="header-badge">
        <span className="header-badge-dot" />
        Sepolia Testnet
      </div>
    </header>
  )
}
