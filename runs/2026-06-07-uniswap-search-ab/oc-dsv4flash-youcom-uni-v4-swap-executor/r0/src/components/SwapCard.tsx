import { type TokenInfo } from '../types'

interface SwapCardProps {
  tokenIn: TokenInfo
  tokenOut: TokenInfo
  amountIn: string
  slippage: number
  isExecuting: boolean
  isApprovePending: boolean
  isSwapPending: boolean
  isConnected: boolean
  address: `0x${string}` | undefined
  setAmountIn: (v: string) => void
  setSlippage: (v: number) => void
  switchTokens: () => void
  executeSwap: () => void
  connectWallet: () => void
  disconnect: () => void
}

const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0]

export function SwapCard({
  tokenIn,
  tokenOut,
  amountIn,
  slippage,
  isExecuting,
  isApprovePending,
  isSwapPending,
  isConnected,
  address,
  setAmountIn,
  setSlippage,
  switchTokens,
  executeSwap,
  connectWallet,
  disconnect,
}: SwapCardProps) {
  const isValid = amountIn && parseFloat(amountIn) > 0
  const isBusy = isExecuting

  return (
    <div className="card swap-card">
      <div className="card-header">
        <span className="card-title">Swap</span>
        {isConnected && address && (
          <button
            onClick={disconnect}
            style={{
              background: 'transparent', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '4px 10px',
              color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
            }}
          >
            {address.slice(0, 6)}...{address.slice(-4)}
          </button>
        )}
      </div>

      <div className="token-input-row">
        <button className="token-select" onClick={() => {}}>
          <span className="token-dot" style={{ background: tokenIn.color }}>
            {tokenIn.symbol[0]}
          </span>
          {tokenIn.symbol}
          <span className="token-select-arrow">▼</span>
        </button>
        <input
          className="amount-input"
          type="text"
          inputMode="decimal"
          value={amountIn}
          onChange={e => setAmountIn(e.target.value)}
          placeholder="0.0"
          disabled={isBusy}
        />
      </div>

      <button className="swap-direction-btn" onClick={switchTokens} disabled={isBusy}>
        ⇅
      </button>

      <div className="token-input-row" style={{ opacity: 0.6 }}>
        <button className="token-select" onClick={() => {}}>
          <span className="token-dot" style={{ background: tokenOut.color }}>
            {tokenOut.symbol[0]}
          </span>
          {tokenOut.symbol}
          <span className="token-select-arrow">▼</span>
        </button>
        <input
          className="amount-input"
          type="text"
          value="—"
          readOnly
        />
      </div>

      <div className="swap-settings">
        <div className="settings-row">
          <span className="settings-label">Slippage Tolerance</span>
          <div className="slippage-control">
            {SLIPPAGE_PRESETS.map(p => (
              <button
                key={p}
                className={`slippage-preset ${slippage === p ? 'active' : ''}`}
                onClick={() => setSlippage(p)}
              >
                {p}%
              </button>
            ))}
            <input
              className="slippage-input"
              type="number"
              value={slippage}
              onChange={e => setSlippage(parseFloat(e.target.value) || 0)}
              min={0}
              max={100}
              step={0.1}
            />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>%</span>
          </div>
        </div>

        <div className="settings-row">
          <span className="settings-label">Deadline</span>
          <span className="settings-value">+30 min</span>
        </div>
      </div>

      {!isConnected ? (
        <button className="execute-btn" onClick={connectWallet}>
          Connect Wallet
        </button>
      ) : (
        <button
          className={`execute-btn ${isBusy ? 'executing' : ''}`}
          disabled={!isValid || isBusy}
          onClick={executeSwap}
        >
          {isBusy ? (
            <>
              <span className="btn-spinner" />
              {isApprovePending ? 'Approving Permit2...' : isSwapPending ? 'Confirm Swap in Wallet...' : 'Executing...'}
            </>
          ) : (
            `Swap ${amountIn || '0'} ${tokenIn.symbol} → ${tokenOut.symbol}`
          )}
        </button>
      )}
    </div>
  )
}
