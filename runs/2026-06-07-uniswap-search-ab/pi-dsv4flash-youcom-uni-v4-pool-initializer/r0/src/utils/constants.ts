/** Standard Uniswap V4 fee tiers (in hundredths of a basis point — i.e. 500 = 0.05%) */
export const FEE_TIERS = [
  { label: "0.01%", value: 100, tickSpacing: 1 },
  { label: "0.05%", value: 500, tickSpacing: 10 },
  { label: "0.30%", value: 3_000, tickSpacing: 60 },
  { label: "1.00%", value: 10_000, tickSpacing: 200 },
] as const;

export const Q96 = 2n ** 96n;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Default token examples the user can pick (mainnet addresses) */
export const TOKEN_PRESETS = [
  { symbol: "USDC", name: "USD Coin", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
  { symbol: "USDT", name: "Tether USD", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
  { symbol: "DAI", name: "Dai Stablecoin", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  { symbol: "WETH", name: "Wrapped Ether", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
  { symbol: "WBTC", name: "Wrapped Bitcoin", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
  { symbol: "LINK", name: "Chainlink", address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", decimals: 18 },
  { symbol: "UNI", name: "Uniswap", address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", decimals: 18 },
  { symbol: "AAVE", name: "Aave", address: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", decimals: 18 },
] as const;

export const DEFAULT_SQRT_PRICE = "79228162514264337593543950336"; // ~ 1:1 price for 18-decimals

export const POOL_MANAGER_ADDRESS = "0x0000000000000044Ec3aB292D22f61c37bA8b7F" as const;
