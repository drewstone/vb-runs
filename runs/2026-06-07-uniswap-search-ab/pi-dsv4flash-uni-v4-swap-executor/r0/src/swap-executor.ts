/**
 * Real Uniswap V4 swap execution using @uniswap/v4-sdk's V4Planner.
 *
 * This module uses the real SDK to:
 *   1. Build swap calldata via V4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, ...)
 *   2. Encode routes via encodeRouteToPath (for multi-hop)
 *   3. Build the full Universal Router execute() call
 *   4. Provide Permit2 approval data
 *   5. Decode BalanceDelta from transaction receipts
 */
import { ethers } from 'ethers';
import { V4Planner, Actions, URVersion } from '@uniswap/v4-sdk';

// ── Types ──────────────────────────────────────────────────────────

export interface PoolKeyData {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}

export interface SwapCommand {
  /** Hex-encoded commands byte string */
  commands: `0x${string}`;
  /** Array of hex-encoded input byte strings */
  inputs: readonly `0x${string}`[];
  /** Unix timestamp deadline */
  deadline: bigint;
}

export interface BalanceDeltaResult {
  amount0: bigint;
  amount1: bigint;
}

export interface DecodedSwapResult {
  delta: BalanceDeltaResult;
  amountIn: bigint;
  amountOut: bigint;
  amountOutMinimum: bigint;
  requestedSlippagePercent: number;
  realizedSlippagePercent: number;
  quotedPrice: number;
  executedPrice: number;
}

// ── Constants ──────────────────────────────────────────────────────

/** Known Universal Router address on Ethereum mainnet */
export const UNIVERSAL_ROUTER_ADDRESS: `0x${string}` =
  '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD';

/** Permit2 contract address */
export const PERMIT2_ADDRESS: `0x${string}` =
  '0x000000000022D473030F116dDEE9F6B43aC78BA3';

// ── SDK helpers ────────────────────────────────────────────────────

/**
 * Build the execute() calldata for UniversalRouter using V4Planner.
 *
 * Flow:
 *   1. V4Planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [swapStruct])
 *   2. V4Planner.addAction(Actions.SETTLE, [currency, amount, payerIsUser])
 *   3. V4Planner.addAction(Actions.TAKE, [currency, recipient, amount])
 *   4. V4Planner.finalize() -> (commands bytes, inputs bytes[])
 *   5. Wrap in execute(commands, inputs, deadline)
 */
export function buildSwapCalldata(
  poolKey: PoolKeyData,
  zeroForOne: boolean,
  amountIn: bigint,
  amountOutMinimum: bigint,
  recipient: `0x${string}`,
  deadlineMinutes: number = 30,
): SwapCommand {
  const planner = new V4Planner();

  // Step 1: Add the SWAP_EXACT_IN_SINGLE action
  // Parameters are: [poolKeyStruct, zeroForOne, amountIn, amountOutMinimum, hookData]
  // poolKeyStruct is a JS object matching the solidity struct:
  //   { currency0, currency1, fee, tickSpacing, hooks }
  planner.addAction(
    Actions.SWAP_EXACT_IN_SINGLE,
    [
      {
        currency0: poolKey.currency0,
        currency1: poolKey.currency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks: poolKey.hooks,
      },
      zeroForOne,
      amountIn.toString(),
      amountOutMinimum.toString(),
      '0x', // hookData — empty for our hook
    ],
    URVersion.V2_0,
  );

  // Step 2: Add SETTLE — the user pays the input token
  const inputCurrency = zeroForOne ? poolKey.currency0 : poolKey.currency1;
  planner.addAction(Actions.SETTLE, [inputCurrency, amountIn.toString(), true]);

  // Step 3: Add TAKE — the user receives the output token
  const outputCurrency = zeroForOne ? poolKey.currency1 : poolKey.currency0;
  planner.addAction(Actions.TAKE, [outputCurrency, recipient, '0']);

  // Step 4: Finalize
  const encoded = planner.finalize();

  // encoded is ethers ABI-encoded (bytes, bytes[])
  // Decode it to extract commands and inputs arrays
  const decoded = ethers.utils.defaultAbiCoder.decode(
    ['bytes', 'bytes[]'],
    encoded,
  );

  const commands: `0x${string}` = decoded[0] as `0x${string}`;
  const inputs: readonly `0x${string}`[] = decoded[1] as readonly `0x${string}`[];

  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);

  return { commands, inputs, deadline };
}

/**
 * Encode the full UniversalRouter.execute(commands, inputs, deadline) call
 * as ABI-encoded calldata for use with wagmi's useWriteContract.
 */
export function encodeExecuteCalldata(cmd: SwapCommand): `0x${string}` {
  const iface = new ethers.utils.Interface([
    'function execute(bytes calldata commands, bytes[] calldata inputs, uint256 deadline) external payable',
  ]);
  return iface.encodeFunctionData('execute', [
    cmd.commands,
    cmd.inputs,
    cmd.deadline,
  ]) as `0x${string}`;
}

/**
 * Build the ABI for UniversalRouter.execute for wagmi's useWriteContract.
 */
export const UNIVERSAL_ROUTER_ABI = [
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'commands', type: 'bytes', internalType: 'bytes' },
      { name: 'inputs', type: 'bytes[]', internalType: 'bytes[]' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
] as const;

/**
 * Build the Permit2 approve() calldata.
 * Permit2.approve(token, spender, amount, expiration)
 *
 * The UniversalRouter is the spender. We approve it to spend the input token
 * via Permit2.
 */
export function buildPermit2ApproveCalldata(
  token: `0x${string}`,
  amount: bigint,
  spender: `0x${string}` = UNIVERSAL_ROUTER_ADDRESS,
  expiration: bigint = BigInt(Math.floor(Date.now() / 1000) + 86400 * 30), // 30 days
): `0x${string}` {
  const iface = new ethers.utils.Interface([
    'function approve(address token, address spender, uint160 amount, uint48 expiration) external',
  ]);
  return iface.encodeFunctionData('approve', [
    token,
    spender,
    amount,
    expiration,
  ]) as `0x${string}`;
}

export const PERMIT2_APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'token', type: 'address', internalType: 'address' },
      { name: 'spender', type: 'address', internalType: 'address' },
      { name: 'amount', type: 'uint160', internalType: 'uint160' },
      { name: 'expiration', type: 'uint48', internalType: 'uint48' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

// ── BalanceDelta decoding ──────────────────────────────────────────

/**
 * Decode a BalanceDelta from a transaction receipt log.
 *
 * BalanceDelta is an int256 where:
 *   - Upper 128 bits = amount0 (int128)
 *   - Lower 128 bits = amount1 (int128)
 *
 * This matches the on-chain BalanceDelta type from @uniswap/v4-core.
 */
export function decodeBalanceDeltaFromReceipt(deltaHex: string): BalanceDeltaResult {
  // Remove 0x prefix
  const hex = deltaHex.startsWith('0x') ? deltaHex.slice(2) : deltaHex;
  const padded = hex.padStart(64, '0');

  const amount0Hex = padded.slice(0, 32);
  const amount1Hex = padded.slice(32, 64);

  const amount0 = BigInt('0x' + amount0Hex);
  const amount1 = BigInt('0x' + amount1Hex);

  // Convert from two's complement int128
  return {
    amount0: amount0 >= BigInt(2) ** BigInt(127) ? amount0 - BigInt(2) ** BigInt(128) : amount0,
    amount1: amount1 >= BigInt(2) ** BigInt(127) ? amount1 - BigInt(2) ** BigInt(128) : amount1,
  };
}

/**
 * Decode the SwapProcessed event from the DynamicFeeSwapHook to extract
 * the on-chain BalanceDelta.
 *
 * Event signature: SwapProcessed(address,PoolKey,bool,int256,BalanceDelta,uint24)
 */
export function decodeSwapProcessedEvent(log: {
  topics: string[];
  data: string;
}): BalanceDeltaResult | null {
  try {
    const iface = new ethers.utils.Interface([
      'event SwapProcessed(address indexed sender, (address,address,uint24,int24,address) indexed poolKey, bool zeroForOne, int256 amountSpecified, int256 delta, uint24 effectiveFee)',
    ]);

    const parsed = iface.parseLog(log);
    const delta: bigint = parsed.args.delta;
    return decodeBalanceDeltaFromReceipt('0x' + BigInt(delta).toString(16));
  } catch {
    return null;
  }
}

/**
 * Extract BalanceDelta from a transaction receipt by searching for
 * SwapProcessed events emitted by our hook.
 */
export function extractDeltaFromReceipt(
  logs: Array<{ topics: string[]; data: string }>,
): BalanceDeltaResult | null {
  for (const log of logs) {
    const decoded = decodeSwapProcessedEvent(log);
    if (decoded) return decoded;
  }
  return null;
}

/**
 * Compute realized slippage from on-chain results.
 * Returns percentage (e.g., 0.5 = 0.5%).
 */
export function computeRealizedSlippage(
  amountOutMinimum: bigint,
  actualAmountOut: bigint,
): number {
  if (amountOutMinimum === BigInt(0)) return 0;
  const diff = amountOutMinimum - actualAmountOut;
  return Number(diff) / Number(amountOutMinimum) * 100;
}

/**
 * Build calldata for a full swap execution.
 * Wraps buildSwapCalldata for use with useWriteContract.
 */
export function executeSwap(
  poolKey: PoolKeyData,
  zeroForOne: boolean,
  amountIn: bigint,
  amountOutMinimum: bigint,
  recipient: `0x${string}`,
): SwapCommand {
  return buildSwapCalldata(poolKey, zeroForOne, amountIn, amountOutMinimum, recipient);
}
