import { useState } from 'react'
import type { Token, SwapPath } from '../types'

interface FlowVisualizationProps {
  tokenIn: Token | null
  tokenOut: Token | null
  amountIn: string
  path: SwapPath
}

interface FlowStep {
  title: string
  description: string
  code?: string
  isActive: boolean
}

export default function FlowVisualization({ tokenIn, tokenOut, amountIn, path }: FlowVisualizationProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null)

  const steps: FlowStep[] = [
    {
      title: '1. Encode Command',
      description: 'Encode Commands.V4_SWAP with action type',
      code: `// Command: V4_SWAP (0x10)
// Action: SWAP_EXACT_IN_SINGLE (0x06)
bytes memory command = abi.encodePacked(
  uint8(Commands.V4_SWAP)
);`,
      isActive: true
    },
    {
      title: '2. Build Swap Input',
      description: 'Encode the swap parameters for V4Router',
      code: path.steps.length === 1
        ? `// Single pool swap
IV4Router.ExactInputSingleParams memory params = 
  IV4Router.ExactInputSingleParams({
    poolKey: PoolKey({
      currency0: ${tokenIn?.address.slice(0, 10)}...,
      currency1: ${tokenOut?.address.slice(0, 10)}...,
      fee: ${path.steps[0]?.poolKey.fee || 0},
      tickSpacing: ${path.steps[0]?.poolKey.tickSpacing || 0},
      hooks: address(0)
    }),
    zeroForOne: ${path.steps[0]?.zeroForOne || true},
    amountIn: ${amountIn || '0'},
    amountOutMinimum: <computed>,
    sqrtPriceLimitX96: 0,
    hookData: ""
  });`
        : `// Multi-hop swap
IV4Router.ExactInputParams memory params = 
  IV4Router.ExactInputParams({
    path: encodedPath,
    amountIn: ${amountIn || '0'},
    amountOutMinimum: <computed>,
    hookData: ""
  });`,
      isActive: true
    },
    {
      title: '3. V4Router._swapExactInputSingle',
      description: 'Router validates and executes the swap',
      code: `function _swapExactInputSingle(
  ExactInputSingleParams calldata params
) internal returns (BalanceDelta delta) {
  // Validate pool exists
  PoolId poolId = params.poolKey.toId();
  
  // Perform the swap on PoolManager
  delta = poolManager.swap(
    params.poolKey,
    IPoolManager.SwapParams({
      zeroForOne: params.zeroForOne,
      amountSpecified: -int256(params.amountIn),
      sqrtPriceLimitX96: params.sqrtPriceLimitX96
    }),
    params.hookData
  );
  
  // Settle/take currencies
  _settle(params.poolKey.currency0, params.amountIn);
  _take(params.poolKey.currency1, uint256(-delta.amount1()));
}`,
      isActive: true
    },
    {
      title: '4. PoolManager.swap()',
      description: 'Core swap execution updates pool state',
      code: `function swap(
  PoolKey memory key,
  SwapParams memory params,
  bytes calldata hookData
) external returns (BalanceDelta) {
  // 1. Verify pool initialization
  // 2. Update slot0 (sqrtPriceX96, tick)
  // 3. Compute swap step (amountIn/Out, fee)
  // 4. Update liquidity if crossing initialized ticks
  // 5. Return BalanceDelta (amount0, amount1)
}`,
      isActive: true
    },
    {
      title: '5. Decode BalanceDelta',
      description: 'Extract token amounts from swap result',
      code: `// BalanceDelta is int128 packed:
// upper 128 bits: amount0 (negative = pool owes user)
// lower 128 bits: amount1 (positive = user owes pool)

int128 amount0 = delta.amount0(); // ${path.steps[0]?.zeroForOne ? '-' : '+'}${amountIn || '0'}
int128 amount1 = delta.amount1(); // ${path.steps[0]?.zeroForOne ? '+' : '-'}${amountIn || '0'}

// For exact input:
// amount0 ≈ -amountIn (small rounding)
// amount1 = amountOut (positive, what user receives)`,
      isActive: true
    },
    {
      title: '6. UniversalRouter.execute()',
      description: 'Execute all commands atomically',
      code: `function execute(
  bytes calldata commands,
  bytes[] calldata inputs,
  uint256 deadline
) external payable {
  require(block.timestamp <= deadline, "Expired");
  
  for (uint256 i = 0; i < commands.length; i++) {
    // Decode and execute each command
    _executeCommand(commands[i], inputs[i]);
  }
}`,
      isActive: true
    }
  ]

  return (
    <div className="card p-6">
      <h2 className="text-lg font-bold text-defi-text mb-4">V4Router Flow</h2>
      
      <div className="space-y-3">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`rounded-lg border transition-all overflow-hidden ${
              step.isActive
                ? 'border-defi-accent/30 bg-defi-accent/5'
                : 'border-defi-border bg-defi-card'
            }`}
          >
            <button
              type="button"
              onClick={() => setExpandedStep(expandedStep === index ? null : index)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <div>
                <div className="font-semibold text-defi-text text-sm">{step.title}</div>
                <div className="text-xs text-defi-textSecondary mt-0.5">{step.description}</div>
              </div>
              <svg
                className={`w-4 h-4 text-defi-textSecondary transition-transform ${
                  expandedStep === index ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {expandedStep === index && step.code && (
              <div className="px-4 pb-3">
                <pre className="bg-defi-bg rounded-lg p-3 overflow-x-auto">
                  <code className="text-xs font-mono text-defi-text">{step.code}</code>
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
