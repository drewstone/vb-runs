import WalletConnect from './components/WalletConnect'
import PoolInitWizard from './components/PoolInitWizard'

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-logo">
          <span className="logo-icon">U4</span>
          <span className="logo-text">V4 Pool Initializer</span>
        </div>
        <WalletConnect />
      </header>
      <main className="app-main">
        <PoolInitWizard />
      </main>
    </div>
  )
}
