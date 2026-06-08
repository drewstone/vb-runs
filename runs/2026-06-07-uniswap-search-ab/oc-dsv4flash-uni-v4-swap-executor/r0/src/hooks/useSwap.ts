import { useState, useCallback, useEffect } from 'react'
import { useAccount, useSendTransaction, useWaitForTransactionReceipt, useWriteContract, useReadContract } from 'wagmi'
import { maxUint256, type Address, type Hex } from 'viem'
import type { TokenInfo, SwapState, TransactionResult, BalanceDelta } from '../types'
import {
  buildPoolKey, encodeV4SwapCalldata, computeAmountOutMinimum,
  parseUnits, formatUnits, parseBalanceDeltaFromLogs,
  PERMIT2_ADDRESS, V4_QUOTER_ADDRESS, QUOTER_ABI, ERC20_ABI,
} from '../utils/swapRouter'
import { computeSlippagePercent } from '../utils/balanceDelta'

const DEFAULT_SLIPPAGE = 0.5
const DEFAULT_DEADLINE = 30

export function useSwap() {
  const { address, chainId } = useAccount()

  const [state, setState] = useState<SwapState>({
    inputToken: null,
    outputToken: null,
    amountIn: '',
    amountOut: '',
    quotedAmountOut: '',
    slippageTolerance: DEFAULT_SLIPPAGE,
    deadline: DEFAULT_DEADLINE,
    recipient: '',
  })

  const [txResult, setTxResult] = useState<TransactionResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [needsApproval, setNeedsApproval] = useState(false)

  const { data: swapTxHash, sendTransaction, isPending: isSwapping, error: sendError } = useSendTransaction()
  const { data: swapReceipt, isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: swapTxHash })

  const {
    writeContract: approveTokenContract,
    isPending: isApproving,
    error: approveError,
  } = useWriteContract()

  const inputIsNative = state.inputToken?.address === '0x0000000000000000000000000000000000000000'

  const { data: allowance } = useReadContract({
    address: inputIsNative || !state.inputToken ? undefined : state.inputToken.address as Address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && state.inputToken && !inputIsNative ? [address, PERMIT2_ADDRESS] : undefined,
    query: { enabled: !!address && !!state.inputToken && !inputIsNative },
  })

  const [quoteParams, setQuoteParams] = useState<{
    poolKey: ReturnType<typeof buildPoolKey>
    zeroForOne: boolean
    amountInRaw: bigint
  } | null>(null)

  useEffect(() => {
    if (state.inputToken && state.outputToken && state.amountIn && parseFloat(state.amountIn) > 0) {
      const poolKey = buildPoolKey(state.inputToken, state.outputToken, 3000, 60, '0x0000000000000000000000000000000000000000')
      const zeroForOne = poolKey.currency0 === state.inputToken.address.toLowerCase()
      const amountInRaw = parseUnits(state.amountIn, state.inputToken.decimals)
      setQuoteParams({ poolKey, zeroForOne, amountInRaw })
    } else {
      setQuoteParams(null)
    }
  }, [state.inputToken, state.outputToken, state.amountIn])

  const { data: quoteResult, isFetching: _isQuoteLoading } = useReadContract({
    address: V4_QUOTER_ADDRESS as Address,
    abi: QUOTER_ABI,
    functionName: 'quoteExactInputSingle',
    args: quoteParams ? [quoteParams.poolKey, quoteParams.zeroForOne, quoteParams.amountInRaw, '0x'] : undefined,
    query: { enabled: !!quoteParams },
  })

  useEffect(() => {
    if (quoteResult && quoteParams && state.outputToken) {
      const amountOutRaw = (quoteResult as [bigint])[0]
      const outStr = formatUnits(amountOutRaw, state.outputToken.decimals)
      setState(prev => ({ ...prev, amountOut: outStr, quotedAmountOut: outStr }))
    }
  }, [quoteResult, quoteParams])

  useEffect(() => {
    if (!address || !state.inputToken) return
    if (inputIsNative) { setNeedsApproval(false); return }
    if (allowance === undefined) return
    const amountInRaw = state.amountIn ? parseUnits(state.amountIn, state.inputToken.decimals) : 0n
    setNeedsApproval(allowance < amountInRaw)
  }, [allowance, address, state.inputToken, state.inputToken?.address, state.amountIn, inputIsNative])

  useEffect(() => { if (sendError) setError(sendError.message) }, [sendError])
  useEffect(() => { if (approveError) setError(approveError.message) }, [approveError])

  useEffect(() => {
    if (!swapReceipt || !swapTxHash || !quoteParams || !state.outputToken) return

    const quotedRaw = quoteResult ? (quoteResult as [bigint])[0] : 0n
    const poolAddr = quoteParams.zeroForOne ? quoteParams.poolKey.currency1 : quoteParams.poolKey.currency0
    const safeLogs = (swapReceipt.logs ?? []) as { address: string; data: string; topics: string[] }[]
    const delta = parseBalanceDeltaFromLogs(safeLogs, poolAddr) as BalanceDelta | undefined

    let actualAmountOut = 0n
    if (delta) {
      const outAmount = quoteParams.zeroForOne ? delta.amount1 : delta.amount0
      actualAmountOut = outAmount < 0n ? -outAmount : outAmount
    }

    const actualOutStr = actualAmountOut > 0n
      ? formatUnits(actualAmountOut, state.outputToken.decimals)
      : state.amountOut

    const realizedSlippage = computeSlippagePercent(state.quotedAmountOut || state.amountOut, actualOutStr)

    const inputAmt = parseFloat(state.amountIn || '0')
    const outputAmt = parseFloat(actualOutStr || '0')
    const executedPrice = inputAmt > 0 && outputAmt > 0 ? (outputAmt / inputAmt).toFixed(8) : '0'

    const gasUsed = swapReceipt.gasUsed ? formatUnits(swapReceipt.gasUsed * (swapReceipt.effectiveGasPrice ?? 0n), 18) : undefined

    setTxResult({
      hash: swapTxHash,
      status: swapReceipt.status === 'success' ? 'confirmed' : 'failed',
      blockNumber: Number(swapReceipt.blockNumber),
      balanceDelta: delta || undefined,
      amountIn: state.amountIn,
      amountOut: actualOutStr,
      quotedAmountOut: state.quotedAmountOut || state.amountOut,
      executedPrice,
      gasUsed,
      realizedSlippage,
      quotedSlippage: state.slippageTolerance,
      timestamp: Date.now(),
    })
  }, [swapReceipt, swapTxHash, quoteParams, state, quoteResult])

  const setInputToken = useCallback((token: TokenInfo) => {
    setState(prev => ({ ...prev, inputToken: token, amountOut: '', quotedAmountOut: '' }))
    setTxResult(null)
  }, [])

  const setOutputToken = useCallback((token: TokenInfo) => {
    setState(prev => ({ ...prev, outputToken: token, amountOut: '', quotedAmountOut: '' }))
    setTxResult(null)
  }, [])

  const setAmountIn = useCallback((amount: string) => {
    setState(prev => ({ ...prev, amountIn: amount, amountOut: '', quotedAmountOut: '' }))
    setTxResult(null)
  }, [])

  const setSlippage = useCallback((s: number) => { setState(prev => ({ ...prev, slippageTolerance: s })) }, [])
  const setDeadline = useCallback((d: number) => { setState(prev => ({ ...prev, deadline: d })) }, [])

  const swapTokens = useCallback(() => {
    setState(prev => ({
      ...prev, amountIn: '', amountOut: '', quotedAmountOut: '',
      inputToken: prev.outputToken, outputToken: prev.inputToken,
    }))
    setTxResult(null)
  }, [])

  const approveToken = useCallback(() => {
    if (!state.inputToken || inputIsNative) return
    approveTokenContract({
      address: state.inputToken.address as Address,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [PERMIT2_ADDRESS, maxUint256],
    })
  }, [state.inputToken, inputIsNative, approveTokenContract])

  const executeSwap = useCallback(() => {
    const cur = state
    if (!cur.inputToken || !cur.outputToken || !cur.amountIn || !address || !chainId) {
      setError('Fill in swap details'); return
    }
    if (!quoteResult) { setError('Quote not ready'); return }
    setError(null)

    const poolKey = buildPoolKey(cur.inputToken, cur.outputToken, 3000, 60, '0x0000000000000000000000000000000000000000')
    const zeroForOne = poolKey.currency0 === cur.inputToken.address.toLowerCase()
    const amountInRaw = parseUnits(cur.amountIn, cur.inputToken.decimals)
    const quotedAmountOutRaw = (quoteResult as [bigint])[0]
    const amountOutMinimum = computeAmountOutMinimum(quotedAmountOutRaw, cur.slippageTolerance)
    const deadline = Math.floor(Date.now() / 1000) + cur.deadline * 60
    const nativeValue = inputIsNative ? amountInRaw : 0n

    const calldata = encodeV4SwapCalldata({
      poolKey,
      zeroForOne,
      amountInRaw,
      amountOutMinimum,
      hookData: '0x',
      deadline,
      nativeValue,
    })

    sendTransaction({
      to: calldata.to,
      data: calldata.data as Hex,
      value: calldata.value,
    })
  }, [state, address, chainId, quoteResult, sendTransaction, inputIsNative])

  const reset = useCallback(() => {
    setState({
      inputToken: null, outputToken: null, amountIn: '', amountOut: '',
      quotedAmountOut: '', slippageTolerance: DEFAULT_SLIPPAGE,
      deadline: DEFAULT_DEADLINE, recipient: '',
    })
    setTxResult(null); setError(null); setNeedsApproval(false)
  }, [])

  return {
    state,
    txResult,
    isSwapping: isSwapping || isConfirming,
    isApproving,
    needsApproval,
    error,
    setInputToken,
    setOutputToken,
    setAmountIn,
    setSlippage,
    setDeadline,
    swapTokens,
    executeSwap,
    approveToken,
    reset,
    setTxResult,
  }
}
