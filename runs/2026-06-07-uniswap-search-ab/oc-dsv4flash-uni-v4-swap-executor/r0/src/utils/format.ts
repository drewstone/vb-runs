export function formatTokenAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount)
  if (isNaN(num)) return '0.0'
  if (num === 0) return '0.0'
  if (num < 0.0001) return num.toExponential(2)
  if (num < 1) return num.toPrecision(4)
  if (num < 1000) return num.toFixed(4)
  if (num < 1000000) return num.toFixed(2)
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export function formatUSD(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`
  return `$${value.toFixed(2)}`
}

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

export function formatSlippage(percent: number): string {
  const sign = percent >= 0 ? '+' : ''
  return `${sign}${percent.toFixed(4)}%`
}

export function formatDeadline(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
