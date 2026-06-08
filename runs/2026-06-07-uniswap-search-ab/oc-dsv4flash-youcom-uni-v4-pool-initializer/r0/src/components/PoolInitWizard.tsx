import { useState, useCallback, useMemo, useEffect } from 'react'
import { useAccount, useWriteContract } from 'wagmi'
import { keccak256, encodeAbiParameters, isAddress } from 'viem'
import type { WizardStep, TokenInfo, PoolKey } from '../types'
import { COMMON_TOKENS, FEE_TIERS, ZERO_ADDRESS, POOL_MANAGER_ADDRESS, POOL_MANAGER_ABI } from '../constants'
import PriceCalculator from './PriceCalculator'

const STEP_LABELS: Record<WizardStep, string> = {
  tokens: 'Tokens',
  config: 'Fee & Spacing',
  hooks: 'Hooks',
  price: 'Initial Price',
  review: 'Review',
  result: 'Result',
}

const STEP_ORDER: WizardStep[] = ['tokens', 'config', 'hooks', 'price', 'review', 'result']
const VISIBLE_STEPS: WizardStep[] = ['tokens', 'config', 'hooks', 'price', 'review']

function computePoolId(key: PoolKey): `0x${string}` {
  const encoded = encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'uint24' },
      { type: 'int24' },
      { type: 'address' },
    ],
    [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
  )
  return keccak256(encoded)
}

export default function PoolInitWizard() {
  const [step, setStep] = useState<WizardStep>('tokens')
  const [token0, setToken0] = useState<TokenInfo | null>(null)
  const [token1, setToken1] = useState<TokenInfo | null>(null)
  const [customAddr0, setCustomAddr0] = useState('')
  const [customAddr1, setCustomAddr1] = useState('')
  const [feeTierIndex, setFeeTierIndex] = useState(0)
  const [hooksAddr, setHooksAddr] = useState('')
  const [sqrtPriceInput, setSqrtPriceInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { isConnected } = useAccount()
  const { writeContract, data: txHash, isPending, isSuccess, error: txError } = useWriteContract()

  const currentStepIndex = STEP_ORDER.indexOf(step)

  const [sortError, setSortError] = useState<string | null>(null)

  const poolKey = useMemo<PoolKey | null>(() => {
    if (!token0 || !token1) return null
    const addr0 = token0.address.toLowerCase()
    const addr1 = token1.address.toLowerCase()
    if (addr0 === addr1) {
      setSortError('Select two different tokens')
      return null
    }
    if (addr0 > addr1) {
      setSortError('currency0 address must be less than currency1 address (lexicographic order)')
      return null
    }
    setSortError(null)
    return {
      currency0: token0.address,
      currency1: token1.address,
      fee: FEE_TIERS[feeTierIndex].value,
      tickSpacing: FEE_TIERS[feeTierIndex].tickSpacing,
      hooks: hooksAddr && isAddress(hooksAddr) ? hooksAddr as `0x${string}` : ZERO_ADDRESS,
    }
  }, [token0, token1, feeTierIndex, hooksAddr])

  const computedPoolId = useMemo(() => {
    if (!poolKey) return null
    try {
      return computePoolId(poolKey)
    } catch {
      return null
    }
  }, [poolKey])

  const sqrtBigInt = useMemo(() => {
    try { return BigInt(sqrtPriceInput || '0') } catch { return 0n }
  }, [sqrtPriceInput])

  const isStepValid = useCallback((s: WizardStep): boolean => {
    switch (s) {
      case 'tokens':
        return token0 !== null && token1 !== null && token0.address !== token1.address
      case 'config':
        return true
      case 'hooks':
        return true
      case 'price':
        return sqrtPriceInput !== '' && sqrtBigInt > 0n
      case 'review':
        return true
      case 'result':
        return true
    }
  }, [token0, token1, sqrtPriceInput, sqrtBigInt])

  const canAdvance = isStepValid(step) && step !== 'result'

  const handleNext = useCallback(() => {
    setError(null)
    if (!canAdvance) {
      if (step === 'tokens' && (!token0 || !token1)) {
        setError('Select both tokens')
      } else       if (step === 'tokens' && token0?.address === token1?.address) {
        setError('Select two different tokens')
      } else if (step === 'price' && sqrtBigInt <= 0n) {
        setError('Enter a valid sqrtPriceX96 greater than 0')
      }
      return
    }
    const nextIdx = currentStepIndex + 1
    if (nextIdx < STEP_ORDER.length) {
      setStep(STEP_ORDER[nextIdx])
    }
  }, [canAdvance, step, currentStepIndex, token0, token1, sqrtBigInt])

  const handleBack = useCallback(() => {
    setError(null)
    const prevIdx = currentStepIndex - 1
    if (prevIdx >= 0) {
      setStep(STEP_ORDER[prevIdx])
    }
  }, [currentStepIndex])

  const handleInitialize = useCallback(() => {
    setError(null)
    if (!isConnected) {
      setError('Connect your wallet to initialize the pool')
      return
    }
    if (!poolKey) {
      setError('Invalid pool configuration')
      return
    }
    if (sqrtBigInt <= 0n) {
      setError('Invalid sqrtPriceX96')
      return
    }
    writeContract({
      address: POOL_MANAGER_ADDRESS,
      abi: POOL_MANAGER_ABI,
      functionName: 'initialize',
      args: [poolKey, sqrtBigInt],
    })
  }, [isConnected, poolKey, sqrtBigInt, writeContract])

  const handleReset = useCallback(() => {
    setStep('tokens')
    setToken0(null)
    setToken1(null)
    setCustomAddr0('')
    setCustomAddr1('')
    setFeeTierIndex(0)
    setHooksAddr('')
    setSqrtPriceInput('')
    setError(null)
  }, [])

  const handleTokenSelect = useCallback((side: 0 | 1, token: TokenInfo) => {
    if (side === 0) {
      setToken0(token)
      setCustomAddr0('')
    } else {
      setToken1(token)
      setCustomAddr1('')
    }
    setError(null)
  }, [])

  const handleCustomAddr = useCallback((side: 0 | 1, addr: string) => {
    if (side === 0) {
      setCustomAddr0(addr)
      if (isAddress(addr)) {
        setToken0({ symbol: addr.slice(0, 10), name: 'Custom Token', address: addr as `0x${string}`, decimals: 18 })
      }
    } else {
      setCustomAddr1(addr)
      if (isAddress(addr)) {
        setToken1({ symbol: addr.slice(0, 10), name: 'Custom Token', address: addr as `0x${string}`, decimals: 18 })
      }
    }
    setError(null)
  }, [])

  const handleViewResult = useCallback(() => {
    setStep('result')
  }, [])

  const tokensOk = token0 !== null && token1 !== null

  const txErrorMsg = txError ? (txError as { shortMessage?: string }).shortMessage || txError.message : null

  useEffect(() => {
    if (isSuccess && txHash) {
      setStep('result')
    }
  }, [isSuccess, txHash])

  const renderTokenStep = () => (
    <div className="wizard-step">
      <h3 className="step-title">Select Pool Tokens</h3>
      <p className="step-desc">Choose the two tokens for the liquidity pool. Currency 0 and Currency 1 are ordered by address.</p>
      <div className="token-columns">
        <div className="token-col">
          <label className="field-label">Currency 0</label>
          <div className="token-grid">
            {COMMON_TOKENS.map(t => (
              <button
                key={t.symbol}
                className={`token-btn ${token0?.symbol === t.symbol && token0?.address === t.address ? 'selected' : ''}`}
                onClick={() => handleTokenSelect(0, t)}
              >
                <span className="token-symbol">{t.symbol}</span>
                <span className="token-name">{t.name}</span>
                <span className="token-decimals">{t.decimals} decimals</span>
              </button>
            ))}
          </div>
          <input
            type="text"
            className="input input-sm"
            placeholder="Custom token address (0x...)"
            value={customAddr0}
            onChange={(e) => handleCustomAddr(0, e.target.value)}
          />
        </div>
        <div className="token-divider">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14m0 0l-6-6m6 6l6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="token-col">
          <label className="field-label">Currency 1</label>
          <div className="token-grid">
            {COMMON_TOKENS.map(t => (
              <button
                key={t.symbol}
                className={`token-btn ${token1?.symbol === t.symbol && token1?.address === t.address ? 'selected' : ''}`}
                onClick={() => handleTokenSelect(1, t)}
              >
                <span className="token-symbol">{t.symbol}</span>
                <span className="token-name">{t.name}</span>
                <span className="token-decimals">{t.decimals} decimals</span>
              </button>
            ))}
          </div>
          <input
            type="text"
            className="input input-sm"
            placeholder="Custom token address (0x...)"
            value={customAddr1}
            onChange={(e) => handleCustomAddr(1, e.target.value)}
          />
        </div>
      </div>
      {tokensOk && (
        <div className="token-summary">
          {token0!.symbol} ({token0!.address.slice(0, 10)}...) ↔ {token1!.symbol} ({token1!.address.slice(0, 10)}...)
        </div>
      )}
      {sortError && <p className="field-error">{sortError}</p>}
    </div>
  )

  const renderConfigStep = () => (
    <div className="wizard-step">
      <h3 className="step-title">Fee Tier & Tick Spacing</h3>
      <p className="step-desc">Select the fee tier for the pool. Tick spacing is derived from the fee tier.</p>
      <div className="fee-grid">
        {FEE_TIERS.map((ft, i) => (
          <button
            key={ft.value}
            className={`fee-card ${feeTierIndex === i ? 'selected' : ''}`}
            onClick={() => { setFeeTierIndex(i); setError(null) }}
          >
            <span className="fee-label">{ft.label}</span>
            <span className="fee-tick">tickSpacing: {ft.tickSpacing}</span>
            <span className="fee-desc">{ft.description}</span>
          </button>
        ))}
      </div>
      <div className="config-details">
        <div className="config-row">
          <span className="config-row-label">Fee value</span>
          <span className="config-row-value">{FEE_TIERS[feeTierIndex].value} (0.0{FEE_TIERS[feeTierIndex].value === 100 ? '1' : FEE_TIERS[feeTierIndex].value === 500 ? '05' : FEE_TIERS[feeTierIndex].value === 3000 ? '30' : '00'}%)</span>
        </div>
        <div className="config-row">
          <span className="config-row-label">Tick spacing</span>
          <span className="config-row-value">{FEE_TIERS[feeTierIndex].tickSpacing}</span>
        </div>
      </div>
    </div>
  )

  const renderHooksStep = () => (
    <div className="wizard-step">
      <h3 className="step-title">Hooks Contract</h3>
      <p className="step-desc">
        Optionally specify a hooks contract that implements <code>IHooks</code>. Leave empty for no hooks.
      </p>
      <div className="hooks-field">
        <label className="field-label">Hooks Address</label>
        <input
          type="text"
          className="input input-mono"
          placeholder="0x0000000000000000000000000000000000000000 (zero = no hooks)"
          value={hooksAddr}
          onChange={(e) => { setHooksAddr(e.target.value); setError(null) }}
        />
        {hooksAddr && !isAddress(hooksAddr) && (
          <p className="field-error">Invalid address format</p>
        )}
        {(!hooksAddr || hooksAddr === ZERO_ADDRESS) && (
          <p className="field-hint">Using zero address — no hooks will be called</p>
        )}
        {hooksAddr && isAddress(hooksAddr) && hooksAddr !== ZERO_ADDRESS && (
          <p className="field-hint">Hooks contract: {hooksAddr.slice(0, 10)}...{hooksAddr.slice(-4)}</p>
        )}
      </div>
    </div>
  )

  const renderPriceStep = () => (
    <div className="wizard-step">
      <h3 className="step-title">Initial Price</h3>
      <p className="step-desc">Set the initial sqrtPriceX96 for the pool, or use the calculator to convert from a human-readable price.</p>
      <div className="price-field">
        <label className="field-label">sqrtPriceX96</label>
        <input
          type="text"
          className="input input-mono"
          placeholder="e.g. 79228162514264337593543950336"
          value={sqrtPriceInput}
          onChange={(e) => { setSqrtPriceInput(e.target.value); setError(null) }}
        />
        {sqrtPriceInput !== '' && sqrtBigInt <= 0n && (
          <p className="field-error">Must be a positive integer</p>
        )}
      </div>
      {token0 && token1 && (
        <PriceCalculator
          decimals0={token0.decimals}
          decimals1={token1.decimals}
          sqrtPriceX96={sqrtPriceInput}
          onSqrtPriceX96Change={setSqrtPriceInput}
        />
      )}
    </div>
  )

  const renderReviewStep = () => (
    <div className="wizard-step">
      <h3 className="step-title">Review & Initialize</h3>
      <p className="step-desc">Review the pool parameters before initializing.</p>
      <div className="review-card">
        <div className="review-section">
          <h4 className="review-section-title">Pool Key</h4>
          <div className="review-row">
            <span className="review-label">Currency 0</span>
            <span className="review-value">{token0?.symbol} <span className="review-addr">{token0?.address.slice(0, 10)}...</span></span>
          </div>
          <div className="review-row">
            <span className="review-label">Currency 1</span>
            <span className="review-value">{token1?.symbol} <span className="review-addr">{token1?.address.slice(0, 10)}...</span></span>
          </div>
          <div className="review-row">
            <span className="review-label">Fee</span>
            <span className="review-value">{FEE_TIERS[feeTierIndex].label}</span>
          </div>
          <div className="review-row">
            <span className="review-label">Tick Spacing</span>
            <span className="review-value">{FEE_TIERS[feeTierIndex].tickSpacing}</span>
          </div>
          <div className="review-row">
            <span className="review-label">Hooks</span>
            <span className="review-value review-mono">{hooksAddr || ZERO_ADDRESS}</span>
          </div>
          <div className="review-row">
            <span className="review-label">sqrtPriceX96</span>
            <span className="review-value review-mono">{sqrtPriceInput || '0'}</span>
          </div>
        </div>
        {computedPoolId && (
          <div className="review-pool-id">
            <h4 className="review-section-title">Computed Pool ID</h4>
            <div className="pool-id-display">
              <code>{computedPoolId}</code>
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(computedPoolId)}>
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
      {!isConnected && (
        <p className="review-warning">Connect your wallet to send the initialization transaction. You can still view the pool ID below.</p>
      )}
      {txHash && (
        <div className="review-tx">
          <h4 className="review-section-title">Transaction</h4>
          <p className="review-tx-hash">Tx: <code>{txHash.slice(0, 20)}...</code></p>
        </div>
      )}
      {isPending && <p className="review-pending">Transaction pending...</p>}
      {isSuccess && <p className="review-success">Pool initialized successfully!</p>}
      {txErrorMsg && <p className="field-error">{txErrorMsg}</p>}
      {error && <p className="field-error">{error}</p>}
    </div>
  )

  const renderResultStep = () => (
    <div className="wizard-step wizard-step-result">
      <div className="result-icon">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
          <path d="M16 24l6 6 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <h3 className="step-title">Pool Configuration Ready</h3>
      {computedPoolId && (
        <div className="result-pool-id">
          <label className="field-label">Pool ID</label>
          <div className="pool-id-box">
            <code>{computedPoolId}</code>
            <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(computedPoolId)}>
              Copy
            </button>
          </div>
        </div>
      )}
      {txHash && (
        <div className="result-tx">
          <label className="field-label">Transaction</label>
          <code className="result-tx-hash">{txHash}</code>
        </div>
      )}
      <div className="result-details">
        <div className="result-detail-row">
          <span>Pool</span>
          <span>{token0?.symbol} / {token1?.symbol}</span>
        </div>
        <div className="result-detail-row">
          <span>Fee</span>
          <span>{FEE_TIERS[feeTierIndex].label}</span>
        </div>
        <div className="result-detail-row">
          <span>Hooks</span>
          <span>{(hooksAddr && isAddress(hooksAddr) && hooksAddr !== ZERO_ADDRESS) ? 'Enabled' : 'None'}</span>
        </div>
      </div>
      {!isConnected && (
        <p className="result-note">Connect a wallet and initialize to create this pool on-chain.</p>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  )

  return (
    <div className="wizard">
      <div className="wizard-progress">
        {VISIBLE_STEPS.map((s, i) => {
          const stepIdx = STEP_ORDER.indexOf(s)
          const isActive = stepIdx === currentStepIndex
          const isComplete = stepIdx < currentStepIndex
          return (
            <div
              key={s}
              className={`wizard-step-dot ${isActive ? 'active' : ''} ${isComplete ? 'completed' : ''}`}
            >
              <div className="wizard-step-number">{i + 1}</div>
              <div className="wizard-step-label">{STEP_LABELS[s]}</div>
              {i < VISIBLE_STEPS.length - 1 && <div className="wizard-step-line" />}
            </div>
          )
        })}
      </div>
      <div className="wizard-body">
        {step === 'tokens' && renderTokenStep()}
        {step === 'config' && renderConfigStep()}
        {step === 'hooks' && renderHooksStep()}
        {step === 'price' && renderPriceStep()}
        {step === 'review' && renderReviewStep()}
        {step === 'result' && renderResultStep()}
      </div>
      {step !== 'result' && (
        <div className="wizard-footer">
          {currentStepIndex > 0 && (
            <button className="btn btn-ghost" onClick={handleBack}>
              Back
            </button>
          )}
          <div className="wizard-footer-right">
            {step === 'review' ? (
              <>
                <button className="btn btn-ghost" onClick={handleViewResult}>
                  View Pool ID
                </button>
                <button
                  className="btn btn-accent"
                  onClick={handleInitialize}
                  disabled={isPending}
                >
                  {isPending ? 'Initializing...' : 'Initialize Pool'}
                </button>
              </>
            ) : (
              <button className="btn btn-accent" onClick={handleNext}>
                Continue
              </button>
            )}
          </div>
        </div>
      )}
      {step === 'result' && (
        <div className="wizard-footer">
          <button className="btn btn-accent" onClick={handleReset}>
            Create Another Pool
          </button>
        </div>
      )}
    </div>
  )
}
