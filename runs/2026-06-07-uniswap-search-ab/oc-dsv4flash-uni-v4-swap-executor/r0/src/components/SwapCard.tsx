import { useState } from 'react'
import { TokenSelect } from './TokenSelect'
import type { TokenInfo, TransactionResult } from '../types'
import { useWallet } from '../hooks/useWallet'
import { BalanceDeltaPanel } from './BalanceDeltaPanel'
import { SlippageDisplay } from './SlippageDisplay'
import { TransactionPanel } from './TransactionPanel'

interface SwapCardProps {
  inputToken: TokenInfo | null
  outputToken: TokenInfo | null
  amountIn: string
  amountOut: string
  slippage: number
  deadline: number
  isSwapping: boolean
  isApproving: boolean
  needsApproval: boolean
  error: string | null
  txResult: TransactionResult | null
  onSetInputToken: (t: TokenInfo) => void
  onSetOutputToken: (t: TokenInfo) => void
  onSetAmountIn: (a: string) => void
  onSetSlippage: (s: number) => void
  onSetDeadline: (d: number) => void
  onSwapTokens: () => void
  onExecuteSwap: () => void
  onApproveToken: () => void
}

export function SwapCard({
  inputToken,
  outputToken,
  amountIn,
  amountOut,
  slippage,
  deadline,
  isSwapping,
  isApproving,
  needsApproval,
  error,
  txResult,
  onSetInputToken,
  onSetOutputToken,
  onSetAmountIn,
  onSetSlippage,
  onSetDeadline,
  onSwapTokens,
  onExecuteSwap,
  onApproveToken,
}: SwapCardProps) {
  const { isConnected } = useWallet()
  const [showSettings, setShowSettings] = useState(false)

  const canSwap = isConnected && inputToken && outputToken && amountIn && !isSwapping && !needsApproval
  const showAnalytics = txResult?.balanceDelta || (txResult?.amountOut && txResult?.quotedAmountOut)

  const mainActionBtn = () => {
    if (!isConnected) return 'Connect Wallet to Swap'
    if (isApproving) return 'Approving Permit2...'
    if (isSwapping) return 'Swapping...'
    if (needsApproval) return 'Approve Token'
    if (!inputToken || !outputToken) return 'Select tokens'
    if (!amountIn) return 'Enter an amount'
    return 'Execute Swap'
  }

  const handleMainAction = () => {
    if (needsApproval) {
      onApproveToken()
    } else {
      onExecuteSwap()
    }
  }

  return (
    <div className="swap-container">
      <div className="swap-card">
        <div className="swap-header">
          <h2 className="swap-title">Swap</h2>
          <button
            className="btn-icon"
            onClick={() => setShowSettings(!showSettings)}
            type="button"
            title="Settings"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          </button>
        </div>

        {showSettings && (
          <div className="swap-settings">
            <div className="setting-row">
              <label>Slippage Tolerance</label>
              <div className="setting-input-group">
                {[0.1, 0.5, 1.0].map(val => (
                  <button
                    key={val}
                    className={`setting-chip ${slippage === val ? 'active' : ''}`}
                    onClick={() => onSetSlippage(val)}
                    type="button"
                  >
                    {val}%
                  </button>
                ))}
                <input
                  type="number"
                  className="setting-input"
                  value={slippage}
                  onChange={e => onSetSlippage(parseFloat(e.target.value) || 0.5)}
                  step="0.1"
                  min="0.1"
                  max="50"
                />
                <span className="setting-suffix">%</span>
              </div>
            </div>
            <div className="setting-row">
              <label>Deadline</label>
              <div className="setting-input-group">
                {[10, 30, 60].map(val => (
                  <button
                    key={val}
                    className={`setting-chip ${deadline === val ? 'active' : ''}`}
                    onClick={() => onSetDeadline(val)}
                    type="button"
                  >
                    {val}m
                  </button>
                ))}
                <input
                  type="number"
                  className="setting-input"
                  value={deadline}
                  onChange={e => onSetDeadline(parseInt(e.target.value) || 30)}
                  min="1"
                />
                <span className="setting-suffix">min</span>
              </div>
            </div>
          </div>
        )}

        <div className="swap-input-section">
          <TokenSelect selected={inputToken} onSelect={onSetInputToken} label="You pay" />
          <div className="amount-input-wrap">
            <input
              type="text"
              className="amount-input"
              placeholder="0.0"
              value={amountIn}
              onChange={e => onSetAmountIn(e.target.value)}
              inputMode="decimal"
              autoComplete="off"
            />
            {inputToken && (
              <span className="balance-hint">
                Balance: ...
              </span>
            )}
          </div>
        </div>

        <div className="swap-direction">
          <button className="btn-swap-direction" onClick={onSwapTokens} type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8v12M17 20l4-4M17 20l-4-4"/>
            </svg>
          </button>
        </div>

        <div className="swap-input-section">
          <TokenSelect selected={outputToken} onSelect={onSetOutputToken} label="You receive" />
          <div className="amount-input-wrap">
            <input
              type="text"
              className="amount-input output"
              placeholder="0.0"
              value={txResult?.amountOut || amountOut}
              readOnly
            />
          </div>
        </div>

        {error && (
          <div className="swap-error">{error}</div>
        )}

        <button
          className={`btn btn-primary swap-execute-btn ${(!canSwap && !needsApproval) || isSwapping || isApproving ? 'disabled' : ''}`}
          onClick={handleMainAction}
          disabled={!isConnected || isSwapping || isApproving || (!needsApproval && !canSwap)}
          type="button"
        >
          {mainActionBtn()}
        </button>

        {showAnalytics && (
          <div className="swap-analytics">
            {inputToken && outputToken && (
              <BalanceDeltaPanel
                delta={txResult?.balanceDelta || null}
                token0Symbol={inputToken.symbol}
                token1Symbol={outputToken.symbol}
                token0Decimals={inputToken.decimals}
                token1Decimals={outputToken.decimals}
              />
            )}

            {txResult?.amountOut && txResult?.quotedAmountOut && (
              <SlippageDisplay
                quotedAmountOut={txResult.quotedAmountOut}
                actualAmountOut={txResult.amountOut}
                slippageTolerance={slippage}
              />
            )}

            <TransactionPanel tx={txResult} />
          </div>
        )}
      </div>
    </div>
  )
}
