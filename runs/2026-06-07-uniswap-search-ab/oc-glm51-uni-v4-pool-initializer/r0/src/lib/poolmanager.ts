import { encodeFunctionData } from 'viem'

export const POOL_MANAGER_SEPOLIA = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865' as const
const ZERO_ADDR = '0x0000000000000000000000000000000000000000'

const POOL_KEY_STRUCT = [
  { name: 'currency0', type: 'address' },
  { name: 'currency1', type: 'address' },
  { name: 'hooks', type: 'address' },
  { name: 'poolManager', type: 'address' },
  { name: 'fee', type: 'uint24' },
  { name: 'parameters', type: 'bytes32' },
] as const

export const POOLMANAGER_ABI = [
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
    name: 'getPool',
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'hooks', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        name: 'key',
        type: 'tuple',
        components: POOL_KEY_STRUCT,
      },
      { name: 'sqrtPriceX96', type: 'uint160' },
    ],
    name: 'initialize',
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'data', type: 'bytes' }],
    name: 'unlock',
    outputs: [{ name: '', type: 'bytes' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'id', type: 'bytes32' },
      {
        indexed: false,
        name: 'key',
        type: 'tuple',
        components: POOL_KEY_STRUCT,
      },
    ],
    name: 'Initialize',
    type: 'event',
  },
] as const

export type PoolKeyTuple = {
  currency0: `0x${string}`
  currency1: `0x${string}`
  hooks: `0x${string}`
  poolManager: `0x${string}`
  fee: number
  parameters: `0x${string}`
}

export function isAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s)
}

export function sortAddresses(a: string, b: string): [string, string] {
  const al = a.toLowerCase()
  const bl = b.toLowerCase()
  return al < bl ? [al, bl] : [bl, al]
}

export function encodeParameters(tickSpacing: number): `0x${string}` {
  const hex = BigInt(tickSpacing).toString(16).padStart(64, '0')
  return `0x${hex}` as `0x${string}`
}

export function buildPoolKey(
  currency0: string,
  currency1: string,
  fee: number,
  tickSpacing: number,
  hooks: string,
): PoolKeyTuple {
  const [c0, c1] = sortAddresses(currency0, currency1)
  return {
    currency0: c0 as `0x${string}`,
    currency1: c1 as `0x${string}`,
    hooks: (hooks || ZERO_ADDR) as `0x${string}`,
    poolManager: POOL_MANAGER_SEPOLIA,
    fee,
    parameters: encodeParameters(tickSpacing),
  }
}

export function encodeInitializeCallData(
  poolKey: PoolKeyTuple,
  sqrtPriceX96: bigint,
): `0x${string}` {
  return encodeFunctionData({
    abi: POOLMANAGER_ABI,
    functionName: 'initialize',
    args: [poolKey, sqrtPriceX96],
  })
}
