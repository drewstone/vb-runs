import { useState, useCallback, useMemo, useEffect } from 'react'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import type { PoolKey } from '@uniswap/v4-sdk'
import type { PoolConfig, WizardStep, InitializeResult } from '../types.ts'
import { EMPTY_POOL_CONFIG } from '../types.ts'
import { getSortedTokens } from '../utils/tokens.ts'
import { computePoolId } from '../utils/poolId.ts'

export const POOL_MANAGER_ADDRESS = '0x00000000000444c5dc75cB358380D2e3dE08A90'

export const POOL_MANAGER_ABI = [
  {
    type: 'function' as const,
    name: 'initialize',
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' as const },
          { name: 'currency1', type: 'address' as const },
          { name: 'fee', type: 'uint24' as const },
          { name: 'tickSpacing', type: 'int24' as const },
          { name: 'hooks', type: 'address' as const },
        ],
      },
      { name: 'sqrtPriceX96', type: 'uint160' as const },
    ],
    outputs: [{ name: 'poolId', type: 'bytes32' as const }],
    stateMutability: 'nonpayable' as const,
  },
] as const

export function usePoolWizard() {
  const [config, setConfig] = useState<PoolConfig>({ ...EMPTY_POOL_CONFIG })
  const [step, setStep] = useState<WizardStep>('tokens')
  const [result, setResult] = useState<InitializeResult | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { data: receipt, isLoading: isWaiting } = useWaitForTransactionReceipt({ hash })

  const isInitializing = isPending || isWaiting

  // PoolKey built from sorted tokens — ensures currency0 < currency1 by address ordering
  // Sorting uses BigInt comparison of addresses as per Uniswap V4 spec
  const poolKey: PoolKey | null = useMemo(() => {
    if (!config.token0 || !config.token1 || !config.feeTier) return null

    const [token0, token1] = getSortedTokens(config.token0, config.token1)
    return {
      currency0: token0.address as `0x${string}`,
      currency1: token1.address as `0x${string}`,
      fee: config.feeTier.fee,
      tickSpacing: config.tickSpacing,
      hooks: config.hooksAddress as `0x${string}`,
    }
  }, [config])

  // When transaction receipt arrives, compute pool ID using the SDK and advance to result
  useEffect(() => {
    if (receipt && config.token0 && config.token1 && config.feeTier) {
      const [t0, t1] = getSortedTokens(config.token0, config.token1)
      const poolId = computePoolId(
        t0,
        t1,
        config.feeTier.fee,
        config.tickSpacing,
        config.hooksAddress,
      )
      setResult({
        poolId,
        txHash: hash!,
        blockNumber: Number(receipt.blockNumber),
      })
      setStep('result')
    }
  }, [receipt, config, hash])

  const setToken0 = useCallback((token: typeof config.token0) => {
    setConfig(prev => ({ ...prev, token0: token }))
  }, [])

  const setToken1 = useCallback((token: typeof config.token1) => {
    setConfig(prev => ({ ...prev, token1: token }))
  }, [])

  const swapTokens = useCallback(() => {
    setConfig(prev => ({ ...prev, token0: prev.token1, token1: prev.token0 }))
  }, [])

  const setFeeTier = useCallback((feeTier: typeof config.feeTier) => {
    setConfig(prev => ({
      ...prev,
      feeTier,
      tickSpacing: feeTier?.tickSpacing ?? prev.tickSpacing,
    }))
  }, [])

  const setTickSpacing = useCallback((spacing: number) => {
    setConfig(prev => ({ ...prev, tickSpacing: spacing }))
  }, [])

  const setCustomTickSpacing = useCallback((custom: boolean) => {
    setConfig(prev => ({
      ...prev,
      customTickSpacing: custom,
      tickSpacing: custom
        ? prev.tickSpacing
        : (prev.feeTier?.tickSpacing ?? 60),
    }))
  }, [])

  const setHooksAddress = useCallback((address: string) => {
    setConfig(prev => ({ ...prev, hooksAddress: address }))
  }, [])

  const setSqrtPriceX96 = useCallback((sqrtPriceX96: string) => {
    setConfig(prev => ({ ...prev, sqrtPriceX96 }))
  }, [])

  const validateStep = useCallback((s: WizardStep): boolean => {
    const errors: Record<string, string> = {}
    switch (s) {
      case 'tokens':
        if (!config.token0) errors.token0 = 'Select currency0'
        if (!config.token1) errors.token1 = 'Select currency1'
        if (config.token0 && config.token1 && config.token0.address === config.token1.address) {
          errors.token1 = 'Must select different tokens'
        }
        break
      case 'fees':
        if (!config.feeTier) errors.feeTier = 'Select a fee tier'
        if (config.tickSpacing < 1 || config.tickSpacing > 10000) {
          errors.tickSpacing = 'Tick spacing must be between 1 and 10000'
        }
        break
      case 'hooks': {
        const addr = config.hooksAddress
        if (!addr.match(/^0x[0-9a-fA-F]{40}$/)) {
          errors.hooksAddress = 'Enter a valid 0x-prefixed Ethereum address (42 chars)'
        }
        break
      }
      case 'price': {
        const x96 = config.sqrtPriceX96
        if (!x96 || !/^\d+$/.test(x96) || BigInt(x96) <= 0n) {
          errors.sqrtPriceX96 = 'Enter a positive integer for sqrtPriceX96'
        }
        break
      }
      default:
        break
    }
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [config])

  const nextStep = useCallback(() => {
    const steps: WizardStep[] = ['tokens', 'fees', 'hooks', 'price', 'review', 'result']
    const currentIdx = steps.indexOf(step)
    if (currentIdx < steps.length - 1 && validateStep(step)) {
      setStep(steps[currentIdx + 1])
    }
  }, [step, validateStep])

  const prevStep = useCallback(() => {
    const steps: WizardStep[] = ['tokens', 'fees', 'hooks', 'price', 'review', 'result']
    const currentIdx = steps.indexOf(step)
    if (currentIdx > 0) {
      setStep(steps[currentIdx - 1])
    }
  }, [step])

  const goToStep = useCallback((s: WizardStep) => {
    setStep(s)
  }, [])

  const initializePool = useCallback(() => {
    if (!poolKey) return
    setValidationErrors({})
    writeContract({
      address: POOL_MANAGER_ADDRESS,
      abi: POOL_MANAGER_ABI,
      functionName: 'initialize',
      args: [
        {
          currency0: poolKey.currency0 as `0x${string}`,
          currency1: poolKey.currency1 as `0x${string}`,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks as `0x${string}`,
        },
        BigInt(config.sqrtPriceX96),
      ],
    })
  }, [poolKey, config.sqrtPriceX96, writeContract])

  const reset = useCallback(() => {
    setConfig({ ...EMPTY_POOL_CONFIG })
    setStep('tokens')
    setResult(null)
    setValidationErrors({})
  }, [])

  return {
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
  }
}
