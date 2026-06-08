// Uniswap V4 Pool Initializer — core logic using real viem primitives.
// PoolId = keccak256(abi.encode(PoolKey)) computed with viem's keccak256 + encodeAbiParameters.
// sqrtPriceX96 ↔ price conversion via BigInt arithmetic.
// PoolManager.initialize call wired through wagmi useWriteContract.

import { keccak256, encodeAbiParameters, type Address, type Hex } from "viem";

// ── BigInt math constants ───────────────────────────────────────────────
// 2^96 = 79228162514264337593543950336 — used in sqrtPriceX96 math
const Q192 = 1n << 192n;

// ── Integer square root (Newton's method) ───────────────────────────────
function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("negative input to isqrt");
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

// ── sqrtPriceX96 → human-readable price ─────────────────────────────────
export function sqrtPriceX96ToPrice(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number
): string {
  const numerator = sqrtPriceX96 * sqrtPriceX96;
  const decimalAdjust = 10n ** BigInt(decimals0 - decimals1);
  const fullNum = numerator * decimalAdjust;
  const intPart = fullNum / Q192;
  const frac = fractionalPart(fullNum, Q192, 18);
  return frac === "0" ? intPart.toString() : `${intPart}.${frac}`;
}

function fractionalPart(num: bigint, denom: bigint, maxDigits: number): string {
  let result = "";
  let rem = num % denom;
  for (let i = 0; i < maxDigits && rem > 0n; i++) {
    rem *= 10n;
    result += (rem / denom).toString();
    rem = rem % denom;
  }
  return result.replace(/0+$/, "") || "0";
}

// ── Human-readable price → sqrtPriceX96 ─────────────────────────────────
export function priceToSqrtPriceX96(
  priceStr: string,
  decimals0: number,
  decimals1: number
): bigint {
  const precision = 18;
  const dotIdx = priceStr.indexOf(".");
  let intPart: string;
  let fracPart: string;
  if (dotIdx === -1) {
    intPart = priceStr.replace(/^0+/, "") || "0";
    fracPart = "";
  } else {
    intPart = priceStr.slice(0, dotIdx).replace(/^0+/, "") || "0";
    fracPart = priceStr.slice(dotIdx + 1);
  }
  const padded = fracPart.padEnd(precision, "0").slice(0, precision);
  const priceBig = BigInt(intPart + padded);
  const decimalFactor = 10n ** BigInt(precision);

  const decAdjust = BigInt(decimals1) - BigInt(decimals0);
  let rawPrice: bigint;
  if (decAdjust >= 0n) {
    rawPrice = priceBig * 10n ** decAdjust;
  } else {
    rawPrice = priceBig / 10n ** -decAdjust;
  }

  const target = (rawPrice * Q192) / decimalFactor;
  return isqrt(target);
}

// ── PoolId = keccak256(abi.encode(PoolKey)) using viem ──────────────────
// PoolKey struct in V4:
//   struct PoolKey {
//     Currency currency0;  // address (left-padded to bytes32)
//     Currency currency1;  // address
//     uint24 fee;
//     int24 tickSpacing;
//     IHooks hooks;        // address
//   }
export function computePoolId(
  currency0: Address,
  currency1: Address,
  fee: number,
  tickSpacing: number,
  hooks: Address
): Hex {
  // Use viem's encodeAbiParameters for the PoolKey tuple
  const encoded = encodeAbiParameters(
    [
      { name: "currency0", type: "address" },
      { name: "currency1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickSpacing", type: "int24" },
      { name: "hooks", type: "address" },
    ],
    [currency0, currency1, fee, tickSpacing, hooks]
  );
  return keccak256(encoded);
}

// ── PoolManager ABI — only the initialize function ──────────────────────
export const POOL_MANAGER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
        name: "key",
        type: "tuple",
      },
      { name: "sqrtPriceX96", type: "uint160" },
    ],
    name: "initialize",
    outputs: [{ name: "poolId", type: "bytes32" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

// ── Sepolia PoolManager deployment ──────────────────────────────────────
// Uniswap V4 PoolManager on Sepolia (official deployment)
export const POOL_MANAGER_ADDRESS: Address =
  "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";

// ── Known tokens (mainnet addresses, used as presets for reference) ─────
export const TOKEN_PRESETS: readonly {
  readonly address: string;
  readonly symbol: string;
  readonly decimals: number;
  readonly name: string;
}[] = [
  {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    symbol: "ETH",
    decimals: 18,
    name: "Ether (Native)",
  },
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    decimals: 6,
    name: "USD Coin",
  },
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    decimals: 6,
    name: "Tether USD",
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    symbol: "WBTC",
    decimals: 8,
    name: "Wrapped BTC",
  },
  {
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    symbol: "DAI",
    decimals: 18,
    name: "Dai Stablecoin",
  },
  {
    address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    symbol: "WETH",
    decimals: 18,
    name: "Wrapped Ether",
  },
];

export const FEE_TIERS: readonly {
  readonly fee: number;
  readonly tickSpacing: number;
  readonly label: string;
}[] = [
  { fee: 100, tickSpacing: 1, label: "0.01%" },
  { fee: 500, tickSpacing: 10, label: "0.05%" },
  { fee: 3000, tickSpacing: 60, label: "0.30%" },
  { fee: 10000, tickSpacing: 200, label: "1.00%" },
  { fee: 0, tickSpacing: 0, label: "Dynamic" },
];

export const TICK_SPACINGS: readonly number[] = [1, 10, 60, 200, 1000];
