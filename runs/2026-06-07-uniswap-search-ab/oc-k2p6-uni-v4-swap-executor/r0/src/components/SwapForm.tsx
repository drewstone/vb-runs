import { useState, useCallback, useEffect } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useBalance,
} from 'wagmi'
import { injected } from 'wagmi/connectors'
import { sepolia } from 'wagmi/chains'
import {
  formatTokenAmount,
  parseTokenAmount,
} from '../utils/v4Swap'
import {
  DEFAULT_TOKENS,
  type Token,
  type SwapPath,
} from '../types'
import { useSwap } from '../hooks/useSwap'
import { usePermit2Approval } from '../hooks/usePermit2Approval'
import TokenSelector from './TokenSelector'
import PathConfig from './PathConfig'
import FlowVisualization from './FlowVisualization'

export default function SwapForm() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  const [tokenIn, setTokenIn] = useState<Token | null>(DEFAULT_TOKENS[0])
  const [tokenOut, setTokenOut] = useState<Token | null>(DEFAULT_TOKENS[1])
  const [amountIn, setAmountIn] = useState('')
  const [slippageTolerance, setSlippageTolerance] = useState(0.5)
  const [deadlineSeconds, setDeadlineSeconds] = useState(300)
  const [amountOutMinPercent, setAmountOutMinPercent] = useState(99.5)
  const [path, setPath] = useState<SwapPath>({ steps: [] })
  const [error, setError] = useState<string | null>(null)
  const [quotedOutput, setQuotedOutput] = useState<bigint | null>(null)
  const [showFlow, setShowFlow] = useState(true)

  const { data: tokenInBalance } = useBalance({
    address,
    token: tokenIn?.address === '0x0000000000000000000000000000000000000000' ? undefined : tokenIn?.address as `0x${string}`,
    chainId: sepolia.id,
  })

  const {
    executeSwap,
    result: swapResult,
    isPending,
    isConfirming,
    error: swapError,
  } = useSwap()

  const {
    approve: approvePermit2,
    hash: permitHash,
    isPending: isPermitPending,
  } = usePermit2Approval()

  // Calculate quote based on amount and path
  useEffect(() => {
    if (!amountIn || !tokenIn || path.steps.length === 0) {
      setQuotedOutput(null)
      return
    }

    try {
      const amount = parseTokenAmount(amountIn, tokenIn.decimals)
      const totalFee = path.steps.reduce((sum, step) => sum + step.poolKey.fee, 0)
      const feeMultiplier = BigInt(1000000 - totalFee) / BigInt(1000000)
      const quoted = (amount * feeMultiplier * BigInt(95)) / BigInt(100)
      setQuotedOutput(quoted)
    } catch {
      setQuotedOutput(null)
    }
  }, [amountIn, tokenIn, path])

  // Handle swap errors
  useEffect(() => {
    if (swapError) {
      setError(swapError.message)
    }
  }, [swapError])

  const handleApprove = useCallback(() => {
    if (!tokenIn || !address) return
    setError(null)

    const amount = parseTokenAmount(amountIn || '0', tokenIn.decimals)
    if (amount === 0n) {
      setError('Please enter an amount to approve')
      return
    }

    approvePermit2({
      token: tokenIn.address as `0x${string}`,
      spender: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
      amount,
    })
  }, [tokenIn, address, amountIn, approvePermit2])

  const handleSwap = useCallback(async () => {
    if (!tokenIn || !tokenOut || !amountIn || path.steps.length === 0) {
      setError('Please fill in all fields')
      return
    }

    if (!isConnected) {
      setError('Please connect your wallet')
      return
    }

    setError(null)

    const amountInWei = parseTokenAmount(amountIn, tokenIn.decimals)
    const amountOutMinimum = quotedOutput
      ? (quotedOutput * BigInt(Math.floor(amountOutMinPercent * 100))) / BigInt(10000)
      : 0n

    const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds)

    try {
      await executeSwap({
        tokenIn,
        tokenOut,
        amountIn: amountInWei,
        amountOutMinimum,
        path,
        deadline,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed')
    }
  }, [tokenIn, tokenOut, amountIn, path, isConnected, quotedOutput, amountOutMinPercent, deadlineSeconds, executeSwap])

  const switchTokens = useCallback(() => {
    const temp = tokenIn
    setTokenIn(tokenOut)
    setTokenOut(temp)
    setPath({ steps: [] })
  }, [tokenIn, tokenOut])

  const isSwapping = isPending || isConfirming

  const explorerUrl = (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-defi-text mb-2">Uniswap V4 Swap</h1>
        <p className="text-defi-textSecondary">Trade tokens using UniversalRouter with V4 pools</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Swap Form */}
        <div className="space-y-4">
          <div className="card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-defi-text">Swap</h2>
              {!isConnected ? (
                <button
                  type="button"
                  onClick={() => connect({ connector: injected() })}
                  className="btn-primary text-sm"
                >
                  Connect Wallet
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-defi-success"></div>
                  <span className="text-defi-textSecondary font-mono">
                    {address?.slice(0, 6)}...{address?.slice(-4)}
                  </span>
                  <button
                    type="button"
                    onClick={() => disconnect()}
                    className="text-xs text-defi-textMuted hover:text-defi-text ml-2"
                  >
                    Disconnect
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Token In */}
              <div className="p-4 rounded-xl bg-defi-bg border border-defi-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-defi-textSecondary">You Pay</span>
                  {tokenIn && tokenInBalance && (
                    <span className="text-xs text-defi-textMuted">
                      Balance: {formatTokenAmount(tokenInBalance.value, tokenIn.decimals)}
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="0.0"
                    value={amountIn}
                    onChange={e => {
                      const value = e.target.value.replace(/[^0-9.]/g, '')
                      setAmountIn(value)
                    }}
                    className="input-field flex-1 text-2xl font-semibold"
                  />
                  <div className="w-40">
                    <TokenSelector
                      selectedToken={tokenIn}
                      onSelect={setTokenIn}
                      label=""
                    />
                  </div>
                </div>
              </div>

              {/* Switch Button */}
              <div className="flex justify-center -my-2 relative z-10">
                <button
                  type="button"
                  onClick={switchTokens}
                  className="w-10 h-10 rounded-xl bg-defi-card border border-defi-border flex items-center justify-center hover:border-defi-accent transition-colors"
                >
                  <svg className="w-5 h-5 text-defi-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>

              {/* Token Out */}
              <div className="p-4 rounded-xl bg-defi-bg border border-defi-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-defi-textSecondary">You Receive</span>
                  {quotedOutput !== null && tokenOut && (
                    <span className="text-xs text-defi-textMuted">
                      ≈ {formatTokenAmount(quotedOutput, tokenOut.decimals)} {tokenOut.symbol}
                    </span>
                  )}
                </div>
                <div className="flex gap-3">
                  <input
                    type="text"
                    placeholder="0.0"
                    value={quotedOutput ? formatTokenAmount(quotedOutput, tokenOut?.decimals || 18) : ''}
                    readOnly
                    className="input-field flex-1 text-2xl font-semibold opacity-70"
                  />
                  <div className="w-40">
                    <TokenSelector
                      selectedToken={tokenOut}
                      onSelect={setTokenOut}
                      label=""
                    />
                  </div>
                </div>
              </div>

              {/* Slippage + Deadline + Min Out */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-defi-textSecondary">Slippage Tolerance</span>
                  <div className="flex gap-2">
                    {[0.1, 0.5, 1.0].map(tol => (
                      <button
                        key={tol}
                        type="button"
                        onClick={() => {
                          setSlippageTolerance(tol)
                          setAmountOutMinPercent(100 - tol)
                        }}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          slippageTolerance === tol
                            ? 'bg-defi-accent text-white'
                            : 'bg-defi-bg border border-defi-border text-defi-textSecondary hover:text-defi-text'
                        }`}
                      >
                        {tol}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-defi-textSecondary">Deadline (seconds)</span>
                  <input
                    type="number"
                    value={deadlineSeconds}
                    onChange={e => setDeadlineSeconds(Number(e.target.value))}
                    min={30}
                    max={3600}
                    className="input-field w-24 text-right"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-defi-textSecondary">Min Out (% of quoted)</span>
                  <input
                    type="number"
                    value={amountOutMinPercent}
                    onChange={e => {
                      const val = Number(e.target.value)
                      setAmountOutMinPercent(val)
                      setSlippageTolerance(Number((100 - val).toFixed(2)))
                    }}
                    min={90}
                    max={100}
                    step={0.1}
                    className="input-field w-24 text-right"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2">
                {tokenIn && tokenIn.address !== '0x0000000000000000000000000000000000000000' && (
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isPermitPending || !amountIn}
                    className="btn-primary w-full text-base py-3 bg-defi-border hover:bg-defi-border/80"
                  >
                    {isPermitPending ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Approving...
                      </div>
                    ) : (
                      `Approve ${tokenIn.symbol} for Permit2`
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSwap}
                  disabled={isSwapping || !tokenIn || !tokenOut || !amountIn || path.steps.length === 0}
                  className="btn-primary w-full text-lg py-4"
                >
                  {isSwapping ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      {isConfirming ? 'Confirming...' : 'Swapping...'}
                    </div>
                  ) : !isConnected ? (
                    'Connect Wallet to Swap'
                  ) : (
                    'Swap'
                  )}
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-defi-danger/10 border border-defi-danger/30 text-defi-danger text-sm">
                  {error}
                </div>
              )}

              {permitHash && (
                <div className="p-3 rounded-lg bg-defi-success/10 border border-defi-success/30 text-defi-success text-sm">
                  Permit2 approval submitted: {' '}
                  <a
                    href={explorerUrl(permitHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    {permitHash.slice(0, 20)}...
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Path Configuration */}
          <div className="card p-6">
            <PathConfig
              tokenIn={tokenIn}
              tokenOut={tokenOut}
              path={path}
              onPathChange={setPath}
            />
          </div>
        </div>

        {/* Right Column - Flow & Results */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-defi-text">Execution Flow</h2>
            <button
              type="button"
              onClick={() => setShowFlow(!showFlow)}
              className="text-sm text-defi-accent hover:text-defi-accentHover"
            >
              {showFlow ? 'Hide' : 'Show'}
            </button>
          </div>

          {showFlow && (
            <FlowVisualization
              tokenIn={tokenIn}
              tokenOut={tokenOut}
              amountIn={amountIn}
              path={path}
            />
          )}

          {/* Swap Result */}
          {swapResult && (
            <div className="card p-6 border-defi-success/30">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-defi-success/20 flex items-center justify-center">
                  <svg className="w-5 h-5 text-defi-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-defi-text">Swap Successful</div>
                  <a
                    href={explorerUrl(swapResult.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-defi-accent font-mono hover:underline"
                  >
                    {swapResult.txHash.slice(0, 20)}...{swapResult.txHash.slice(-8)}
                  </a>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-defi-textSecondary">Status</span>
                  <span className="text-sm text-defi-success font-medium">
                    {swapResult.receipt.status === 'success' ? 'Confirmed' : 'Failed'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-defi-textSecondary">Block Number</span>
                  <span className="font-mono text-sm text-defi-text">{swapResult.receipt.blockNumber.toString()}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-defi-textSecondary">Gas Used</span>
                  <span className="font-mono text-sm text-defi-text">{swapResult.gasUsed.toString()}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-t border-defi-border">
                  <span className="text-sm text-defi-textSecondary">BalanceDelta</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-defi-bg">
                    <div className="text-xs text-defi-textMuted mb-1">Amount0</div>
                    <div className="font-mono text-sm text-defi-text">
                      {swapResult.balanceDelta.amount0 < 0n ? '-' : '+'}
                      {formatTokenAmount(
                        swapResult.balanceDelta.amount0 < 0n ? -swapResult.balanceDelta.amount0 : swapResult.balanceDelta.amount0,
                        tokenIn?.decimals || 18
                      )}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-defi-bg">
                    <div className="text-xs text-defi-textMuted mb-1">Amount1</div>
                    <div className="font-mono text-sm text-defi-text">
                      {swapResult.balanceDelta.amount1 < 0n ? '-' : '+'}
                      {formatTokenAmount(
                        swapResult.balanceDelta.amount1 < 0n ? -swapResult.balanceDelta.amount1 : swapResult.balanceDelta.amount1,
                        tokenOut?.decimals || 18
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2 border-t border-defi-border">
                  <span className="text-sm text-defi-textSecondary">Amount Out</span>
                  <span className="font-mono text-defi-text">
                    {formatTokenAmount(swapResult.amountOut, tokenOut?.decimals || 18)} {tokenOut?.symbol}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-t border-defi-border">
                  <span className="text-sm text-defi-textSecondary">Quoted Output</span>
                  <span className="font-mono text-defi-text">
                    {quotedOutput ? formatTokenAmount(quotedOutput, tokenOut?.decimals || 18) : '--'} {tokenOut?.symbol}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-t border-defi-border">
                  <span className="text-sm text-defi-textSecondary">Realized Slippage</span>
                  <span className={`font-mono font-medium ${
                    swapResult.realizedSlippage > slippageTolerance
                      ? 'text-defi-danger'
                      : swapResult.realizedSlippage > slippageTolerance * 0.5
                      ? 'text-defi-warning'
                      : 'text-defi-success'
                  }`}>
                    {swapResult.realizedSlippage.toFixed(2)}%
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-t border-defi-border">
                  <span className="text-sm text-defi-textSecondary">Minimum Received</span>
                  <span className="font-mono text-defi-textMuted">
                    {quotedOutput
                      ? formatTokenAmount(
                          (quotedOutput * BigInt(Math.floor(amountOutMinPercent * 100))) / BigInt(10000),
                          tokenOut?.decimals || 18
                        )
                      : '0'} {tokenOut?.symbol}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
