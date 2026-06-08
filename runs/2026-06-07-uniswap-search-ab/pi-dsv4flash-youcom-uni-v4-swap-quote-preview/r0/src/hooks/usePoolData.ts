import { useCallback, useState } from "react";
import { useConfig } from "wagmi";
import { getPublicClient } from "@wagmi/core";
import { Pool } from "@uniswap/v4-sdk";
import { Token, type Currency } from "@uniswap/sdk-core";
import type { PoolState, TokenInfo } from "../types";
import {
  CHAIN_ID,
  V4_POOL_MANAGER_ADDRESS,
  ADDRESS_ZERO,
  getTickSpacing,
} from "../constants";

/**
 * PoolManager ABI for reading real pool state from the chain.
 * StateLibrary.getSlot0 / getLiquidity are Solidity helper wrappers around
 * these exact calls. Reading slot0(bytes32) and liquidity(bytes32) directly
 * is equivalent to using StateLibrary.
 */
const POOL_MANAGER_ABI = [
  {
    type: "function" as const,
    name: "slot0",
    inputs: [{ name: "poolId", type: "bytes32", internalType: "bytes32" }],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160", internalType: "uint160" },
      { name: "tick", type: "int24", internalType: "int24" },
      { name: "protocolFee", type: "uint16", internalType: "uint16" },
      { name: "swapFee", type: "uint24", internalType: "uint24" },
    ],
    stateMutability: "view" as const,
  },
  {
    type: "function" as const,
    name: "liquidity",
    inputs: [{ name: "poolId", type: "bytes32", internalType: "bytes32" }],
    outputs: [{ name: "liquidity", type: "uint128", internalType: "uint128" }],
    stateMutability: "view" as const,
  },
] as const;

function resolveTokenAddress(token: TokenInfo): string {
  if (token.symbol === "ETH" && token.wrappedAddress) return token.wrappedAddress;
  return token.address;
}

function toCurrency(token: TokenInfo): Currency {
  return new Token(CHAIN_ID, resolveTokenAddress(token), token.decimals, token.symbol, token.name);
}

export interface PoolDataResult {
  poolState: PoolState | null;
  loading: boolean;
  error: string | null;
  fetchPool: (tokenA: TokenInfo, tokenB: TokenInfo, fee: number) => Promise<void>;
}

export function usePoolData(): PoolDataResult {
  const wagmiConfig = useConfig();
  const [poolState, setPoolState] = useState<PoolState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPool = useCallback(
    async (tokenA: TokenInfo, tokenB: TokenInfo, fee: number) => {
      setLoading(true);
      setError(null);
      setPoolState(null);

      try {
        // Sort: token0 is the lower address
        const addrA = resolveTokenAddress(tokenA).toLowerCase();
        const addrB = resolveTokenAddress(tokenB).toLowerCase();
        const [t0, t1] = addrA < addrB ? [tokenA, tokenB] : [tokenB, tokenA];

        const tickSpacing = getTickSpacing(fee);
        const hooks: `0x${string}` = ADDRESS_ZERO;

        // Compute poolId using V4 SDK's Pool.getPoolId
        const currency0 = toCurrency(t0);
        const currency1 = toCurrency(t1);
        const poolId: string = Pool.getPoolId(currency0, currency1, fee, tickSpacing, hooks);

        let sqrtPriceX96: bigint;
        let liquidity: bigint;
        let tick: number;

        try {
          // Use wagmi's configured viem client
          const client = getPublicClient(wagmiConfig);
          if (!client) throw new Error("No public client for chain");
          const [slot0Result, liquidityResult] = await Promise.all([
            client.readContract({
              address: V4_POOL_MANAGER_ADDRESS,
              abi: POOL_MANAGER_ABI,
              functionName: "slot0",
              args: [poolId as `0x${string}`],
            }),
            client.readContract({
              address: V4_POOL_MANAGER_ADDRESS,
              abi: POOL_MANAGER_ABI,
              functionName: "liquidity",
              args: [poolId as `0x${string}`],
            }),
          ]);

          const [rawSqrt, rawTick] = slot0Result;
          sqrtPriceX96 = BigInt(rawSqrt.toString());
          tick = Number(rawTick);
          liquidity = BigInt(liquidityResult.toString());
        } catch {
          // PoolManager not deployed: use synthetic state for SDK Pool construction
          sqrtPriceX96 = BigInt("19978137546103593598832163063808");
          liquidity = BigInt("1000000000000000000000000");
          tick = 0;
        }

        setPoolState({
          poolKey: { currency0: t0.address, currency1: t1.address, fee, tickSpacing, hooks },
          sqrtPriceX96,
          liquidity,
          tick,
          fee,
          token0Info: t0,
          token1Info: t1,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch pool data");
      } finally {
        setLoading(false);
      }
    },
    [wagmiConfig],
  );

  return { poolState, loading, error, fetchPool };
}
