import { encodeAbiParameters, parseAbiParameters, keccak256, encodePacked, fromHex } from 'viem'
import { V4Planner, Actions, type PoolKey as SDKPoolKey } from '@uniswap/v4-sdk'
import type { PoolKey, SwapPath, BalanceDelta } from '../types'

export { V4Planner, Actions }

export function encodeV4SwapExactInSingle(
  poolKey: PoolKey,
  zeroForOne: boolean,
  amountIn: bigint,
  amountOutMinimum: bigint,
  hookData: string
): string {
  const encoded = encodeAbiParameters(
    parseAbiParameters('(address,address,uint24,int24,address),bool,uint128,uint128,bytes'),
    [
      [
        poolKey.currency0 as `0x${string}`,
        poolKey.currency1 as `0x${string}`,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks as `0x${string}`
      ],
      zeroForOne,
      amountIn,
      amountOutMinimum,
      hookData as `0x${string}`
    ]
  )
  
  return encoded
}

export function encodeV4SwapExactIn(
  path: SwapPath,
  amountIn: bigint,
  amountOutMinimum: bigint,
  hookData: string
): string {
  const pathEncoded = encodeSwapPath(path)
  
  const encoded = encodeAbiParameters(
    parseAbiParameters('bytes,bytes,uint128,uint128'),
    [
      pathEncoded as `0x${string}`,
      hookData as `0x${string}`,
      amountIn,
      amountOutMinimum
    ]
  )
  
  return encoded
}

function encodeSwapPath(path: SwapPath): string {
  const encodedSteps = path.steps.map(step => {
    return encodeAbiParameters(
      parseAbiParameters('(address,address,uint24,int24,address),bool'),
      [
        [
          step.poolKey.currency0 as `0x${string}`,
          step.poolKey.currency1 as `0x${string}`,
          step.poolKey.fee,
          step.poolKey.tickSpacing,
          step.poolKey.hooks as `0x${string}`
        ],
        step.zeroForOne
      ]
    )
  })
  
  return encodePacked(['bytes[]'], [encodedSteps as unknown as readonly `0x${string}`[]])
}

export function decodeBalanceDelta(delta: string): BalanceDelta {
  const hex = delta.startsWith('0x') ? delta.slice(2) : delta
  const amount0 = fromHex(`0x${hex.slice(0, 32)}` as `0x${string}`, 'bigint')
  const amount1 = fromHex(`0x${hex.slice(32, 64)}` as `0x${string}`, 'bigint')
  
  return { amount0, amount1 }
}

export function calculateSlippage(quoted: bigint, actual: bigint): number {
  if (quoted === 0n) return 0
  const diff = quoted > actual ? quoted - actual : actual - quoted
  return Number((diff * 10000n) / quoted) / 100
}

export function getSqrtPriceLimitX96(): bigint {
  return 0n
}

export function formatTokenAmount(amount: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals)
  const integerPart = amount / divisor
  const fractionalPart = amount % divisor
  
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0')
  const trimmedFractional = fractionalStr.replace(/0+$/, '')
  
  if (trimmedFractional === '') {
    return integerPart.toString()
  }
  
  return `${integerPart}.${trimmedFractional}`
}

export function parseTokenAmount(amount: string, decimals: number): bigint {
  const [integerPart, fractionalPart = ''] = amount.split('.')
  const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals)
  const total = integerPart + paddedFractional
  return BigInt(total)
}

export function computePoolId(poolKey: PoolKey): string {
  return keccak256(
    encodePacked(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [
        poolKey.currency0 as `0x${string}`,
        poolKey.currency1 as `0x${string}`,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks as `0x${string}`
      ]
    )
  )
}

export function toSDKPoolKey(poolKey: PoolKey): SDKPoolKey {
  return {
    currency0: poolKey.currency0,
    currency1: poolKey.currency1,
    fee: poolKey.fee,
    tickSpacing: poolKey.tickSpacing,
    hooks: poolKey.hooks,
  }
}
