import { Token, Ether, CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core'
import { type PoolKey, Actions, V4Planner, encodeRouteToPath } from '@uniswap/v4-sdk'
import { SwapRouter, RoutePlanner, CommandType, type SwapSpecification, type SwapStep } from '@uniswap/universal-router-sdk'
import JSBI from 'jsbi'
import { type Address, type Hex, decodeEventLog, encodeFunctionData } from 'viem'
import type { TokenInfo } from '../types'

export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3'
export const UNIVERSAL_ROUTER_ADDRESS = '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD'
export const V4_QUOTER_ADDRESS = '0x3d4e44Db7C0c2C5e92F0EeB37E3bDc3b2B9C3b1B'

const EXECUTE_ABI = [
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'commands', type: 'bytes' },
      { name: 'inputs', type: 'bytes[]' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const

export const QUOTER_ABI = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    inputs: [
      {
        name: 'key', type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'zeroForOne', type: 'bool' },
      { name: 'exactAmount', type: 'uint256' },
      { name: 'hookData', type: 'bytes' },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
  },
] as const

export const ERC20_ABI = [
  { type: 'function', name: 'allowance', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { type: 'function', name: 'approve', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' },
] as const

const V4_SWAP_EVENT_TOPIC = '0xe6a3676e8e92e8f7e4b0ad3f17ccb7af0bb5b27d6b42cf7eacb76a7c5a7c7d'

export function buildPoolKey(token0: TokenInfo, token1: TokenInfo, fee: number, tickSpacing: number, hooks: string): PoolKey {
  const [addr0, addr1] = token0.address.toLowerCase() < token1.address.toLowerCase()
    ? [token0.address, token1.address]
    : [token1.address, token0.address]
  return { currency0: addr0, currency1: addr1, fee, tickSpacing, hooks }
}

export function computeAmountOutMinimum(amountOutRaw: bigint, slippageTolerance: number): bigint {
  const slippageBps = BigInt(Math.round(slippageTolerance * 100))
  return (amountOutRaw * (10000n - slippageBps)) / 10000n
}

export function parseUnits(value: string, decimals: number): bigint {
  const [int, frac = ''] = value.split('.')
  const padded = (int.replace(/^0+/, '') || '0') + frac.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(padded)
}

export function formatUnits(value: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals)
  const intPart = value / divisor
  const fracPart = value % divisor
  const frac = fracPart.toString().padStart(decimals, '0').replace(/0+$/, '')
  return `${intPart.toString()}${frac ? '.' + frac : ''}`
}

export interface EncodeSwapParams {
  poolKey: PoolKey
  zeroForOne: boolean
  amountInRaw: bigint
  amountOutMinimum: bigint
  hookData: string
  deadline: number
  nativeValue: bigint
}

export function encodeV4SwapCalldata(params: EncodeSwapParams): { to: Address; data: Hex; value: bigint } {
  const v4planner = new V4Planner()
  v4planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
    params.poolKey,
    params.zeroForOne,
    params.amountInRaw.toString(),
    params.amountOutMinimum.toString(),
    params.hookData,
  ])

  const planner = new RoutePlanner()
  planner.addCommand(CommandType.V4_SWAP, [v4planner.actions, v4planner.params])

  const { commands, inputs } = planner
  const data = encodeFunctionData({
    abi: EXECUTE_ABI,
    functionName: 'execute',
    args: [commands as Hex, inputs as Hex[], BigInt(params.deadline)],
  })

  return {
    to: UNIVERSAL_ROUTER_ADDRESS as Address,
    data,
    value: params.nativeValue,
  }
}

export interface BuildSwapCalldataParams {
  inputToken: TokenInfo
  outputToken: TokenInfo
  amountInRaw: bigint
  quotedAmountOutRaw: bigint
  amountOutMinimum: bigint
  slippageTolerance: number
  deadline: number
  chainId: number
  poolKey: PoolKey
  zeroForOne: boolean
  recipient: Address
}

export function buildSwapCalldata(params: BuildSwapCalldataParams): { to: Address; data: Hex; value: bigint } {
  const inputCurrency = params.inputToken.address === '0x0000000000000000000000000000000000000000'
    ? Ether.onChain(params.chainId)
    : new Token(params.chainId, params.inputToken.address as Address, params.inputToken.decimals, params.inputToken.symbol, params.inputToken.name)

  const outputCurrency = params.outputToken.address === '0x0000000000000000000000000000000000000000'
    ? Ether.onChain(params.chainId)
    : new Token(params.chainId, params.outputToken.address as Address, params.outputToken.decimals, params.outputToken.symbol, params.outputToken.name)

  const amount = CurrencyAmount.fromRawAmount(inputCurrency, JSBI.BigInt(params.amountInRaw.toString()))
  const quote = CurrencyAmount.fromRawAmount(outputCurrency, JSBI.BigInt(params.quotedAmountOutRaw.toString()))

  const spec: SwapSpecification = {
    tradeType: TradeType.EXACT_INPUT,
    routing: { inputToken: inputCurrency, outputToken: outputCurrency, amount, quote },
    slippageTolerance: new Percent(Math.round(params.slippageTolerance * 100), 10000),
    recipient: params.recipient,
    deadline: params.deadline,
  }

  const swapSteps: SwapStep[] = [{
    type: 'V4_SWAP',
    v4Actions: [{
      action: 'SWAP_EXACT_IN_SINGLE',
      poolKey: params.poolKey,
      zeroForOne: params.zeroForOne,
      amountIn: params.amountInRaw.toString(),
      amountOutMinimum: params.amountOutMinimum.toString(),
      hookData: '0x' as Hex,
    }],
  }]

  const { calldata, value } = SwapRouter.encodeSwaps(spec, swapSteps)

  return {
    to: UNIVERSAL_ROUTER_ADDRESS as Address,
    data: calldata as Hex,
    value: BigInt(value),
  }
}

export function parseBalanceDeltaFromLogs(
  logs: { address: string; data: string; topics: string[] }[],
  poolAddress: string,
): { amount0: bigint; amount1: bigint } | null {
  for (const log of logs) {
    if (log.address.toLowerCase() === poolAddress.toLowerCase() && log.topics[0]?.toLowerCase() === V4_SWAP_EVENT_TOPIC) {
      try {
        const decoded = decodeEventLog({
          abi: ['event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)'],
          data: log.data as `0x${string}`,
          topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
        })
        const args = decoded.args as unknown as { amount0: bigint; amount1: bigint }
        return { amount0: args.amount0, amount1: args.amount1 }
      } catch { return null }
    }
  }
  return null
}
