// Token display metadata — intentionally inline, no imports
export interface TokenInfo {
  symbol: string;
  name: string;
  address: `0x${string}`;
  decimals: number;
  logo?: string;
  wrappedAddress?: `0x${string}`;
}

export const TOKENS: TokenInfo[] = [
  {
    symbol: "ETH",
    name: "Ether",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
    wrappedAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    decimals: 6,
    logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg",
  },
  {
    symbol: "DAI",
    name: "Dai Stablecoin",
    address: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    decimals: 18,
    logo: "https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.svg",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    decimals: 6,
    logo: "https://cryptologos.cc/logos/tether-usdt-logo.svg",
  },
  {
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    decimals: 8,
    logo: "https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.svg",
  },
  {
    symbol: "UNI",
    name: "Uniswap",
    address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    decimals: 18,
    logo: "https://cryptologos.cc/logos/uniswap-uni-logo.svg",
  },
];

export const FEE_AMOUNTS = {
  LOWEST: 100,
  LOW: 500,
  MEDIUM: 3000,
  HIGH: 10000,
} as const;

export const FEE_TIERS = [
  { value: FEE_AMOUNTS.LOWEST, label: "0.01%", description: "Stable pairs" },
  { value: FEE_AMOUNTS.LOW, label: "0.05%", description: "Recommended" },
  { value: FEE_AMOUNTS.MEDIUM, label: "0.30%", description: "Standard" },
  { value: FEE_AMOUNTS.HIGH, label: "1.00%", description: "Exotic pairs" },
] as const;

export const DEFAULT_FEE = FEE_AMOUNTS.MEDIUM;

export function getTickSpacing(fee: number): number {
  if (fee === 100) return 1;
  if (fee === 500) return 10;
  if (fee === 3000) return 60;
  if (fee === 10000) return 200;
  return 60;
}

export const EMPTY_HOOK = "0x0000000000000000000000000000000000000000" as const;
export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000" as const;
export const V4_POOL_MANAGER_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
export const DEFAULT_RPC_URL = "https://eth.llamarpc.com";
export const CHAIN_ID = 1;
