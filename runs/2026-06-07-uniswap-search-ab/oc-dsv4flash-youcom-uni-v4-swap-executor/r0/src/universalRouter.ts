import { V4Planner, Actions } from '@uniswap/v4-sdk'
import { RoutePlanner, CommandType } from '@uniswap/universal-router-sdk'
import type { Address } from 'viem'
import type { PoolKey } from './types'

export function buildSwapPlan(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  amountOutMinimum: bigint,
  recipient: Address,
): { commands: string; inputs: string[]; poolKey: PoolKey; zeroForOne: boolean } {
  const zeroForOne = tokenIn.toLowerCase() < tokenOut.toLowerCase()
  const [currency0, currency1] = zeroForOne ? [tokenIn, tokenOut] : [tokenOut, tokenIn]

  const poolKey: PoolKey = {
    currency0, currency1,
    fee: 3000,
    tickSpacing: 60,
    hooks: '0x0000000000000000000000000000000000000000',
  }

  const planner = new V4Planner()

  planner.addAction(Actions.SETTLE, [tokenIn, amountIn, true])

  planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [{
    poolKey: { currency0, currency1, fee: 3000, tickSpacing: 60, hooks: '0x0000000000000000000000000000000000000000' },
    zeroForOne,
    amountIn,
    amountOutMinimum,
    hookData: '0x',
  }])

  planner.addAction(Actions.TAKE, [tokenOut, recipient, amountOutMinimum])

  const v4Input = planner.finalize()

  const routePlanner = new RoutePlanner()
  routePlanner.addCommand(CommandType.V4_SWAP, [v4Input])

  return { commands: routePlanner.commands, inputs: routePlanner.inputs, poolKey, zeroForOne }
}

export function decodeBalanceDelta(delta: bigint): { amount0: bigint; amount1: bigint } {
  const MASK_128 = (1n << 128n) - 1n
  const SIGN_128 = 1n << 127n
  const a0u = (delta >> 128n) & MASK_128
  const a1u = delta & MASK_128
  return {
    amount0: a0u >= SIGN_128 ? a0u - (1n << 128n) : a0u,
    amount1: a1u >= SIGN_128 ? a1u - (1n << 128n) : a1u,
  }
}

export function formatUnits(value: bigint, decimals: number): string {
  const s = value.toString()
  const neg = s.startsWith('-')
  const abs = neg ? s.slice(1) : s
  if (abs.length <= decimals) {
    const padded = abs.padStart(decimals + 1, '0')
    const intPart = padded.slice(0, padded.length - decimals)
    const fracPart = padded.slice(padded.length - decimals).replace(/0+$/, '')
    return (neg ? '-' : '') + intPart + (fracPart ? '.' + fracPart : '')
  }
  const intPart = abs.slice(0, abs.length - decimals)
  const fracPart = abs.slice(abs.length - decimals).replace(/0+$/, '')
  return (neg ? '-' : '') + intPart + (fracPart ? '.' + fracPart : '')
}

export function formatTokenAmount(value: bigint, decimals: number, maxDecimals = 6): string {
  const formatted = formatUnits(value, decimals)
  const dot = formatted.indexOf('.')
  if (dot === -1) return formatted
  const keep = Math.min(formatted.length - dot - 1, maxDecimals)
  return formatted.slice(0, dot + keep + 1)
}

export function parseUnits(value: string, decimals: number): bigint {
  const neg = value.startsWith('-')
  const s = neg ? value.slice(1) : value
  const dot = s.indexOf('.')
  if (dot === -1) {
    return BigInt((neg ? '-' : '') + s + '0'.repeat(decimals))
  }
  const intPart = s.slice(0, dot)
  const fracPart = s.slice(dot + 1).padEnd(decimals, '0').slice(0, decimals)
  return BigInt((neg ? '-' : '') + intPart + fracPart)
}

export const UNIVERSAL_ROUTER_ABI = [
  {
    type: 'function' as const,
    name: 'execute',
    inputs: [
      { name: 'commands', type: 'bytes', internalType: 'bytes' },
      { name: 'inputs', type: 'bytes[]', internalType: 'bytes[]' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable' as const,
  },
]

export const ERC20_ABI = [
  {
    type: 'function' as const,
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'nonpayable' as const,
  },
  {
    type: 'function' as const,
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address', internalType: 'address' },
      { name: 'spender', type: 'address', internalType: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256', internalType: 'uint256' }],
    stateMutability: 'view' as const,
  },
]

export const POOL_MANAGER_ABI = [
  {
    type: 'event' as const,
    name: 'Swap',
    inputs: [
      { indexed: true, name: 'id', type: 'bytes32', internalType: 'PoolId' },
      { indexed: true, name: 'sender', type: 'address', internalType: 'address' },
      { indexed: false, name: 'amount0', type: 'int128', internalType: 'int128' },
      { indexed: false, name: 'amount1', type: 'int128', internalType: 'int128' },
      { indexed: false, name: 'fee', type: 'uint24', internalType: 'uint24' },
      { indexed: false, name: 'tick', type: 'int24', internalType: 'int24' },
      { indexed: false, name: 'hookData', type: 'bytes', internalType: 'bytes' },
    ],
  },
]
