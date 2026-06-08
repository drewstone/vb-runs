import { useState } from 'react'
import { DEFAULT_POOL_KEYS, type PoolKey, type SwapPath, type Token } from '../types'

interface PathConfigProps {
  tokenIn: Token | null
  tokenOut: Token | null
  path: SwapPath
  onPathChange: (path: SwapPath) => void
}

export default function PathConfig({ tokenIn, tokenOut, path, onPathChange }: PathConfigProps) {
  const [useMultiHop, setUseMultiHop] = useState(false)
  const [intermediateToken, setIntermediateToken] = useState<Token | null>(null)

  const poolPairs = Object.entries(DEFAULT_POOL_KEYS)
  const selectedPoolKey = path.steps[0]?.poolKey || null

  const handlePoolSelect = (pairKey: string) => {
    const poolKey = DEFAULT_POOL_KEYS[pairKey]
    if (!poolKey) return

    const zeroForOne = poolKey.currency0.toLowerCase() === tokenIn?.address.toLowerCase()
    
    onPathChange({
      steps: [{
        poolKey,
        zeroForOne
      }]
    })
  }

  const handleMultiHopConfig = (intermediate: Token) => {
    setIntermediateToken(intermediate)
    
    if (!tokenIn || !tokenOut) return
    
    // Build multi-hop path: tokenIn -> intermediate -> tokenOut
    const poolKey1 = findPoolKey(tokenIn, intermediate)
    const poolKey2 = findPoolKey(intermediate, tokenOut)
    
    if (poolKey1 && poolKey2) {
      onPathChange({
        steps: [
          {
            poolKey: poolKey1,
            zeroForOne: poolKey1.currency0.toLowerCase() === tokenIn!.address.toLowerCase()
          },
          {
            poolKey: poolKey2,
            zeroForOne: poolKey2.currency0.toLowerCase() === intermediate.address.toLowerCase()
          }
        ]
      })
    }
  }

  const findPoolKey = (tokenA: Token, tokenB: Token): PoolKey | null => {
    for (const [, poolKey] of Object.entries(DEFAULT_POOL_KEYS)) {
      const currencies = [poolKey.currency0.toLowerCase(), poolKey.currency1.toLowerCase()]
      if (
        currencies.includes(tokenA.address.toLowerCase()) &&
        currencies.includes(tokenB.address.toLowerCase())
      ) {
        return poolKey
      }
    }
    return null
  }

  const getPoolPairKey = (tokenA?: Token, tokenB?: Token): string | null => {
    if (!tokenA || !tokenB) return null
    for (const [key, poolKey] of Object.entries(DEFAULT_POOL_KEYS)) {
      const currencies = [poolKey.currency0.toLowerCase(), poolKey.currency1.toLowerCase()]
      if (
        currencies.includes(tokenA.address.toLowerCase()) &&
        currencies.includes(tokenB.address.toLowerCase())
      ) {
        return key
      }
    }
    return null
  }

  const currentPair = getPoolPairKey(tokenIn || undefined, tokenOut || undefined)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-defi-textSecondary">Pool Configuration</h3>
        <button
          type="button"
          onClick={() => {
            setUseMultiHop(!useMultiHop)
            if (useMultiHop && currentPair) {
              handlePoolSelect(currentPair)
            }
          }}
          className={`text-xs px-3 py-1 rounded-full transition-colors ${
            useMultiHop
              ? 'bg-defi-accent text-white'
              : 'bg-defi-border text-defi-textSecondary hover:text-defi-text'
          }`}
        >
          {useMultiHop ? 'Multi-Hop' : 'Single Pool'}
        </button>
      </div>

      {!useMultiHop ? (
        <div className="space-y-2">
          {poolPairs.map(([key, poolKey]) => {
            const isRelevant = tokenIn && tokenOut && (
              [poolKey.currency0.toLowerCase(), poolKey.currency1.toLowerCase()].includes(tokenIn.address.toLowerCase()) &&
              [poolKey.currency0.toLowerCase(), poolKey.currency1.toLowerCase()].includes(tokenOut.address.toLowerCase())
            )
            
            if (tokenIn && tokenOut && !isRelevant) return null

            const isSelected = selectedPoolKey?.currency0 === poolKey.currency0 &&
                             selectedPoolKey?.currency1 === poolKey.currency1

            return (
              <button
                key={key}
                type="button"
                onClick={() => handlePoolSelect(key)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-defi-accent bg-defi-accent/10'
                    : 'border-defi-border hover:border-defi-accent/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-defi-text">{key}</span>
                  <span className="text-xs text-defi-textMuted">Fee: {poolKey.fee / 10000}%</span>
                </div>
                <div className="text-xs text-defi-textMuted mt-1">
                  Tick Spacing: {poolKey.tickSpacing} | Hooks: {poolKey.hooks.slice(0, 10)}...
                </div>
              </button>
            )
          })}
          
          {tokenIn && tokenOut && !currentPair && (
            <div className="p-3 rounded-lg border border-dashed border-defi-border text-center text-sm text-defi-textMuted">
              No direct pool available for {tokenIn.symbol}/{tokenOut.symbol}
              <br />
              Try enabling multi-hop routing
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-lg border border-defi-border">
            <div className="text-xs text-defi-textSecondary mb-2">Select Intermediate Token</div>
            <div className="flex gap-2">
              {[
                { address: '0xA0b86a33E6441e3D4e274B28E7C7D3C4C5a1B2c3', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
                { address: '0xB1c2d3E4F5a6B7C8D9E0F1A2B3C4D5E6F7A8B9C0', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 }
              ].map(token => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => handleMultiHopConfig(token)}
                  className={`flex-1 p-2 rounded-lg border text-center transition-all ${
                    intermediateToken?.address === token.address
                      ? 'border-defi-accent bg-defi-accent/10'
                      : 'border-defi-border hover:border-defi-accent/50'
                  }`}
                >
                  <div className="font-medium text-defi-text">{token.symbol}</div>
                </button>
              ))}
            </div>
          </div>

          {path.steps.length > 0 && (
            <div className="p-3 rounded-lg border border-defi-border bg-defi-bg/50">
              <div className="text-xs font-medium text-defi-textSecondary mb-2">Route</div>
              <div className="space-y-2">
                {path.steps.map((step, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-defi-accent/20 flex items-center justify-center text-xs text-defi-accent font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-defi-text">
                        {step.zeroForOne ? '0 → 1' : '1 → 0'}
                      </div>
                      <div className="text-xs text-defi-textMuted">
                        Fee: {step.poolKey.fee / 10000}% | Tick: {step.poolKey.tickSpacing}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
