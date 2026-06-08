import SwapForm from './components/SwapForm'

export default function App() {
  return (
    <div className="min-h-screen bg-defi-bg">
      <header className="border-b border-defi-border bg-defi-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-defi-accent flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-defi-text">V4 Swap</div>
              <div className="text-xs text-defi-textMuted">UniversalRouter</div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://docs.uniswap.org/contracts/v4"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-defi-textSecondary hover:text-defi-text transition-colors"
            >
              Docs
            </a>
            <div className="w-2 h-2 rounded-full bg-defi-success animate-pulse"></div>
            <span className="text-xs text-defi-textMuted">Mainnet</span>
          </div>
        </div>
      </header>

      <main className="py-8">
        <SwapForm />
      </main>

      <footer className="border-t border-defi-border mt-16 py-8">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <p className="text-sm text-defi-textMuted">
            Powered by Uniswap V4 Protocol
          </p>
          <p className="text-xs text-defi-textMuted mt-2">
            UniversalRouter executes commands atomically across V4 pools
          </p>
        </div>
      </footer>
    </div>
  )
}
