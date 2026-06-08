import { Header } from './components/Header.tsx'
import { WizardStepIndicator } from './components/WizardStepIndicator.tsx'
import { TokenSelect } from './components/TokenSelect.tsx'
import { FeeTierSelector } from './components/FeeTierSelector.tsx'
import { HooksAddressInput } from './components/HooksAddressInput.tsx'
import { SqrtPriceInput } from './components/SqrtPriceInput.tsx'
import { PriceCalculator } from './components/PriceCalculator.tsx'
import { SummaryPanel } from './components/SummaryPanel.tsx'
import { PoolIdDisplay } from './components/PoolIdDisplay.tsx'
import { usePoolWizard } from './hooks/usePoolWizard.ts'
import { getSortedTokens } from './utils/tokens.ts'

export function App() {
  const {
    config,
    step,
    result,
    poolKey,
    isInitializing,
    validationErrors,
    setToken0,
    setToken1,
    swapTokens,
    setFeeTier,
    setTickSpacing,
    setCustomTickSpacing,
    setHooksAddress,
    setSqrtPriceX96,
    nextStep,
    prevStep,
    goToStep,
    initializePool,
    reset,
  } = usePoolWizard()

  // Check if the selected tokens are in the correct order (currency0 < currency1 by address)
  const needsSortWarning = config.token0 && config.token1
    ? getSortedTokens(config.token0, config.token1)[0].address !== config.token0.address
    : false

  const renderCurrentStep = () => {
    switch (step) {
      case 'tokens':
        return (
          <div className="fade-in">
            <div className="page-heading">
              <h1>Select Pool Tokens</h1>
              <p>Choose the two tokens that will form the trading pair for this V4 pool.</p>
            </div>

            <div className="card">
              <div className="card-title">Token Pair</div>
              <div className="card-subtitle">
                Tokens are automatically sorted by address: the lower address becomes currency0.
              </div>

              <TokenSelect
                selected={config.token0}
                otherSelected={config.token1}
                onChange={setToken0}
                label="Currency 0"
              />

              <TokenSelect
                selected={config.token1}
                otherSelected={config.token0}
                onChange={setToken1}
                label="Currency 1"
              />

              {needsSortWarning && (
                <div className="callout" style={{ marginTop: 8 }}>
                  <span className="callout-icon">!</span>
                  <div>
                    Tokens are in the wrong order. currency0 address must be lower than currency1.
                    Click below to swap them.
                  </div>
                </div>
              )}

              {needsSortWarning && (
                <div className="btn-group" style={{ marginTop: 8 }}>
                  <button className="btn btn-secondary" onClick={swapTokens} type="button">
                    Swap Token Order
                  </button>
                </div>
              )}

              {validationErrors.token0 && (
                <div className="status-badge error" style={{ marginTop: 8 }}>
                  {validationErrors.token0}
                </div>
              )}
              {validationErrors.token1 && (
                <div className="status-badge error" style={{ marginTop: 8 }}>
                  {validationErrors.token1}
                </div>
              )}
            </div>

            <div className="btn-group">
              <div />
              <button className="btn btn-primary" onClick={nextStep} type="button">
                Next: Fee Tier
              </button>
            </div>
          </div>
        )

      case 'fees':
        return (
          <div className="fade-in">
            <div className="page-heading">
              <h1>Set Fee Tier</h1>
              <p>Choose the swap fee and tick spacing for this pool.</p>
            </div>

            <div className="card">
              <FeeTierSelector
                selected={config.feeTier}
                tickSpacing={config.tickSpacing}
                customTickSpacing={config.customTickSpacing}
                onFeeChange={setFeeTier}
                onTickSpacingChange={setTickSpacing}
                onCustomToggle={setCustomTickSpacing}
              />
              {validationErrors.feeTier && (
                <div className="status-badge error">{validationErrors.feeTier}</div>
              )}
            </div>

            <div className="btn-group">
              <button className="btn btn-secondary" onClick={prevStep} type="button">
                Back
              </button>
              <button className="btn btn-primary" onClick={nextStep} type="button">
                Next: Hooks
              </button>
            </div>
          </div>
        )

      case 'hooks':
        return (
          <div className="fade-in">
            <div className="page-heading">
              <h1>Configure Hooks</h1>
              <p>Optionally attach a hook contract for custom pool behavior.</p>
            </div>

            <div className="card">
              <HooksAddressInput
                value={config.hooksAddress}
                onChange={setHooksAddress}
              />
              {validationErrors.hooksAddress && (
                <div className="status-badge error">{validationErrors.hooksAddress}</div>
              )}
            </div>

            <div className="btn-group">
              <button className="btn btn-secondary" onClick={prevStep} type="button">
                Back
              </button>
              <button className="btn btn-primary" onClick={nextStep} type="button">
                Next: Initial Price
              </button>
            </div>
          </div>
        )

      case 'price':
        return (
          <div className="fade-in">
            <div className="page-heading">
              <h1>Set Initial Price</h1>
              <p>Define the starting sqrtPriceX96 for the pool.</p>
            </div>

            <div className="card">
              <SqrtPriceInput
                value={config.sqrtPriceX96}
                onChange={setSqrtPriceX96}
                token0={config.token0}
                token1={config.token1}
              />
              {validationErrors.sqrtPriceX96 && (
                <div className="status-badge error">{validationErrors.sqrtPriceX96}</div>
              )}
            </div>

            <PriceCalculator
              sqrtPriceX96={config.sqrtPriceX96}
              token0={config.token0}
              token1={config.token1}
              onSqrtPriceChange={setSqrtPriceX96}
            />

            <div className="btn-group">
              <button className="btn btn-secondary" onClick={prevStep} type="button">
                Back
              </button>
              <button className="btn btn-primary" onClick={nextStep} type="button">
                Next: Review
              </button>
            </div>
          </div>
        )

      case 'review':
        return (
          <div className="fade-in">
            <div className="page-heading">
              <h1>Review &amp; Initialize</h1>
              <p>Verify all pool parameters before calling PoolManager.initialize().</p>
            </div>

            <div className="card">
              <div className="card-title">Pool Configuration Summary</div>
              <SummaryPanel config={config} poolKey={poolKey} />
            </div>

            <div className="card">
              <div className="card-title">PoolManager.initialize()</div>
              <div className="card-subtitle">
                Calling <code style={{ fontSize: 12 }}>PoolManager.initialize(PoolKey, sqrtPriceX96)</code> on the V4 PoolManager contract.
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', padding: '8px 0' }}>
                Contract: <span style={{ color: 'var(--text-link)' }}>0x00000000000444c5dc75cB358380D2e3dE08A90</span>
              </div>
            </div>

            <div className="btn-group">
              <button className="btn btn-secondary" onClick={prevStep} type="button">
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={initializePool}
                disabled={isInitializing}
                type="button"
              >
                {isInitializing ? (
                  <>
                    <span className="skeleton" style={{ width: 16, height: 16, display: 'inline-block' }} />
                    Initializing...
                  </>
                ) : (
                  'Initialize Pool'
                )}
              </button>
            </div>
          </div>
        )

      case 'result':
        return result ? (
          <PoolIdDisplay result={result} onReset={reset} />
        ) : null

      default:
        return null
    }
  }

  return (
    <>
      <Header />
      <main className="app-main">
        {step !== 'result' && (
          <WizardStepIndicator currentStep={step} onStepClick={goToStep} />
        )}
        {renderCurrentStep()}

        {validationErrors.initialize && (
          <div className="toast error" style={{ position: 'fixed', bottom: 24, right: 24 }}>
            {validationErrors.initialize}
          </div>
        )}
      </main>
    </>
  )
}
