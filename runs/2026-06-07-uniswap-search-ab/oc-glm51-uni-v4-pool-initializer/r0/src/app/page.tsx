'use client'

import { useAccount, useWriteContract, useWaitForTransactionReceipt, useConnect, useDisconnect } from 'wagmi'
import { sepolia } from 'viem/chains'
import { useState, type FormEvent } from 'react'
import { Pool } from '@uniswap/v4-sdk'
import { Token } from '@uniswap/sdk-core'
import { encodeSqrtRatioX96, decodeSqrtRatioX96 } from '@/lib/math'
import {
  POOL_MANAGER_SEPOLIA,
  POOLMANAGER_ABI,
  isAddress,
  buildPoolKey,
  encodeInitializeCallData,
} from '@/lib/poolmanager'

const SEPOLIA_CHAIN_ID = 11155111
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

const FeeAmount = { LOWEST: 100, LOW: 500, MEDIUM: 3000, HIGH: 10000 } as const
const TICK_SPACINGS: Record<number, number> = {
  [FeeAmount.LOWEST]: 1,
  [FeeAmount.LOW]: 10,
  [FeeAmount.MEDIUM]: 60,
  [FeeAmount.HIGH]: 200,
}
const FEE_OPTIONS = [
  { label: '0.01%', value: FeeAmount.LOWEST },
  { label: '0.05%', value: FeeAmount.LOW },
  { label: '0.30%', value: FeeAmount.MEDIUM },
  { label: '1.00%', value: FeeAmount.HIGH },
]

function makeToken(addr: string): Token {
  return new Token(SEPOLIA_CHAIN_ID, addr, 18, 'TKN', 'Token')
}

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connectors, connect } = useConnect()
  const { disconnect } = useDisconnect()

  const [currency0Input, setCurrency0Input] = useState('')
  const [currency1Input, setCurrency1Input] = useState('')
  const [fee, setFee] = useState<number>(FeeAmount.MEDIUM)
  const [tickSpacing, setTickSpacing] = useState(60)
  const [hooksAddress, setHooksAddress] = useState(ZERO_ADDR)
  const [sqrtPriceX96Input, setSqrtPriceX96Input] = useState((2n ** 96n).toString())
  const [computedPoolId, setComputedPoolId] = useState<string | null>(null)
  const [swappedWarning, setSwappedWarning] = useState(false)
  const [activeTab, setActiveTab] = useState<'init' | 'calc'>('init')

  const { writeContract, data: txHash, isPending: isWriting, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  const c0Valid = isAddress(currency0Input)
  const c1Valid = isAddress(currency1Input)
  const bothValid = c0Valid && c1Valid
  const sameAddr = bothValid && currency0Input.toLowerCase() === currency1Input.toLowerCase()

  const needsSwap = bothValid && !sameAddr && currency0Input.toLowerCase() > currency1Input.toLowerCase()
  const poolKey = bothValid && !sameAddr
    ? buildPoolKey(currency0Input, currency1Input, fee, tickSpacing, hooksAddress)
    : null

  const displayPrice = decodeSqrtRatioX96(BigInt(sqrtPriceX96Input || '0'), 18, 18)

  if (needsSwap !== swappedWarning) {
    setSwappedWarning(needsSwap)
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!bothValid || sameAddr || !poolKey) return

    const sqrtX96 = BigInt(sqrtPriceX96Input)
    if (sqrtX96 <= 0n) return

    const hooks = poolKey.hooks

    try {
      const poolId = Pool.getPoolId(
        makeToken(poolKey.currency0),
        makeToken(poolKey.currency1),
        fee,
        tickSpacing,
        hooks,
      )
      setComputedPoolId(poolId)
    } catch (err) {
      console.error('Pool ID computation failed:', err)
    }

    const initData = encodeInitializeCallData(poolKey, sqrtX96)

    writeContract({
      address: POOL_MANAGER_SEPOLIA,
      abi: POOLMANAGER_ABI,
      functionName: 'unlock',
      chain: sepolia,
      account: address!,
      args: [initData],
    })
  }

  const sqrtValid = /^\d+$/.test(sqrtPriceX96Input) && BigInt(sqrtPriceX96Input) > 0n
  const isValid = bothValid && !sameAddr && sqrtValid

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header">
        <div className="logo-area">
          <div className="logo-icon">V4</div>
          <h1 className="logo-title">Uniswap <span>V4</span> Pool Initializer</h1>
        </div>
        <div>
          {isConnected ? (
            <button className="btn btn-wallet" onClick={() => disconnect()}>
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          ) : (
            <button className="btn btn-connect" onClick={() => { const c = connectors[0]; if (c) connect({ connector: c }) }}>
              Connect Wallet
            </button>
          )}
        </div>
      </header>

      <main className="main-content">
        <nav className="tabs">
          {(['init', 'calc'] as const).map(tab => (
            <button
              key={tab}
              className={`tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'init' ? 'Initialize Pool' : 'Price Calculator'}
            </button>
          ))}
        </nav>

        {activeTab === 'init' && (
          <form onSubmit={handleSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h2 className="card-title">Pool Configuration</h2>

            <div className="form-grid">
              <div className="form-group">
                <label>Currency 0 (Address)</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={currency0Input}
                  onChange={e => setCurrency0Input(e.target.value)}
                  className={currency0Input && !c0Valid ? 'invalid' : ''}
                />
              </div>
              <div className="form-group">
                <label>Currency 1 (Address)</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={currency1Input}
                  onChange={e => setCurrency1Input(e.target.value)}
                  className={currency1Input && !c1Valid ? 'invalid' : ''}
                />
              </div>
            </div>

            {bothValid && !sameAddr && poolKey && (
              <div className="pair-display">
                <span className="token-badge">{poolKey.currency0.slice(0, 10)}...</span>
                <span style={{ color: 'var(--ink-muted)' }}>/</span>
                <span className="token-badge">{poolKey.currency1.slice(0, 10)}...</span>
                {needsSwap ? (
                  <span className="pair-note" style={{ color: 'var(--pink)' }}>
                    auto-sorted (addresses swapped to enforce currency0 &lt; currency1)
                  </span>
                ) : (
                  <span className="pair-note">sorted: currency0 &lt; currency1</span>
                )}
              </div>
            )}

            {sameAddr && (
              <p className="validation-error">Currency 0 and Currency 1 must be different addresses.</p>
            )}

            <div className="form-grid">
              <div className="form-group">
                <label>Fee Tier</label>
                <select value={fee} onChange={e => {
                  const v = Number(e.target.value)
                  setFee(v)
                  if (v in TICK_SPACINGS) setTickSpacing(TICK_SPACINGS[v])
                }}>
                  {FEE_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label} ({o.value})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Tick Spacing</label>
                <input type="number" value={tickSpacing} onChange={e => setTickSpacing(Number(e.target.value))} min={1} max={16384} />
              </div>
            </div>

            <div className="form-group">
              <label>Hooks Address</label>
              <input type="text" placeholder={ZERO_ADDR} value={hooksAddress} onChange={e => setHooksAddress(e.target.value)} />
              <span className="hint">Use zero address for no hooks</span>
            </div>

            <div className="form-group">
              <label>sqrtPriceX96</label>
              <input
                type="text"
                value={sqrtPriceX96Input}
                onChange={e => setSqrtPriceX96Input(e.target.value)}
                placeholder={(2n ** 96n).toString()}
                className={`mono ${sqrtPriceX96Input && !/^\d+$/.test(sqrtPriceX96Input) ? 'invalid' : ''}`}
              />
              <span className="hint">
                Default 2^96 = 1:1. Human-readable price: <strong>{displayPrice}</strong>
              </span>
            </div>

            {poolKey && (
              <div className="divider">
                <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>Pool Summary</h3>
                <div className="summary-rows">
                  {([
                    ['currency0', poolKey.currency0],
                    ['currency1', poolKey.currency1],
                    ['fee', `${fee} (${(fee / 10000).toFixed(2)}%)`],
                    ['tickSpacing', String(tickSpacing)],
                    ['hooks', hooksAddress === ZERO_ADDR ? 'NONE (address(0))' : hooksAddress],
                  ] as const).map(([label, value]) => (
                    <div key={label} className="summary-row">
                      <span className="label">{label}</span>
                      <code>{value}</code>
                    </div>
                  ))}
                  <div className="summary-row accent">
                    <span className="label">sqrtPriceX96</span>
                    <code>{sqrtPriceX96Input}</code>
                  </div>
                  <div className="summary-row">
                    <span className="label">price (token1/token0)</span>
                    <code style={{ color: 'var(--accent)' }}>{displayPrice}</code>
                  </div>
                </div>

                <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', background: 'var(--bg-input)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--ink-muted)' }}>
                  V4 unlock pattern: calls PoolManager.unlock(abi.encodeCall(initialize, (key, sqrtPriceX96))). Requires a contract implementing unlockCallback on the calling address.
                </div>
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={!isValid || isWriting || isConfirming}>
              {isWriting ? 'Confirm in wallet...' : isConfirming ? 'Initializing...' : 'Initialize Pool'}
            </button>

            {writeError && (
              <div className="error-box">
                <strong>Error:</strong> {writeError.message.slice(0, 300)}
              </div>
            )}

            {computedPoolId && (
              <div className="poolid-box">
                <div className="poolid-label">Pool ID</div>
                <code className="poolid-value">{computedPoolId}</code>
                <button type="button" className="btn-copy" onClick={() => navigator.clipboard.writeText(computedPoolId)}>
                  Copy
                </button>
              </div>
            )}

            {isConfirmed && txHash && (
              <div className="success-box">
                Pool initialized! TX:{' '}
                <a href={`https://sepolia.etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer">
                  {txHash.slice(0, 10)}...{txHash.slice(-8)}
                </a>
              </div>
            )}
          </form>
        )}

        {activeTab === 'calc' && <PriceCalculator />}
      </main>
    </div>
  )
}

function PriceCalculator() {
  const [priceInput, setPriceInput] = useState('1')
  const [sqrtInput, setSqrtInput] = useState((2n ** 96n).toString())
  const [dec0, setDec0] = useState(18)
  const [dec1, setDec1] = useState(18)
  const [lastDir, setLastDir] = useState<'toSqrt' | 'toPrice'>('toSqrt')

  function handlePriceToSqrt() {
    const p = parseFloat(priceInput)
    if (isNaN(p) || p <= 0) return
    const scaled1 = BigInt(Math.round(p * 10 ** dec1))
    const one0 = BigInt(10 ** dec0)
    const sqrt = encodeSqrtRatioX96(scaled1, one0)
    setSqrtInput(sqrt.toString())
    setLastDir('toSqrt')
  }

  function handleSqrtToPrice() {
    const human = decodeSqrtRatioX96(BigInt(sqrtInput || '0'), dec0, dec1)
    setPriceInput(human)
    setLastDir('toPrice')
  }

  return (
    <div className="card card-blue" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h2 className="card-title" style={{ color: 'var(--blue)' }}>sqrtPriceX96 ↔ Price Converter</h2>

      <div className="calc-grid">
        <div className="form-group">
          <label>Human-Readable Price</label>
          <input type="text" value={priceInput} onChange={e => setPriceInput(e.target.value)} placeholder="1.0" />
          <span className="hint">token1 per token0</span>
        </div>
        <div className="arrow-col">
          <button className="btn-arrow" onClick={handlePriceToSqrt} title="Price → sqrtPriceX96">→</button>
          <button className="btn-arrow" onClick={handleSqrtToPrice} title="sqrtPriceX96 → Price">←</button>
        </div>
        <div className="form-group">
          <label>sqrtPriceX96</label>
          <input type="text" value={sqrtInput} onChange={e => setSqrtInput(e.target.value)} placeholder={(2n ** 96n).toString()} className="mono" />
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Decimals (token0)</label>
          <input type="number" value={dec0} onChange={e => setDec0(Number(e.target.value))} min={0} max={18} />
        </div>
        <div className="form-group">
          <label>Decimals (token1)</label>
          <input type="number" value={dec1} onChange={e => setDec1(Number(e.target.value))} min={0} max={18} />
        </div>
      </div>

      <div className="result-box">
        <div className="result-label">{lastDir === 'toSqrt' ? 'sqrtPriceX96' : 'Price'}</div>
        <code className="result-value">{lastDir === 'toSqrt' ? sqrtInput : priceInput}</code>
      </div>

      <div>
        <h3 style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--ink-muted)' }}>
          Reference: Common Price Points (18/18 decimals)
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="ref-table">
            <thead>
              <tr>
                <th>Ratio</th>
                <th style={{ textAlign: 'right' }}>Price</th>
                <th style={{ textAlign: 'right' }}>sqrtPriceX96</th>
                <th style={{ textAlign: 'right' }}>Tick</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: '1:1', price: 1 },
                { label: '1:2', price: 2 },
                { label: '1:10', price: 10 },
                { label: '1:100', price: 100 },
                { label: '2:1', price: 0.5 },
                { label: '10:1', price: 0.1 },
              ].map(r => {
                const sqrt = encodeSqrtRatioX96(BigInt(Math.round(r.price * 10 ** 18)), BigInt(10 ** 18))
                const s = sqrt.toString()
                const tick = Math.floor(Math.log(r.price) / Math.log(1.0001))
                return (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    <td style={{ textAlign: 'right' }}>{r.price}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--blue)', fontSize: '0.75rem' }}>
                      {s.length > 20 ? `${s.slice(0, 12)}...${s.slice(-8)}` : s}
                    </td>
                    <td style={{ textAlign: 'right' }}>{tick}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
