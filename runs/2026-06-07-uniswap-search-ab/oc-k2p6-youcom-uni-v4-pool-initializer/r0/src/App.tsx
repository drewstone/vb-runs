import { useState, useCallback, useMemo, useEffect } from 'react'
import { parseAbi, decodeEventLog, type Log } from 'viem'
import {
  useAccount,
  useConnect,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { injected } from 'wagmi/connectors'
import { PoolKey } from '@uniswap/v4-sdk'

// ─── Local encodeSqrtRatioX96 implementation (avoids @uniswap/v3-sdk import) ──

function encodeSqrtRatioX96(amount1: number, amount0: number): bigint {
  const ratio = amount1 / amount0
  const sqrt = Math.sqrt(ratio)
  const q96 = 2 ** 96
  return BigInt(Math.floor(sqrt * q96))
}

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_POOL_MANAGER = '0x0000000000000000000000000000000000000000'

const TOKENS = [
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86a33E6441e6C7D3D4B4f6c7B6c7D3D4B4f6', decimals: 6 },
  { symbol: 'USDT', name: 'Tether USD', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  { symbol: 'WBTC', name: 'Wrapped BTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  { symbol: 'LINK', name: 'Chainlink', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
  { symbol: 'Custom', name: 'Custom Token', address: '', decimals: 18 },
] as const

const FEE_TIERS = [
  { fee: 100, label: '0.01%', tickSpacing: 1 },
  { fee: 500, label: '0.05%', tickSpacing: 10 },
  { fee: 3000, label: '0.30%', tickSpacing: 60 },
  { fee: 10000, label: '1.00%', tickSpacing: 200 },
] as const

const POOL_MANAGER_ABI = parseAbi([
  'function initialize(tuple(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, uint160 sqrtPriceX96) external returns (bytes32 id)',
  'event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96)',
])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSqrtPriceX96(price: number, dec0: number, dec1: number): bigint {
  const adjusted = price * 10 ** (dec0 - dec1)
  return BigInt(encodeSqrtRatioX96(Math.floor(adjusted * 1e18), 1e18).toString())
}

function fromSqrtPriceX96(sqrtPriceX96: bigint, dec0: number, dec1: number): number {
  const val = Number(sqrtPriceX96) / 2 ** 96
  const rawPrice = val * val
  return rawPrice * 10 ** (dec1 - dec0)
}

function isAddressSorted(a: string, b: string): boolean {
  return a.toLowerCase() < b.toLowerCase()
}

function sortPoolKey(key: PoolKey): PoolKey {
  if (isAddressSorted(key.currency0, key.currency1)) return key
  return {
    currency0: key.currency1,
    currency1: key.currency0,
    fee: key.fee,
    tickSpacing: key.tickSpacing,
    hooks: key.hooks,
  }
}

function parseInitializePoolId(logs: Log[]): string | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: POOL_MANAGER_ABI,
        eventName: 'Initialize',
        data: log.data,
        topics: log.topics,
      })
      if (decoded.args && 'id' in decoded.args) {
        return decoded.args.id as string
      }
    } catch {
      // Not an Initialize event
    }
  }
  return null
}

// ─── Components ──────────────────────────────────────────────────────────────

function App() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()

  const [activeTab, setActiveTab] = useState<'create' | 'calculator'>('create')

  // Form state
  const [currency0Symbol, setCurrency0Symbol] = useState('WETH')
  const [currency1Symbol, setCurrency1Symbol] = useState('USDC')
  const [currency0Custom, setCurrency0Custom] = useState('')
  const [currency1Custom, setCurrency1Custom] = useState('')
  const [selectedFee, setSelectedFee] = useState(3000)
  const [tickSpacing, setTickSpacing] = useState(60)
  const [hooksAddress, setHooksAddress] = useState('0x0000000000000000000000000000000000000000')
  const [poolManagerAddress, setPoolManagerAddress] = useState(DEFAULT_POOL_MANAGER)
  const [sqrtPriceX96, setSqrtPriceX96] = useState('')
  const [resultPoolId, setResultPoolId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Calculator state
  const [calcSqrtPriceX96, setCalcSqrtPriceX96] = useState('')
  const [calcPrice, setCalcPrice] = useState('')
  const [calcDecimals0, setCalcDecimals0] = useState('18')
  const [calcDecimals1, setCalcDecimals1] = useState('6')

  const currency0Address = useMemo(() => {
    const token = TOKENS.find(t => t.symbol === currency0Symbol)
    return currency0Symbol === 'Custom' ? currency0Custom : token?.address || ''
  }, [currency0Symbol, currency0Custom])

  const currency1Address = useMemo(() => {
    const token = TOKENS.find(t => t.symbol === currency1Symbol)
    return currency1Symbol === 'Custom' ? currency1Custom : token?.address || ''
  }, [currency1Symbol, currency1Custom])

  const poolKey = useMemo<PoolKey | null>(() => {
    if (!currency0Address || !currency1Address) return null
    if (!/^0x[a-fA-F0-9]{40}$/.test(currency0Address) || !/^0x[a-fA-F0-9]{40}$/.test(currency1Address)) {
      return null
    }
    const key: PoolKey = {
      currency0: currency0Address,
      currency1: currency1Address,
      fee: selectedFee,
      tickSpacing,
      hooks: hooksAddress || '0x0000000000000000000000000000000000000000',
    }
    return sortPoolKey(key)
  }, [currency0Address, currency1Address, selectedFee, tickSpacing, hooksAddress])

  // Wagmi writeContract for initialize
  const {
    data: hash,
    error: writeError,
    isPending: isInitializing,
    writeContract,
  } = useWriteContract()

  const { data: receipt, isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (writeError) {
      setError(writeError.message)
    }
  }, [writeError])

  useEffect(() => {
    if (isConfirmed && receipt && receipt.logs) {
      const poolId = parseInitializePoolId(receipt.logs)
      if (poolId) {
        setResultPoolId(poolId)
      } else {
        setError('Transaction confirmed but PoolId not found in logs')
      }
    }
  }, [isConfirmed, receipt])

  const initializePool = useCallback(() => {
    if (!poolKey || !sqrtPriceX96 || !poolManagerAddress) return
    setError(null)
    setResultPoolId(null)

    try {
      const sqrtPrice = BigInt(sqrtPriceX96)
      writeContract({
        address: poolManagerAddress as `0x${string}`,
        abi: POOL_MANAGER_ABI,
        functionName: 'initialize',
        args: [poolKey, sqrtPrice],
      })
    } catch {
      setError('Invalid sqrtPriceX96 value')
    }
  }, [poolKey, sqrtPriceX96, poolManagerAddress, writeContract])

  const handleFeeSelect = (fee: number, spacing: number) => {
    setSelectedFee(fee)
    setTickSpacing(spacing)
  }

  // Price calculator handlers
  const handleSqrtToPrice = useCallback(() => {
    try {
      const sqrtVal = BigInt(calcSqrtPriceX96)
      const decimals0 = parseInt(calcDecimals0) || 18
      const decimals1 = parseInt(calcDecimals1) || 18
      const price = fromSqrtPriceX96(sqrtVal, decimals0, decimals1)
      setCalcPrice(price.toString())
    } catch {
      setCalcPrice('Invalid sqrtPriceX96')
    }
  }, [calcSqrtPriceX96, calcDecimals0, calcDecimals1])

  const handlePriceToSqrt = useCallback(() => {
    try {
      const price = parseFloat(calcPrice)
      const decimals0 = parseInt(calcDecimals0) || 18
      const decimals1 = parseInt(calcDecimals1) || 18
      const sqrt = toSqrtPriceX96(price, decimals0, decimals1)
      setCalcSqrtPriceX96(sqrt.toString())
    } catch {
      setCalcSqrtPriceX96('Invalid price')
    }
  }, [calcPrice, calcDecimals0, calcDecimals1])

  const sortedValidation = useMemo(() => {
    if (!currency0Address || !currency1Address) return null
    if (!isAddressSorted(currency0Address, currency1Address)) {
      return 'Warning: currency0 must be the lexicographically smaller address. The form will automatically sort them before submission.'
    }
    return null
  }, [currency0Address, currency1Address])

  return (
    <div className="container">
      <header className="header">
        <div className="header-left">
          <div className="logo">V4</div>
          <div>
            <div className="header-title">Pool Initializer</div>
            <div className="header-subtitle">Uniswap V4 — Create and initialize new pools</div>
          </div>
        </div>
        {isConnected && address ? (
          <div className="badge badge-success">
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
        ) : (
          <button className="btn btn-primary" onClick={() => connect({ connector: injected() })}>
            Connect Wallet
          </button>
        )}
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => setActiveTab('create')}
        >
          Create Pool
        </button>
        <button
          className={`tab ${activeTab === 'calculator' ? 'active' : ''}`}
          onClick={() => setActiveTab('calculator')}
        >
          Price Calculator
        </button>
      </div>

      {activeTab === 'create' && (
        <>
          <div className="card">
            <div className="card-header">
              <div className="card-title">Pool Configuration</div>
              <div className="card-desc">Define the tokens, fee tier, and initial price for your new pool</div>
            </div>

            <div className="row">
              <div className="form-group">
                <label className="form-label">Currency 0</label>
                <div className="token-selector">
                  <select value={currency0Symbol} onChange={e => setCurrency0Symbol(e.target.value)}>
                    {TOKENS.map(t => (
                      <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                    ))}
                  </select>
                </div>
                {currency0Symbol === 'Custom' && (
                  <input
                    type="text"
                    placeholder="0x..."
                    value={currency0Custom}
                    onChange={e => setCurrency0Custom(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Currency 1</label>
                <div className="token-selector">
                  <select value={currency1Symbol} onChange={e => setCurrency1Symbol(e.target.value)}>
                    {TOKENS.map(t => (
                      <option key={t.symbol} value={t.symbol}>{t.symbol}</option>
                    ))}
                  </select>
                </div>
                {currency1Symbol === 'Custom' && (
                  <input
                    type="text"
                    placeholder="0x..."
                    value={currency1Custom}
                    onChange={e => setCurrency1Custom(e.target.value)}
                    style={{ marginTop: 8 }}
                  />
                )}
              </div>
            </div>

            {sortedValidation && (
              <div className="error-text" style={{ marginBottom: 12 }}>{sortedValidation}</div>
            )}

            <div className="form-group">
              <label className="form-label">Fee Tier</label>
              <div className="fee-options">
                {FEE_TIERS.map(tier => (
                  <div
                    key={tier.fee}
                    className={`fee-option ${selectedFee === tier.fee ? 'active' : ''}`}
                    onClick={() => handleFeeSelect(tier.fee, tier.tickSpacing)}
                  >
                    <span className="fee-value">{tier.label}</span>
                    <span className="fee-label">tickSpacing: {tier.tickSpacing}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="row">
              <div className="form-group">
                <label className="form-label">Tick Spacing</label>
                <input
                  type="number"
                  value={tickSpacing}
                  onChange={e => setTickSpacing(parseInt(e.target.value) || 0)}
                />
                <div className="hint">Auto-set from fee tier, but can be overridden for custom pools</div>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Hooks Address <span className="optional">(optional)</span>
                </label>
                <input
                  type="text"
                  value={hooksAddress}
                  onChange={e => setHooksAddress(e.target.value)}
                  placeholder="0x0000000000000000000000000000000000000000"
                />
                <div className="hint">Use zero address for no hooks</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">PoolManager Contract Address</label>
              <input
                type="text"
                value={poolManagerAddress}
                onChange={e => setPoolManagerAddress(e.target.value)}
                placeholder="0x0000000000000000000000000000000000000000"
              />
              <div className="hint">Default is Sepolia PoolManager (0x0000...0000). Change for other networks.</div>
            </div>

            <div className="form-group">
              <label className="form-label">Initial sqrtPriceX96</label>
              <input
                type="text"
                value={sqrtPriceX96}
                onChange={e => setSqrtPriceX96(e.target.value)}
                placeholder="79228162514264337593543950336"
              />
              <div className="hint">The initial price as a Q64.96 fixed-point number. Use the calculator tab to convert from human-readable price.</div>
            </div>

            {error && <div className="error-text">{error}</div>}

            {!isConnected ? (
              <div className="connect-prompt">
                <h3>Connect your wallet</h3>
                <p>You need to connect a wallet to initialize a pool on-chain.</p>
                <button className="btn btn-primary btn-lg" onClick={() => connect({ connector: injected() })}>
                  Connect Wallet
                </button>
              </div>
            ) : (
              <button
                className="btn btn-primary btn-lg"
                style={{ width: '100%', marginTop: 8 }}
                onClick={initializePool}
                disabled={isInitializing || isConfirming || !sqrtPriceX96 || !poolKey || !poolManagerAddress}
              >
                {isInitializing ? 'Confirm in wallet...' : isConfirming ? 'Confirming...' : 'Initialize Pool'}
              </button>
            )}
          </div>

          {(resultPoolId || hash) && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Pool Details</div>
              </div>

              {hash && (
                <div className="result-box">
                  <div className="result-label">Transaction Hash</div>
                  <div className="result-value">{hash}</div>
                </div>
              )}

              {resultPoolId && (
                <div className="result-box" style={{ marginTop: 12, borderColor: 'var(--success)' }}>
                  <div className="result-label">Pool ID (from Initialize event)</div>
                  <div className="result-value hash">{resultPoolId}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'calculator' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Price Calculator</div>
            <div className="card-desc">Convert between sqrtPriceX96 and human-readable prices</div>
          </div>

          <div className="row">
            <div className="form-group">
              <label className="form-label">Token 0 Decimals</label>
              <input
                type="number"
                value={calcDecimals0}
                onChange={e => setCalcDecimals0(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Token 1 Decimals</label>
              <input
                type="number"
                value={calcDecimals1}
                onChange={e => setCalcDecimals1(e.target.value)}
              />
            </div>
          </div>

          <div className="calculator-grid">
            <div className="calc-card">
              <h4>sqrtPriceX96 → Price</h4>
              <input
                type="text"
                value={calcSqrtPriceX96}
                onChange={e => setCalcSqrtPriceX96(e.target.value)}
                placeholder="79228162514264337593543950336"
              />
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 12 }}
                onClick={handleSqrtToPrice}
              >
                Convert to Price
              </button>
              {calcPrice && !calcPrice.includes('Invalid') && (
                <div className="result-box" style={{ marginTop: 12 }}>
                  <div className="result-label">Price (token1 / token0)</div>
                  <div className="result-value">{calcPrice}</div>
                </div>
              )}
            </div>

            <div className="calc-card">
              <h4>Price → sqrtPriceX96</h4>
              <input
                type="text"
                value={calcPrice}
                onChange={e => setCalcPrice(e.target.value)}
                placeholder="2000"
              />
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 12 }}
                onClick={handlePriceToSqrt}
              >
                Convert to sqrtPriceX96
              </button>
              {calcSqrtPriceX96 && !calcSqrtPriceX96.includes('Invalid') && (
                <div className="result-box" style={{ marginTop: 12 }}>
                  <div className="result-label">sqrtPriceX96</div>
                  <div className="result-value">{calcSqrtPriceX96}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
