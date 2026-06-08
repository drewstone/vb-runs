import type { FC } from "react";
import type { PoolKey, RouteType } from "../types";
import { TOKENS } from "../constants";

interface SwapPathProps {
  /** The swap pool(s) */
  poolKeys: PoolKey[];
  /** Route type */
  route: RouteType;
  /** Token in symbol */
  tokenIn: string;
  /** Token out symbol */
  tokenOut: string;
}

/**
 * Visualizes the swap path — single pool or multi-hop.
 * Shows the V4Router._swapExactInputSingle flow step by step.
 */
const SwapPath: FC<SwapPathProps> = ({ poolKeys, route, tokenIn, tokenOut }) => {
  if (poolKeys.length === 0) {
    return (
      <div className="swap-path empty">
        <span className="path-label">Swap Path</span>
        <span className="path-muted">Select a token pair to view the swap route</span>
      </div>
    );
  }

  const tokenInData = TOKENS[tokenIn];
  const tokenOutData = TOKENS[tokenOut];
  const inSymbol = tokenInData?.symbol ?? tokenIn;
  const outSymbol = tokenOutData?.symbol ?? tokenOut;

  const feePercent = (poolKeys[0]?.fee ?? 0) / 10000;
  const tickSpacing = poolKeys[0]?.tickSpacing ?? 0;

  return (
    <div className="swap-path">
      <div className="path-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="path-label">Swap Route</span>
        {route === "single" ? (
          <span className="path-badge single">Single Pool</span>
        ) : (
          <span className="path-badge multi">Multi-Hop</span>
        )}
      </div>

      <div className="path-visualization">
        {route === "single" ? (
          /* Single pool visualization */
          <div className="path-single">
            <TokenNode symbol={inSymbol} />
            <div className="pool-node">
              <div className="pool-arrow" />
              <div className="pool-info">
                <span className="pool-fee">{feePercent.toFixed(2)}%</span>
                <span className="pool-detail">tickSpacing={tickSpacing}</span>
              </div>
            </div>
            <TokenNode symbol={outSymbol} />
          </div>
        ) : (
          /* Multi-hop visualization */
          <div className="path-multi">
            {poolKeys.map((pk, i) => (
              <div key={i} className="path-hop">
                {i === 0 && <TokenNode symbol={inSymbol} />}
                <div className="pool-node">
                  <div className="pool-arrow" />
                  <div className="pool-info">
                    <span className="pool-fee">{(pk.fee / 10000).toFixed(2)}%</span>
                  </div>
                </div>
                <TokenNode symbol={i === poolKeys.length - 1 ? outSymbol : `Hop ${i + 1}`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* V4Router._swapExactInputSingle flow explanation */}
      {route === "single" && (
        <details className="swap-flow-details">
          <summary className="swap-flow-summary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
            V4Router._swapExactInputSingle — Internal Flow
          </summary>
          <div className="swap-flow-content">
            <ol className="swap-flow-steps">
              <li>
                <strong>PoolKey</strong> — Pool identified by{" "}
                <code>{poolKeys[0]?.currency0.slice(0, 10)}...</code> /{" "}
                <code>{poolKeys[0]?.currency1.slice(0, 10)}...</code>, fee={feePercent}%, tickSpacing={tickSpacing}
              </li>
              <li>
                <strong>zeroForOne</strong> — Determined from token order:{" "}
                {poolKeys[0]?.currency0.toLowerCase() < (poolKeys[0]?.currency1 ?? "").toLowerCase()
                  ? `${inSymbol} is currency0 → zeroForOne = true`
                  : `${inSymbol} is currency1 → zeroForOne = false`}
              </li>
              <li>
                <strong>pool.swap()</strong> — Calls V4 pool with SwapParams (amountSpecified, sqrtPriceLimitX96, hookData)
              </li>
              <li>
                <strong>BalanceDelta</strong> — Returns (int128 amount0, int128 amount1) indicating pool balance changes
              </li>
              <li>
                <strong>amountOutMinimum</strong> — Reverts if output &lt; quoted amount
              </li>
            </ol>
          </div>
        </details>
      )}
    </div>
  );
};

/** Small token pill for the path visualization */
const TokenNode: FC<{ symbol: string }> = ({ symbol }) => (
  <div className="token-node">
    <div className="token-node-icon">{symbol.slice(0, 2)}</div>
    <span className="token-node-label">{symbol}</span>
  </div>
);

export default SwapPath;
