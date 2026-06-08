import { useState, useMemo } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, useAccount, useChainId, useConnect } from 'wagmi'
import { type Address, keccak256, encodeAbiParameters } from 'viem'
import { Token } from '@uniswap/sdk-core'
import { Pool } from '@uniswap/v4-sdk'

type PoolKey = {
  currency0: string
  currency1: string
  fee: number
  tickSpacing: number
  hooks: string
}

type PoolId = `0x${string}`

function makePoolKey(tokenA: Token, tokenB: Token, fee: number, tickSpacing: number, hooks: string): PoolKey {
  return Pool.getPoolKey(tokenA, tokenB, fee, tickSpacing, hooks as Address)
}

function makePoolId(key: PoolKey): PoolId {
  const encoded = encodeAbiParameters(
    [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' },
    ],
    [key.currency0 as Address, key.currency1 as Address, key.fee, key.tickSpacing, key.hooks as Address],
  )
  return keccak256(encoded)
}

function isValidAddress(addr: string): addr is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(addr)
}

function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('negative')
  if (n < 2n) return n
  let x = n
  let y = (x + 1n) / 2n
  while (y < x) {
    x = y
    y = (x + n / x) / 2n
  }
  return x
}

function encodeSqrtRatioX96(amount1: bigint, amount0: bigint): bigint {
  const ratio = (amount1 << 128n) / amount0
  return (isqrt(ratio) << 32n)
}

function encodePriceToSqrtX96(price: string, decimals0: number, decimals1: number): bigint | null {
  try {
    const parts = price.split('.')
    const intPart = parts[0] || '0'
    const decPart = (parts[1] || '').slice(0, 18).padEnd(18, '0')
    const amount1 = BigInt(intPart + decPart)
    const amount0 = 10n ** 18n
    const exp = BigInt(decimals1) - BigInt(decimals0)
    const adjusted = exp >= 0n ? amount1 * 10n ** exp : amount1 / 10n ** (-exp)
    return encodeSqrtRatioX96(adjusted, amount0)
  } catch {
    return null
  }
}

function decodeSqrtRatioX96(sqrtPriceX96: bigint, decimals0: number, decimals1: number): string {
  const Q96 = 2n ** 96n
  const PRECISION = 10n ** 18n
  const diff = BigInt(decimals0) - BigInt(decimals1)
  let scaled: bigint
  if (diff >= 0n) {
    scaled = (sqrtPriceX96 * sqrtPriceX96 * PRECISION * 10n ** diff) / (Q96 * Q96)
  } else {
    scaled = (sqrtPriceX96 * sqrtPriceX96 * PRECISION) / (Q96 * Q96 * 10n ** (-diff))
  }
  const whole = scaled / PRECISION
  const frac = scaled % PRECISION
  const fracStr = frac.toString().padStart(18, '0').slice(0, 8)
  return `${whole}.${fracStr}`
}

const POOL_MANAGER = '0x0000002991F8adC61247e01583BfCA6719305674' as const

const INIT_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
        name: 'key',
        type: 'tuple',
      },
      { name: 'sqrtPriceX96', type: 'uint160' },
    ],
    name: 'initialize',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

const FEE_OPTIONS = [
  { value: 500, label: '500 (0.05%)' },
  { value: 3000, label: '3000 (0.30%)' },
  { value: 10000, label: '10000 (1.00%)' },
]

export default function App() {
  const chainId = useChainId()
  const { isConnected } = useAccount()
  const { connect, connectors } = useConnect()
  const { writeContract, data: txHash, isPending: isWriting, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash })

  const [currency0, setCurrency0] = useState('')
  const [decimals0, setDecimals0] = useState(18)
  const [currency1, setCurrency1] = useState('')
  const [decimals1, setDecimals1] = useState(6)
  const [fee, setFee] = useState(500)
  const [tickSpacing, setTickSpacing] = useState(10)
  const [hooks, setHooks] = useState('0x0000000000000000000000000000000000000000')
  const [sqrtPriceX96, setSqrtPriceX96] = useState('')
  const [calcPrice, setCalcPrice] = useState('')
  const [error, setError] = useState('')

  const token0 = useMemo(() => {
    if (!isValidAddress(currency0)) return null
    try { return new Token(chainId, currency0, decimals0) } catch { return null }
  }, [chainId, currency0, decimals0])

  const token1 = useMemo(() => {
    if (!isValidAddress(currency1)) return null
    try { return new Token(chainId, currency1, decimals1) } catch { return null }
  }, [chainId, currency1, decimals1])

  const poolKey: PoolKey | null = useMemo(() => {
    if (!token0 || !token1) return null
    try { return makePoolKey(token0, token1, fee, tickSpacing, hooks) } catch { return null }
  }, [token0, token1, fee, tickSpacing, hooks])

  const poolId: PoolId | null = useMemo(() => {
    if (!poolKey) return null
    return makePoolId(poolKey)
  }, [poolKey])

  const sorted: boolean | null = useMemo(() => {
    if (!isValidAddress(currency0) || !isValidAddress(currency1)) return null
    return currency0.toLowerCase() < currency1.toLowerCase()
  }, [currency0, currency1])

  const sqrtPriceBigint = useMemo<bigint | null>(() => {
    if (!sqrtPriceX96) return null
    try { return BigInt(sqrtPriceX96) } catch { return null }
  }, [sqrtPriceX96])

  const humanPrice = useMemo(() => {
    if (!sqrtPriceBigint || !poolKey) return null
    const d0 = poolKey.currency0.toLowerCase() === currency0.toLowerCase() ? decimals0 : decimals1
    const d1 = poolKey.currency1.toLowerCase() === currency0.toLowerCase() ? decimals0 : decimals1
    return decodeSqrtRatioX96(sqrtPriceBigint, d0, d1)
  }, [sqrtPriceBigint, poolKey, currency0, decimals0, decimals1])

  const validate = (): string | null => {
    if (!isValidAddress(currency0)) return 'currency0 must be a valid 0x address'
    if (!isValidAddress(currency1)) return 'currency1 must be a valid 0x address'
    if (currency0.toLowerCase() === currency1.toLowerCase()) return 'currency0 and currency1 must differ'
    if (currency0.toLowerCase() > currency1.toLowerCase()) return 'currency0 must sort before currency1 — swap the addresses'
    if (!token0 || !token1) return 'Could not construct Token objects — check addresses and decimals'
    if (!poolKey) return 'Could not construct PoolKey'
    if (!sqrtPriceBigint) return 'sqrtPriceX96 must be a valid integer'
    if (!isValidAddress(hooks)) return 'hooks must be a valid 0x address'
    if (!Number.isInteger(fee) || fee < 0 || fee > 1000000) return 'Invalid fee'
    if (!Number.isInteger(tickSpacing) || tickSpacing < -32768 || tickSpacing > 32767) return 'Invalid tickSpacing'
    return null
  }

  const handleInitialize = () => {
    const err = validate()
    if (err) { setError(err); return }
    if (!poolKey || !sqrtPriceBigint) return
    setError('')
    writeContract({
      address: POOL_MANAGER,
      abi: INIT_ABI,
      functionName: 'initialize',
      args: [
        {
          currency0: poolKey.currency0 as Address,
          currency1: poolKey.currency1 as Address,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks as Address,
        },
        sqrtPriceBigint,
      ],
    })
  }

  const handlePriceToSqrt = () => {
    if (!calcPrice) return
    const result = encodePriceToSqrtX96(calcPrice, decimals0, decimals1)
    if (result) setSqrtPriceX96(result.toString())
  }

  const handleSqrtToPrice = () => {
    if (!sqrtPriceBigint || !poolKey) return
    const d0 = poolKey.currency0.toLowerCase() === currency0.toLowerCase() ? decimals0 : decimals1
    const d1 = poolKey.currency1.toLowerCase() === currency0.toLowerCase() ? decimals0 : decimals1
    setCalcPrice(decodeSqrtRatioX96(sqrtPriceBigint, d0, d1))
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">V4</div>
            <div>
              <h1>Pool Initializer</h1>
              <span className="logo-sub">Uniswap V4 · PoolManager.initialize</span>
            </div>
          </div>
          <div className="header-right">
            <span className="chain-badge">{isConnected ? `Chain ${chainId}` : 'Not connected'}</span>
            {!isConnected && (
              <button className="btn-connect" onClick={() => connect({ connector: connectors[0] })}>Connect Wallet</button>
            )}
          </div>
        </div>
      </header>

      <main className="main-grid">
        <div className="form-col">
          <div className="card">
            <h2>Initialize V4 Pool</h2>
            <p className="desc">Construct a PoolKey and call PoolManager.initialize with an initial sqrtPriceX96.</p>

            {error && <div className="error-banner">{error}</div>}
            {writeError && <div className="error-banner">{writeError.message}</div>}

            <div className="section">
              <h3>Token Pair</h3>
              <div className="field">
                <label htmlFor="c0">currency0</label>
                <input id="c0" type="text" value={currency0} onChange={e => setCurrency0(e.target.value)} placeholder="0x..." spellCheck={false} />
                <div className="inline">
                  <label>Decimals</label>
                  <input type="number" value={decimals0} onChange={e => setDecimals0(Number(e.target.value))} min={0} max={18} />
                </div>
              </div>
              <div className="field">
                <label htmlFor="c1">currency1</label>
                <input id="c1" type="text" value={currency1} onChange={e => setCurrency1(e.target.value)} placeholder="0x..." spellCheck={false} />
                <div className="inline">
                  <label>Decimals</label>
                  <input type="number" value={decimals1} onChange={e => setDecimals1(Number(e.target.value))} min={0} max={18} />
                </div>
              </div>
              {sorted === false && <div className="sort-warn">currency0 must sort below currency1 — swap the addresses</div>}
              {sorted === true && <div className="sort-ok">currency0 &lt; currency1 ✓</div>}
            </div>

            <div className="section">
              <h3>Pool Parameters</h3>
              <div className="field">
                <label htmlFor="fee">Fee Tier</label>
                <select id="fee" value={fee} onChange={e => setFee(Number(e.target.value))}>
                  {FEE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="ts">Tick Spacing</label>
                <input id="ts" type="number" value={tickSpacing} onChange={e => setTickSpacing(Number(e.target.value))} min={-32768} max={32767} />
              </div>
              <div className="field">
                <label htmlFor="hooks">Hooks Address</label>
                <input id="hooks" type="text" value={hooks} onChange={e => setHooks(e.target.value)} spellCheck={false} />
              </div>
            </div>

            <div className="section">
              <h3>Initial Price</h3>
              <div className="field">
                <label htmlFor="sqrt">sqrtPriceX96</label>
                <input id="sqrt" type="text" value={sqrtPriceX96} onChange={e => setSqrtPriceX96(e.target.value)} placeholder="79228162514264337593543950336" spellCheck={false} />
                {humanPrice && <span className="hint">≈ {humanPrice} token1/token0</span>}
              </div>
            </div>

            <div className="actions">
              <button className="btn-primary" onClick={handleInitialize} disabled={isWriting || isConfirming || !isConnected || !sqrtPriceBigint}>
                {!isConnected ? 'Connect Wallet to Initialize' : isWriting ? 'Confirm in Wallet…' : isConfirming ? 'Confirming…' : 'Initialize Pool'}
              </button>
            </div>

            {poolKey && (
              <div className="preview">
                <h4>PoolKey (computed)</h4>
                <pre>{JSON.stringify(poolKey, null, 2)}</pre>
                {poolId && <div className="pool-id-label">PoolId: <code>{poolId}</code></div>}
              </div>
            )}

            {txHash && (
              <div className="tx-result">
                <div className="tx-hash">
                  <span>Tx Hash</span>
                  <code>{txHash}</code>
                </div>
                {isConfirmed && poolId && (
                  <div className="success">
                    <span className="success-label">Pool Initialized</span>
                    <code className="pool-id-result">{poolId}</code>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <aside className="sidebar">
          <div className="card">
            <h3>Price Calculator</h3>
            <p className="desc">Convert sqrtPriceX96 ↔ human-readable price using encodeSqrtRatioX96 and decodeSqrtRatioX96.</p>
            <div className="field">
              <label>Human Price (token1 per token0)</label>
              <input type="text" value={calcPrice} onChange={e => setCalcPrice(e.target.value)} placeholder="2000.00" />
            </div>
            <div className="field">
              <label>sqrtPriceX96</label>
              <input type="text" value={sqrtPriceX96} onChange={e => setSqrtPriceX96(e.target.value)} placeholder="79228162514264337593543950336" />
            </div>
            <div className="calc-row">
              <div className="inline">
                <label>Dec0</label>
                <input type="number" value={decimals0} onChange={e => setDecimals0(Number(e.target.value))} min={0} max={18} />
              </div>
              <div className="inline">
                <label>Dec1</label>
                <input type="number" value={decimals1} onChange={e => setDecimals1(Number(e.target.value))} min={0} max={18} />
              </div>
            </div>
            <div className="calc-btns">
              <button className="btn-outline" onClick={handlePriceToSqrt}>Price → sqrt</button>
              <button className="btn-outline" onClick={handleSqrtToPrice}>sqrt → Price</button>
            </div>
            {humanPrice && <div className="calc-result">Price: {humanPrice}</div>}
          </div>

          <div className="card">
            <h3>Reference</h3>
            <div className="ref">
              <div className="ref-row"><span>PoolKey</span><span>(currency0, currency1, fee, tickSpacing, hooks)</span></div>
              <div className="ref-row"><span>PoolId</span><span>keccak256(abi.encode(PoolKey))</span></div>
              <div className="ref-row"><span>sqrtPriceX96</span><span>sqrt(price) × 2⁹⁶</span></div>
              <div className="ref-row"><span>price</span><span>(sqrtPriceX96 / 2⁹⁶)²</span></div>
              <div className="ref-row"><span>PoolManager</span><code className="mono-sm">{POOL_MANAGER}</code></div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
