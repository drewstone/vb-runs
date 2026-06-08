import { useState, useCallback, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { decodeEventLog } from 'viem'
import type { TokenInfo, FlowStep, SwapResult, DecodedDelta } from '../types'
import { UNIVERSAL_ROUTER_ADDRESS, PERMIT2_ADDRESS } from '../types'
import {
  buildSwapPlan,
  decodeBalanceDelta,
  formatTokenAmount,
  parseUnits,
  UNIVERSAL_ROUTER_ABI,
  ERC20_ABI,
  POOL_MANAGER_ABI,
} from '../universalRouter'

export const USDC: TokenInfo = {
  symbol: 'USDC', name: 'USD Coin',
  address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  decimals: 6, color: '#2775CA',
}

export const WETH: TokenInfo = {
  symbol: 'WETH', name: 'Wrapped Ether',
  address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  decimals: 18, color: '#ec4899',
}

export const DAI: TokenInfo = {
  symbol: 'DAI', name: 'Dai Stablecoin',
  address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
  decimals: 18, color: '#f5ac37',
}

const TOKENS = [WETH, USDC, DAI]
const MAX_UINT256 = (1n << 256n) - 1n

function buildSteps(tokenIn: TokenInfo): FlowStep[] {
  return [
    { id: 'approve', label: `Approve ${tokenIn.symbol} for Permit2`, description: 'ERC20 approve → Permit2 contract to pull input tokens', status: 'pending' },
    { id: 'plan-swap', label: 'Build V4 Swap Plan', description: 'V4Planner: SETTLE → SWAP_EXACT_IN_SINGLE → TAKE', status: 'pending' },
    { id: 'encode-ur', label: 'Encode V4_SWAP Command', description: 'RoutePlanner.addCommand(CommandType.V4_SWAP, ...)', status: 'pending' },
    { id: 'send-swap', label: 'Send tx: UniversalRouter.execute()', description: 'Submit commands, inputs, deadline via useWriteContract', status: 'pending' },
    { id: 'confirm', label: 'Wait for Confirmation', description: 'Monitor tx with useWaitForTransactionReceipt', status: 'pending' },
    { id: 'decode', label: 'Decode BalanceDelta from Logs', description: 'Parse Swap event via decodeEventLog from viem', status: 'pending' },
    { id: 'slippage', label: 'Compute Realized Slippage', description: '(quotedAmountOut - realizedAmountOut) / quotedAmountOut × 100', status: 'pending' },
  ]
}

export function useSwap() {
  const { address, isConnected } = useAccount()
  const { connect } = useConnect()
  const { disconnect } = useDisconnect()

  const [tokenIn, setTokenIn] = useState<TokenInfo>(WETH)
  const [tokenOut, setTokenOut] = useState<TokenInfo>(USDC)
  const [amountIn, setAmountIn] = useState('1.0')
  const [slippage, setSlippage] = useState(0.5)
  const [isExecuting, setIsExecuting] = useState(false)
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>(buildSteps(WETH))
  const [result, setResult] = useState<SwapResult | null>(null)

  const { writeContract, data: approveTxHash, isPending: isApprovePending, isError: isApproveError } = useWriteContract()
  const { isLoading: isApproveLoading, isSuccess: isApproveConfirmed } = useWaitForTransactionReceipt({ hash: approveTxHash })

  const { writeContract: writeSwap, data: swapTxHash, isPending: isSwapPending } = useWriteContract()
  const { isLoading: isSwapLoading, isSuccess: isSwapSuccess, isError: isSwapError, data: receipt } = useWaitForTransactionReceipt({ hash: swapTxHash })

  useEffect(() => {
    setFlowSteps(buildSteps(tokenIn))
  }, [tokenIn])

  const updateSteps = useCallback((activeIdx: number, detail?: string) => {
    setFlowSteps(prev => prev.map((s, i) => {
      if (i < activeIdx) return { ...s, status: 'done' as const }
      if (i === activeIdx) return { ...s, status: 'active' as const, detail }
      return s
    }))
  }, [])

  const markStepsDone = useCallback(() => {
    setFlowSteps(prev => prev.map(s => ({ ...s, status: 'done' as const })))
  }, [])

  const markStepError = useCallback(() => {
    setFlowSteps(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' as const } : s))
  }, [])

  const connectWallet = useCallback(() => {
    connect({ connector: injected() })
  }, [connect])

  const switchTokens = useCallback(() => {
    const tmp = tokenIn
    setTokenIn(tokenOut)
    setTokenOut(tmp)
    setAmountIn('1.0')
  }, [tokenIn, tokenOut])

  const executeSwap = useCallback(() => {
    if (!address || isExecuting) return
    setIsExecuting(true)
    setResult(null)
    setFlowSteps(buildSteps(tokenIn))

    updateSteps(0, `Approving ${PERMIT2_ADDRESS.slice(0, 10)}... to spend ${amountIn} ${tokenIn.symbol}`)
    writeContract({
      address: tokenIn.address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [PERMIT2_ADDRESS, MAX_UINT256],
    })
  }, [address, amountIn, tokenIn, isExecuting, writeContract, updateSteps])

  useEffect(() => {
    if (!isExecuting || !address) return

    if (isApprovePending || isApproveLoading) {
      updateSteps(0, `Approval tx: ${approveTxHash?.slice(0, 14)}...`)
      return
    }
    if (isApproveError) { markStepError(); setIsExecuting(false); return }
    if (!isApproveConfirmed) return

    const amountInParsed = parseUnits(amountIn, tokenIn.decimals)
    const slippageBasis = Math.floor(slippage * 100)
    const amountOutMinimum = amountInParsed * (10000n - BigInt(slippageBasis)) / 10000n

    updateSteps(1, `amountOutMinimum=${formatTokenAmount(amountOutMinimum, tokenOut.decimals)} ${tokenOut.symbol} (${slippage}% slippage)`)
    const plan = buildSwapPlan(tokenIn.address, tokenOut.address, amountInParsed, amountOutMinimum, address)
    updateSteps(2, `Command bytes: ${plan.commands}`)
    updateSteps(3, `Sending to UniversalRouter (${UNIVERSAL_ROUTER_ADDRESS.slice(0, 10)}...)`)

    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1800)
    writeSwap({
      address: UNIVERSAL_ROUTER_ADDRESS,
      abi: UNIVERSAL_ROUTER_ABI,
      functionName: 'execute',
      args: [plan.commands as `0x${string}`, plan.inputs as `0x${string}`[], deadline],
    })
  }, [isExecuting, address, tokenIn, tokenOut, amountIn, slippage, approveTxHash, isApprovePending, isApproveLoading, isApproveError, isApproveConfirmed, writeSwap, updateSteps, markStepError])

  useEffect(() => {
    if (!isExecuting || !address) return
    if (!approveTxHash || !isApproveConfirmed) return

    if (isSwapPending || isSwapLoading) {
      updateSteps(4, `Swap tx: ${swapTxHash?.slice(0, 14)}...`)
      return
    }
    if (isSwapError) { markStepError(); setIsExecuting(false); return }
    if (!isSwapSuccess || !receipt) return

    updateSteps(5, `Scanning ${receipt.logs.length} logs...`)

    let amount0 = 0n
    let amount1 = 0n
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({ abi: POOL_MANAGER_ABI, data: log.data, topics: log.topics })
        if (decoded.eventName === 'Swap') {
          const args = decoded.args as { amount0: bigint; amount1: bigint }
          amount0 = BigInt(args.amount0.toString())
          amount1 = BigInt(args.amount1.toString())
          break
        }
      } catch { /* not a Swap event */ }
    }

    const fullDeltaPacked =
      amount0 !== 0n || amount1 !== 0n
        ? ((amount0 < 0n ? amount0 + (1n << 128n) : amount0) << 128n) |
          (amount1 < 0n ? amount1 + (1n << 128n) : amount1)
        : 0n
    const decoded = decodeBalanceDelta(fullDeltaPacked)
    const quotedOut = parseUnits(amountIn, tokenOut.decimals)
    const actualOut = decoded.amount1 > 0n ? decoded.amount1 : decoded.amount0 > 0n ? decoded.amount0 : 0n
    const quotedNum = Number(formatTokenAmount(quotedOut, tokenOut.decimals))
    const actualNum = Number(formatTokenAmount(actualOut, tokenOut.decimals))
    const realizedSlippage = quotedNum > 0 ? ((quotedNum - actualNum) / quotedNum) * 100 : 0

    const amountInParsed = parseUnits(amountIn, tokenIn.decimals)
    const slippageBasis = Math.floor(slippage * 100)
    const amountOutMinimum = amountInParsed * (10000n - BigInt(slippageBasis)) / 10000n

    const fullDelta: DecodedDelta = {
      amount0: decoded.amount0,
      amount1: decoded.amount1,
      amount0Formatted: formatTokenAmount(decoded.amount0, tokenIn.decimals),
      amount1Formatted: formatTokenAmount(decoded.amount1, tokenOut.decimals),
      isAmount0Negative: decoded.amount0 < 0n,
      isAmount1Negative: decoded.amount1 < 0n,
      hex: '0x' + fullDeltaPacked.toString(16).padStart(64, '0'),
    }

    const swapResult: SwapResult = {
      amountIn: amountInParsed.toString(),
      amountInFormatted: formatTokenAmount(amountInParsed, tokenIn.decimals),
      tokenInSymbol: tokenIn.symbol,
      tokenOutSymbol: tokenOut.symbol,
      quotedAmountOut: quotedOut.toString(),
      quotedAmountOutFormatted: formatTokenAmount(quotedOut, tokenOut.decimals),
      amountOutMinimum: amountOutMinimum.toString(),
      amountOutMinimumFormatted: formatTokenAmount(amountOutMinimum, tokenOut.decimals),
      actualAmountOut: actualOut,
      actualAmountOutFormatted: formatTokenAmount(actualOut, tokenOut.decimals),
      executedPrice: quotedNum > 0 ? `1 ${tokenIn.symbol} ≈ ${(actualNum / quotedNum).toFixed(6)} ${tokenOut.symbol}` : '—',
      realizedSlippage,
      balanceDelta: fullDelta,
      gasUsed: receipt.gasUsed,
      gasUsedFormatted: receipt.gasUsed.toString(),
      txHash: swapTxHash!,
      approvalTxHash: approveTxHash,
      txStatus: 'confirmed',
    }

    updateSteps(6, `Quoted: ${swapResult.quotedAmountOutFormatted} ${tokenOut.symbol} | Realized: ${swapResult.actualAmountOutFormatted} ${tokenOut.symbol} | Slippage: ${realizedSlippage.toFixed(4)}%`)
    setResult(swapResult)
    markStepsDone()
    setIsExecuting(false)
  }, [isExecuting, address, approveTxHash, isApproveConfirmed, isSwapPending, isSwapLoading, isSwapSuccess, isSwapError, swapTxHash, receipt, tokenIn, tokenOut, amountIn, slippage, updateSteps, markStepsDone, markStepError])

  const isBusy = isExecuting || isApprovePending || isApproveLoading || isSwapPending || isSwapLoading

  return {
    address, isConnected, connectWallet, disconnect: () => disconnect(),
    tokenIn, tokenOut, setTokenIn, setTokenOut,
    amountIn, setAmountIn, slippage, setSlippage,
    isExecuting: isBusy, isApprovePending: isApprovePending || isApproveLoading,
    isSwapPending: isSwapPending || isSwapLoading,
    flowSteps, result, switchTokens, executeSwap, tokens: TOKENS,
  }
}
