import { V4Planner, Actions, encodeRouteToPath } from '@uniswap/v4-sdk'
import { RoutePlanner, SwapRouter, CommandType } from '@uniswap/universal-router-sdk'
import { PERMIT2_ADDRESS, MaxAllowanceTransferAmount } from '@uniswap/permit2-sdk'
import { Token, Ether } from '@uniswap/sdk-core'
import { BigNumber } from 'ethers'
import {
  keccak256,
  encodeAbiParameters,
  parseAbi,
} from 'viem'
import type { Hex } from 'viem'

// --- Contract addresses (Ethereum mainnet) ---

export const POOL_MANAGER = '0x000000000004444C5dc75cB358380D2e3dE08A90' as const
export const STATE_VIEW = '0x7fFE42c4a5DEeA5b0feC41C94C136Cf4F4035c22' as const
export const UNIVERSAL_ROUTER = '0x6fF5693b99212Da76ad316178A184AB56D299b43' as const
export const PERMIT2 = PERMIT2_ADDRESS as Hex

// --- SDK re-exports ---

export { V4Planner, Actions, encodeRouteToPath }
export { RoutePlanner, SwapRouter, CommandType }
export { Token, Ether, BigNumber }
export { PERMIT2_ADDRESS, MaxAllowanceTransferAmount }
export type { Hex }

// --- Token catalog using real SDK Token class ---

export const NATIVE_ETH = Ether.onChain(1)

export const TOKENS = [
  { symbol: 'ETH', name: 'Ether', address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Hex, decimals: 18, isNative: true, currency: NATIVE_ETH },
  { symbol: 'WETH', name: 'Wrapped Ether', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Hex, decimals: 18, isNative: false, currency: new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH', 'Wrapped Ether') },
  { symbol: 'USDC', name: 'USD Coin', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Hex, decimals: 6, isNative: false, currency: new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC', 'USD Coin') },
  { symbol: 'USDT', name: 'Tether', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as Hex, decimals: 6, isNative: false, currency: new Token(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 6, 'USDT', 'Tether') },
  { symbol: 'DAI', name: 'Dai', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' as Hex, decimals: 18, isNative: false, currency: new Token(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 18, 'DAI', 'Dai Stablecoin') },
  { symbol: 'UNI', name: 'Uniswap', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' as Hex, decimals: 18, isNative: false, currency: new Token(1, '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 18, 'UNI', 'Uniswap') },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' as Hex, decimals: 8, isNative: false, currency: new Token(1, '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 8, 'WBTC', 'Wrapped Bitcoin') },
]

export type TokenInfo = typeof TOKENS[number]

export const WETH = TOKENS.find(t => t.symbol === 'WETH')!

// --- Genuine v4-core types ---

export interface PoolKey {
  currency0: Hex
  currency1: Hex
  fee: number
  tickSpacing: number
  hooks: Hex
}

export interface BalanceDelta {
  amount0: bigint
  amount1: bigint
}

export type Currency = Hex

// --- PoolKey construction (v4-core: currency0 < currency1) ---

export function toPoolCurrency(token: TokenInfo): Hex {
  return token.isNative ? WETH.address : token.address
}

export function buildPoolKey(
  tokenA: TokenInfo,
  tokenB: TokenInfo,
  fee = 3000,
  tickSpacing = 60,
  hooks: Hex = '0x0000000000000000000000000000000000000000',
): PoolKey {
  const a = toPoolCurrency(tokenA).toLowerCase()
  const b = toPoolCurrency(tokenB).toLowerCase()
  const [currency0, currency1] = a < b
    ? [toPoolCurrency(tokenA), toPoolCurrency(tokenB)]
    : [toPoolCurrency(tokenB), toPoolCurrency(tokenA)]
  return { currency0, currency1, fee, tickSpacing, hooks }
}

// --- PoolId = keccak256(abi.encode(PoolKey)) ---

export function poolIdFromKey(key: PoolKey): Hex {
  return keccak256(
    encodeAbiParameters(
      [{
        name: 'poolKey',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      }],
      [key],
    ),
  )
}

export function zeroForOne(tokenIn: TokenInfo, poolKey: PoolKey): boolean {
  const inCurrency = toPoolCurrency(tokenIn).toLowerCase()
  return inCurrency === poolKey.currency0.toLowerCase()
}

// --- BalanceDelta decoding (v4-core packed int256) ---

export function decodeBalanceDelta(raw: bigint): BalanceDelta {
  const asInt256 = BigInt.asIntN(256, raw)
  const amount0 = BigInt.asIntN(128, asInt256 >> 128n)
  const amount1 = BigInt.asIntN(128, asInt256 & ((1n << 128n) - 1n))
  return { amount0, amount1 }
}

export function encodeBalanceDelta(delta: BalanceDelta): bigint {
  return (BigInt.asIntN(128, delta.amount0) << 128n) | (BigInt(BigInt.asIntN(128, delta.amount1)) & ((1n << 128n) - 1n))
}

// --- ABIs for contract reads ---

export const STATE_VIEW_ABI = parseAbi([
  'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  'function getLiquidity(bytes32 poolId) external view returns (uint128)',
])

export const POOL_MANAGER_ABI = parseAbi([
  'function extsload(bytes32 slot) external view returns (bytes32)',
  'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)',
])

export const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
])

export const PERMIT2_ABI = parseAbi([
  'function allowance(address owner, address token, address spender) external view returns (uint160 amount, uint48 expiration, uint48 nonce)',
  'function approve(address token, address spender, uint160 amount, uint48 expiration) external payable',
])

// --- Build swap calldata using real V4 SDK ---

export interface SwapParams {
  poolKey: PoolKey
  zeroForOne: boolean
  amountIn: bigint
  amountOutMinimum: bigint
  hookData?: Hex
  currencyIn: Hex
  currencyOut: Hex
  recipient: Hex
  deadline: number
  isNativeInput: boolean
}

export function buildSwapCalldata(params: SwapParams): { calldata: Hex; value: bigint } {
  if (params.amountIn <= 0n) throw new Error('amountIn must be > 0')
  if (params.amountOutMinimum <= 0n) throw new Error('amountOutMinimum must be > 0')
  if (params.deadline <= 0) throw new Error('deadline must be > 0')

  const hookData = params.hookData ?? '0x'

  const v4Planner = new V4Planner()

  v4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [[
    [params.poolKey.currency0, params.poolKey.currency1, params.poolKey.fee, params.poolKey.tickSpacing, params.poolKey.hooks],
    params.zeroForOne,
    params.amountIn.toString(),
    params.amountOutMinimum.toString(),
    hookData,
  ]])

  v4Planner.addAction(Actions.SETTLE_ALL, [
    params.isNativeInput ? '0x0000000000000000000000000000000000000000' : params.currencyIn,
    params.amountIn.toString(),
  ])

  v4Planner.addAction(Actions.TAKE_ALL, [
    params.currencyOut,
    params.amountOutMinimum.toString(),
  ])

  const routePlanner = new RoutePlanner()
  routePlanner.addCommand(CommandType.V4_SWAP, [v4Planner.finalize()])

  const nativeValue = params.isNativeInput ? BigNumber.from(params.amountIn.toString()) : BigNumber.from(0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (SwapRouter as any).encodePlan(routePlanner, nativeValue, {
    deadline: BigNumber.from(params.deadline),
  })

  return {
    calldata: result.calldata as Hex,
    value: BigInt(result.value),
  }
}

// --- Price math from real sqrtPriceX96 ---

export function priceFromSqrtPriceX96(sqrtPriceX96: bigint): number {
  const Q96 = 2n ** 96n
  const ratio = Number(sqrtPriceX96) / Number(Q96)
  return ratio * ratio
}

export function estimateOutput(
  sqrtPriceX96: bigint,
  amountInRaw: bigint,
  decimalsIn: number,
  decimalsOut: number,
  feeBps: number,
): bigint {
  if (sqrtPriceX96 === 0n || amountInRaw === 0n) return 0n
  const price = priceFromSqrtPriceX96(sqrtPriceX96)
  const decimalsAdj = 10 ** (decimalsOut - decimalsIn)
  const feeMul = 1 - feeBps / 1_000_000
  const outFloat = (Number(amountInRaw) / 10 ** decimalsIn) * price * decimalsAdj * feeMul
  return BigInt(Math.floor(outFloat * 10 ** decimalsOut))
}

// --- Formatting ---

export function formatTokenAmount(raw: bigint, decimals: number, displayDecimals = 4): string {
  const value = Number(raw) / 10 ** decimals
  if (value === 0) return '0.00'
  if (Math.abs(value) < 0.0001) return value.toExponential(2)
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: displayDecimals,
  })
}

export function formatAddr(addr: Hex): string {
  if (addr === '0x0000000000000000000000000000000000000000') return '0x0000…0000'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function needsPermit2Approval(token: TokenInfo): boolean {
  return !token.isNative && token.symbol !== 'ETH'
}
