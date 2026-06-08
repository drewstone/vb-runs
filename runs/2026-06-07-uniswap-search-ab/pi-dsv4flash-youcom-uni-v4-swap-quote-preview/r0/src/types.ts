import type { TokenInfo } from "./constants";

export type { TokenInfo };

export interface PoolKey {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: number;
  hooks: string;
}

export interface PoolState {
  poolKey: PoolKey;
  sqrtPriceX96: bigint;
  liquidity: bigint;
  tick: number;
  fee: number;
  token0Info: TokenInfo;
  token1Info: TokenInfo;
}

export interface SwapQuote {
  amountInRaw: string;
  amountOutRaw: string;
  amountInFormatted: string;
  amountOutFormatted: string;
  midPrice: string;
  executionPrice: string;
  priceImpact: number;
  slippageTolerance: number;
  minimumAmountOutRaw: string;
  error?: string;
}
