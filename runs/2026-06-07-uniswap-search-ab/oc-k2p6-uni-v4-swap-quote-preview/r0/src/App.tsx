import SwapCard from './components/SwapCard'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#FF007A"/>
            <path d="M16 8L18.5 14H24L19.5 18L21 24L16 20L11 24L12.5 18L8 14H13.5L16 8Z" fill="white"/>
          </svg>
          <span>UniSwap V4 Quoter</span>
        </div>
        <nav className="nav">
          <a href="#" className="nav-link active">Swap</a>
          <a href="#" className="nav-link">Pools</a>
          <a href="#" className="nav-link">Docs</a>
        </nav>
        <button className="connect-wallet-btn">Connect Wallet</button>
      </header>

      <main className="app-main">
        <SwapCard />
      </main>

      <footer className="app-footer">
        <p>Uniswap V4 Swap Quoting UI — Built with React + Vite + viem</p>
      </footer>
    </div>
  )
}

export default App
