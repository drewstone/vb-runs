import { WalletStatus } from './components/WalletStatus'
import { SwapCard } from './components/SwapCard'
import { useSwap } from './hooks/useSwap'

export default function App() {
  const {
    state,
    isSwapping,
    isApproving,
    needsApproval,
    error,
    txResult,
    setInputToken,
    setOutputToken,
    setAmountIn,
    setSlippage,
    setDeadline,
    swapTokens,
    executeSwap,
    approveToken,
  } = useSwap()

  const handleApprove = () => {
    approveToken()
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-brand">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" fill="url(#g1)" />
            <path d="M10 20c2-6 6-10 6-10s4 4 6 10c-4-2-6-2-6-2s-2 0-6 2z" fill="white" />
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="32" y2="32">
                <stop stopColor="#FF007A" />
                <stop offset="1" stopColor="#2172E5" />
              </linearGradient>
            </defs>
          </svg>
          <h1 className="brand-name">V4 Swap</h1>
        </div>
        <div className="app-header-right">
          <WalletStatus />
        </div>
      </header>

      <main className="app-main">
        <SwapCard
          inputToken={state.inputToken}
          outputToken={state.outputToken}
          amountIn={state.amountIn}
          amountOut={state.amountOut}
          slippage={state.slippageTolerance}
          deadline={state.deadline}
          isSwapping={isSwapping}
          isApproving={isApproving}
          needsApproval={needsApproval}
          error={error}
          txResult={txResult}
          onSetInputToken={setInputToken}
          onSetOutputToken={setOutputToken}
          onSetAmountIn={setAmountIn}
          onSetSlippage={setSlippage}
          onSetDeadline={setDeadline}
          onSwapTokens={swapTokens}
          onExecuteSwap={executeSwap}
          onApproveToken={handleApprove}
        />
      </main>

      <footer className="app-footer">
        <div className="footer-info">
          <span>Uniswap V4</span>
          <span className="footer-dot">·</span>
          <span>UniversalRouter</span>
          <span className="footer-dot">·</span>
          <span>SWAP_EXACT_IN_SINGLE</span>
        </div>
        <div className="footer-links">
          <a href="https://uniswap.org" target="_blank" rel="noopener noreferrer">Uniswap</a>
          <a href="https://github.com/Uniswap/universal-router-sdk" target="_blank" rel="noopener noreferrer">UR SDK</a>
          <a href="https://github.com/Uniswap/v4-sdk" target="_blank" rel="noopener noreferrer">V4 SDK</a>
        </div>
      </footer>
    </div>
  )
}
