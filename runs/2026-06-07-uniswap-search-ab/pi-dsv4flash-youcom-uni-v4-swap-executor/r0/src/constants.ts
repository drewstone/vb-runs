import type { Address } from "viem";

export const TOKENS: Record<string, { symbol: string; name: string; address: Address; decimals: number }> = {
  ETH: { symbol: "ETH", name: "Ether", address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as Address, decimals: 18 },
  USDC: { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as Address, decimals: 6 },
  DAI: { symbol: "DAI", name: "Dai Stablecoin", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" as Address, decimals: 18 },
  WETH: { symbol: "WETH", name: "Wrapped Ether", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address, decimals: 18 },
};
