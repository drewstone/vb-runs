import type { Address } from 'viem'

/**
 * PoolManager contract addresses per chain.
 * Source: https://docs.uniswap.org/contracts/v4/deployments
 */
export const POOL_MANAGER_ADDRESSES: Record<number, Address> = {
  1: '0x000000000004444c5dc75cb358380d2e3de08a90',
  11155111: '0x3a9D48ab9751398Bbfa63ad67599Bb04e4bdf98b',
  8453: '0x498581fF718922c3f8e6A244956aF099B2652b2b',
}

/**
 * V4Quoter contract addresses per chain.
 * Source: https://etherscan.io/address/0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203
 */
export const V4_QUOTER_ADDRESSES: Record<number, Address> = {
  1: '0x52F0E24D1c21C8A0cB1e5a5dD6198556BD9E1203',
  11155111: '0xEd1e8128D0Bfd064Bfd556a3C68529F5533284eC',
  8453: '0x9f754dB36D4287e3E6BB3D6B37f0CC4c24318D21',
}

/**
 * PoolManager ABI — only the view functions needed for reading pool state.
 * StateLibrary.getSlot0 and getLiquidity are exposed as PoolManager view functions via extsload.
 */
export const poolManagerAbi = [
  {
    type: 'function',
    name: 'getSlot0',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
    stateMutability: 'view',
  } as const,
  {
    type: 'function',
    name: 'getLiquidity',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{ name: '', type: 'uint128' }],
    stateMutability: 'view',
  } as const,
] as const

/**
 * V4Quoter ABI — quoteExactInputSingle.
 * Note: This function is NOT view (it uses try/catch reverts internally),
 * but we call it via eth_call which simulates it without sending a tx.
 */
export const v4QuoterAbi = [
  {
    type: 'function',
    name: 'quoteExactInputSingle',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        components: [
          { name: 'poolKey', type: 'tuple', components: [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickSpacing', type: 'int24' },
            { name: 'hooks', type: 'address' },
          ]},
          { name: 'zeroForOne', type: 'bool' },
          { name: 'exactAmount', type: 'uint128' },
          { name: 'hookData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'gasEstimate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
  } as const,
] as const

/** MIN_SQRT_PRICE and MAX_SQRT_PRICE from Uniswap V4 core */
export const MIN_SQRT_RATIO = 4295128739n
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n
