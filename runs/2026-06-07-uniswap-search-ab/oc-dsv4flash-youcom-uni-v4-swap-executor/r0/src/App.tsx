import { useSwap } from './hooks/useSwap'
import { SwapCard } from './components/SwapCard'
import { FlowVisualizer } from './components/FlowVisualizer'
import { ResultsPanel } from './components/ResultsPanel'

export default function App() {
  const swap = useSwap()

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-icon">U</div>
          <span>V4 Swap Executor</span>
        </div>
        <div className="header-badge">
          <span className="header-badge-dot" />
          <span>base-sepolia</span>
        </div>
      </header>

      <main className="main-layout">
        <SwapCard {...swap} />

        {(swap.isExecuting || swap.result || swap.flowSteps.some(s => s.status !== 'pending')) && (
          <FlowVisualizer steps={swap.flowSteps} />
        )}

        {swap.result && <ResultsPanel result={swap.result} />}
      </main>
    </div>
  )
}
