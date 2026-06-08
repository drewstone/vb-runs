import { useCallback, useState } from "react";
import { useAccount, useChainId, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, formatEther, decodeEventLog, type Address, type Log, type Hex } from "viem";
import { Actions, V4Planner } from "@uniswap/v4-sdk";
import { RoutePlanner, CommandType } from "@uniswap/universal-router-sdk";

const DEFAULT_SLIPPAGE_BPS = 50n;
const DEFAULT_DEADLINE_S = 1800;
const UNIVERSAL_ROUTER_ADDRESS: Address = "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD";

const SWAP_EVENT_ABI = {
  anonymous: false,
  inputs: [
    { indexed: true, name: "id", type: "bytes32" },
    { indexed: false, name: "sender", type: "address" },
    { indexed: false, name: "amount0", type: "int128" },
    { indexed: false, name: "amount1", type: "int128" },
    { indexed: false, name: "sqrtPriceX96", type: "uint160" },
    { indexed: false, name: "liquidity", type: "uint128" },
    { indexed: false, name: "tick", type: "int24" },
    { indexed: false, name: "fee", type: "uint24" },
  ],
  name: "Swap",
  type: "event",
} as const;

export interface SwapQuote {
  amountIn: bigint;
  amountOut: bigint;
  amountOutMinimum: bigint;
  priceImpact: number;
}

export interface BalanceDelta {
  amount0: bigint;
  amount1: bigint;
}

export interface TxRecord {
  hash: `0x${string}`;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  realizedSlippage: number | null;
  gasUsed: string | null;
  effectiveGasPrice: string | null;
  timestamp: number;
  status: "pending" | "confirmed" | "failed";
}

export interface UseSwapReturn {
  error: string | null;
  isSwapping: boolean;
  txHash: `0x${string}` | null;
  isConfirmed: boolean;
  receiptData: {
    gasUsed: string | null;
    effectiveGasPrice: string | null;
    blockNumber: number | null;
  } | null;
  quote: SwapQuote | null;
  balanceDelta: BalanceDelta | null;
  executedPrice: string | null;
  realizedSlippage: number | null;
  txHistory: TxRecord[];
  computeQuote: (tokenIn: string, tokenOut: string, amount: string) => void;
  executeSwap: (
    tokenIn: string,
    tokenOut: string,
    amount: string,
    slippageBps: bigint,
  ) => Promise<void>;
  clearResult: () => void;
}

function decodeBalanceDeltaFromLogs(logs: Log[]): BalanceDelta | null {
  for (const log of logs) {
    try {
      const topics = log.topics as [Hex, ...Hex[]];
      const data = log.data as Hex;
      const decoded = decodeEventLog({
        abi: [SWAP_EVENT_ABI],
        topics,
        data,
      });
      if (decoded && decoded.eventName === "Swap") {
        const args = decoded.args as unknown as { amount0: bigint; amount1: bigint };
        return {
          amount0: BigInt(args.amount0),
          amount1: BigInt(args.amount1),
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

export function useSwap(): UseSwapReturn {
  const { address } = useAccount();
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();

  const [error, setError] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [balanceDelta, setBalanceDelta] = useState<BalanceDelta | null>(null);
  const [executedPrice, setExecutedPrice] = useState<string | null>(null);
  const [realizedSlippage, setRealizedSlippage] = useState<number | null>(null);
  const [receiptData, setReceiptData] = useState<{
    gasUsed: string | null;
    effectiveGasPrice: string | null;
    blockNumber: number | null;
  } | null>(null);
  const [txHistory, setTxHistory] = useState<TxRecord[]>([]);

  const { data: receipt, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash ?? undefined,
  });

  const computeQuote = useCallback((_tokenIn: string, _tokenOut: string, amount: string) => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }
    const amountIn = parseEther(amount);
    const fee = 3000n;
    const amountOut = (amountIn * (10000n - fee)) / 10000n;
    const amountOutMinimum = (amountOut * (10000n - DEFAULT_SLIPPAGE_BPS)) / 10000n;
    setQuote({ amountIn, amountOut, amountOutMinimum, priceImpact: 0.3 });
  }, []);

  const computeRealizedSlippageFn = useCallback((quoted: bigint, actual: bigint): number => {
    if (quoted === 0n) return 0;
    return Math.max(0, Number((quoted - actual) * 10000n / quoted) / 100);
  }, []);

  const executeSwap = useCallback(
    async (
      tokenIn: string,
      _tokenOut: string,
      amount: string,
      slippageBps: bigint,
    ) => {
      if (!address) {
        setError("Wallet not connected");
        return;
      }

      try {
        setIsSwapping(true);
        setError(null);

        const amountIn = parseEther(amount);
        const amountOutMinimum = quote
          ? (quote.amountOut * (10000n - slippageBps)) / 10000n
          : (amountIn * 9500n) / 10000n;
        const deadlineUnix = BigInt(Math.floor(Date.now() / 1000) + DEFAULT_DEADLINE_S);

        const poolKey = {
          currency0: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address,
          currency1: "0x0000000000000000000000000000000000000000" as Address,
          fee: 3000,
          tickSpacing: 60,
          hooks: "0x0000000000000000000000000000000000000000" as Address,
        };

        const v4p = new V4Planner();
        v4p.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
          {
            poolKey,
            zeroForOne: true,
            amountIn: amountIn.toString(),
            amountOutMinimum: amountOutMinimum.toString(),
            hookData: "0x",
          },
        ]);
        const v4Calldata = v4p.finalize();

        const rp = new RoutePlanner();
        rp.addCommand(CommandType.V4_SWAP, [v4Calldata]);

        const hash = await writeContractAsync({
          address: UNIVERSAL_ROUTER_ADDRESS,
          abi: [
            {
              type: "function",
              name: "execute",
              inputs: [
                { name: "commands", type: "bytes" },
                { name: "inputs", type: "bytes[]" },
                { name: "deadline", type: "uint256" },
              ],
              outputs: [],
              stateMutability: "payable",
            },
          ],
          functionName: "execute",
          args: [rp.commands, rp.inputs, deadlineUnix] as [Address, Address[], bigint],
          value: tokenIn === "ETH" ? amountIn : 0n,
        });

        setTxHash(hash);

        setTxHistory((prev) => [
          {
            hash,
            tokenIn,
            tokenOut: _tokenOut,
            amountIn: amount,
            amountOut: formatEther(amountOutMinimum),
            realizedSlippage: null,
            gasUsed: null,
            effectiveGasPrice: null,
            timestamp: Date.now(),
            status: "pending",
          },
          ...prev,
        ]);

        setIsSwapping(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Swap failed");
        setIsSwapping(false);
      }
    },
    [address, chainId, quote, writeContractAsync],
  );

  const clearResult = useCallback(() => {
    setBalanceDelta(null);
    setExecutedPrice(null);
    setRealizedSlippage(null);
    setTxHash(null);
    setError(null);
    setReceiptData(null);
  }, []);

  if (receipt && txHistory.length > 0 && txHistory[0]?.status === "pending") {
    const delta = decodeBalanceDeltaFromLogs(receipt.logs as Log[]);
    if (delta) {
      if (delta.amount0 !== 0n || delta.amount1 !== 0n) {
        setBalanceDelta(delta);
        const absOut = delta.amount1 < 0n ? -delta.amount1 : delta.amount0;
        const absIn = delta.amount0 > 0n ? delta.amount0 : delta.amount1;
        if (absOut > 0n) {
          const slip = computeRealizedSlippageFn(
            quote?.amountOut ?? absOut,
            absOut,
          );
          setRealizedSlippage(slip);
          setExecutedPrice(
            (Number(absOut) / Number(absIn)).toFixed(6),
          );
        }
      }
    }

    const gasUsed = receipt.gasUsed ? receipt.gasUsed.toString() : null;
    const effectiveGasPrice = receipt.effectiveGasPrice ? receipt.effectiveGasPrice.toString() : null;
    const blockNumber = receipt.blockNumber ? Number(receipt.blockNumber) : null;

    if (gasUsed || effectiveGasPrice) {
      setReceiptData({ gasUsed, effectiveGasPrice, blockNumber });
    }

    setTxHistory((prev) => {
      const updated = [...prev];
      if (updated.length > 0) {
        updated[0] = {
          ...updated[0],
          status: receipt.status === "success" ? "confirmed" : "failed",
          realizedSlippage,
          gasUsed,
          effectiveGasPrice,
        };
      }
      return updated;
    });
  }

  return {
    error,
    isSwapping,
    txHash,
    isConfirmed,
    receiptData,
    quote,
    balanceDelta,
    executedPrice,
    realizedSlippage,
    txHistory,
    computeQuote,
    executeSwap,
    clearResult,
  };
}
