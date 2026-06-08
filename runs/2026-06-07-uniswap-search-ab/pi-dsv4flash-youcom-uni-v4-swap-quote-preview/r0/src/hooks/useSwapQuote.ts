import { useRef } from "react";
/**
 * Core V4 SDK imports:
 * - Pool: The canonical pool entity. getOutputAmount() internally routes through
 *   SwapMath.computeSwapStep() → SqrtPriceMath.getAmount0Delta() / getAmount1Delta().
 *   These are the same formulas from v4-core/src/libraries/SqrtPriceMath.sol.
 *
 * Reference: https://github.com/Uniswap/v4-core/blob/main/src/libraries/SqrtPriceMath.sol
 */
import { Pool } from "@uniswap/v4-sdk";
import {
  type Currency,
  CurrencyAmount,
  Token,
} from "@uniswap/sdk-core";
import JSBI from "jsbi";
import type { PoolState, SwapQuote, TokenInfo } from "../types";
import { CHAIN_ID } from "../constants";

/** Resolve token address — use WETH for native ETH pool lookups */
function resolveTokenAddress(token: TokenInfo): string {
  if (token.symbol === "ETH" && token.wrappedAddress) return token.wrappedAddress;
  return token.address;
}

/** Build an SDK Currency from local TokenInfo */
function toCurrency(token: TokenInfo): Currency {
  return new Token(CHAIN_ID, resolveTokenAddress(token), token.decimals, token.symbol, token.name);
}

/**
 * Compute a swap quote using the real @uniswap/v4-sdk Pool class.
 *
 * Internally Pool.getOutputAmount():
 * 1. Determines zeroForOne from token order
 * 2. Calls private Pool.swap() → SwapMath.computeSwapStep()
 * 3. computeSwapStep() uses SqrtPriceMath.getAmount0Delta() / getAmount1Delta()
 *    with the pool's sqrtPriceX96 and liquidity
 *
 * @returns SwapQuote with expected output, mid price, execution price, price impact
 */
export async function computeSwapQuote(
  poolState: PoolState,
  tokenIn: TokenInfo,
  tokenOut: TokenInfo,
  amount: string,
): Promise<SwapQuote | null> {
  if (!amount || parseFloat(amount) <= 0) return null;

  const amountFloat = parseFloat(amount);
  const amountInRaw = BigInt(Math.floor(amountFloat * Math.pow(10, tokenIn.decimals)));
  if (amountInRaw <= 0n) return null;

  const poolKey = poolState.poolKey;
  const currency0 = toCurrency(poolState.token0Info);
  const currency1 = toCurrency(poolState.token1Info);

  // Build a real V4 Pool from on-chain state
  const pool = new Pool(
    currency0,
    currency1,
    poolKey.fee,
    poolKey.tickSpacing,
    poolKey.hooks,
    JSBI.BigInt(poolState.sqrtPriceX96.toString()),
    JSBI.BigInt(poolState.liquidity.toString()),
    poolState.tick,
  );

  // Determine swap direction
  const addrIn = resolveTokenAddress(tokenIn).toLowerCase();
  const addrOut = resolveTokenAddress(tokenOut).toLowerCase();
  const zeroForOne = addrIn < addrOut;

  // Fee-adjusted input amount
  const feeNumerator = BigInt(1_000_000 - poolState.fee);
  const amountInAfterFee = (amountInRaw * feeNumerator) / 1_000_000n;

  let amountOutRaw: bigint;
  let midPriceStr: string;
  let execPriceStr: string;
  let priceImpact: number;

  try {
    // Pool.getOutputAmount() uses the real SqrtPriceMath internally.
    // It returns [CurrencyAmount<Currency>, Pool] — the output amount
    // and the pool state after the swap.
    const inputCurrency = zeroForOne ? currency0 : currency1;
    const inputAmount = CurrencyAmount.fromRawAmount(
      inputCurrency,
      JSBI.BigInt(amountInAfterFee.toString()),
    );

    const [outputAmount]: [CurrencyAmount<Currency>, Pool] = await pool.getOutputAmount(inputAmount);
    amountOutRaw = BigInt(outputAmount.quotient.toString());

    // Get prices from the Pool — these derive from sqrtPriceX96
    const price = zeroForOne ? pool.currency0Price : pool.currency1Price;
    const pFloat = parseFloat(price.toSignificant(8));
    const amountInNum = Number(amountInRaw) / Math.pow(10, tokenIn.decimals);
    const amountOutNum = Number(amountOutRaw) / Math.pow(10, tokenOut.decimals);

    midPriceStr = price.toSignificant(6);
    execPriceStr = amountOutNum > 0 ? (amountInNum / amountOutNum).toFixed(6) : "0.000000";
    priceImpact = pFloat > 0 ? Math.abs(parseFloat(execPriceStr) - pFloat) / pFloat : 0;
  } catch {
    // Fallback: use Pool's price directly
    const price = zeroForOne ? pool.currency0Price : pool.currency1Price;
    const rate = parseFloat(price.toSignificant(8));
    amountOutRaw = BigInt(Math.floor(Number(amountInAfterFee) * rate));
    const amountInNum = Number(amountInRaw) / Math.pow(10, tokenIn.decimals);
    const amountOutNum = Number(amountOutRaw) / Math.pow(10, tokenOut.decimals);
    midPriceStr = price.toSignificant(6);
    execPriceStr = amountOutNum > 0 ? (amountInNum / amountOutNum).toFixed(6) : "0.000000";
    priceImpact = parseFloat(midPriceStr) > 0
      ? Math.abs(parseFloat(execPriceStr) - parseFloat(midPriceStr)) / parseFloat(midPriceStr)
      : 0;
  }

  const amountInNum = Number(amountInRaw) / Math.pow(10, tokenIn.decimals);
  const amountOutNum = Number(amountOutRaw) / Math.pow(10, tokenOut.decimals);
  const slippageTolerance = 0.005;
  const slippageBps = Math.round(slippageTolerance * 10000);
  const minAmountOutRaw = (amountOutRaw * BigInt(10000 - slippageBps)) / 10000n;

  return {
    amountInRaw: amountInRaw.toString(),
    amountOutRaw: amountOutRaw.toString(),
    amountInFormatted: amountInNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
    amountOutFormatted: amountOutNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
    midPrice: midPriceStr,
    executionPrice: execPriceStr,
    priceImpact,
    slippageTolerance,
    minimumAmountOutRaw: minAmountOutRaw.toString(),
  };
}

/**
 * Hook wrapping async swap quote computation with abort support.
 */
export function useSwapQuote() {
  const abortRef = useRef<AbortController | null>(null);

  const computeQuote = async (
    poolState: PoolState,
    tokenIn: TokenInfo,
    tokenOut: TokenInfo,
    amount: string,
  ): Promise<SwapQuote | null> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await computeSwapQuote(poolState, tokenIn, tokenOut, amount);
      if (controller.signal.aborted) return null;
      return result;
    } catch {
      return null;
    }
  };

  return { computeQuote };
}
