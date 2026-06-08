import type { FC } from "react";
import type { BalanceDelta } from "../hooks/useSwap";

interface Props {
  delta: BalanceDelta;
  executedPrice: string | null;
  realizedSlippage: number | null;
  tokenIn: string;
  tokenOut: string;
  isConfirmed: boolean;
  receiptData: {
    gasUsed: string | null;
    effectiveGasPrice: string | null;
    blockNumber: number | null;
  } | null;
}

function toHuman(val: bigint, decimals: number): string {
  return (Number(val < 0n ? -val : val) / 10 ** decimals).toFixed(6);
}

const BalanceDeltaDisplay: FC<Props> = ({
  delta,
  executedPrice,
  realizedSlippage,
  tokenIn,
  tokenOut,
  isConfirmed,
  receiptData,
}) => {
  const d0 = toHuman(delta.amount0, 18);
  const d1 = toHuman(delta.amount1, 18);

  const meaning0 = delta.amount0 > 0n
    ? `User paid ${d0} ${tokenIn}`
    : delta.amount0 < 0n
      ? `User received ${d0} ${tokenIn}`
      : "Pending";

  const meaning1 = delta.amount1 > 0n
    ? `User paid ${d1} ${tokenOut}`
    : delta.amount1 < 0n
      ? `User received ${d1} ${tokenOut}`
      : "Pending";

  const amountIn = delta.amount0 > 0n ? delta.amount0 : delta.amount1;
  const amountOut = delta.amount1 < 0n ? -delta.amount1 : delta.amount0;
  const effectivePrice = amountIn > 0n && amountOut > 0n
    ? (Number(amountOut) / Number(amountIn)).toFixed(6)
    : null;

  return (
    <div className={`balance-delta ${isConfirmed ? "confirmed" : "pending"}`}>
      <div className="delta-header">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span>Swap Result</span>
        {isConfirmed && <span className="delta-badge confirmed">Confirmed</span>}
      </div>

      <div className="delta-body">
        <div className="delta-row">
          <span className="delta-label">Amount In</span>
          <code className="delta-value">{delta.amount0.toString()}</code>
          <span className="delta-meaning">{meaning0}</span>
        </div>
        <div className="delta-row">
          <span className="delta-label">Amount Out</span>
          <code className="delta-value">{delta.amount1.toString()}</code>
          <span className="delta-meaning">{meaning1}</span>
        </div>

        {effectivePrice && (
          <div className="delta-row">
            <span className="delta-label">Executed Price</span>
            <span className="delta-value">{effectivePrice} {tokenOut}/{tokenIn}</span>
          </div>
        )}

        {executedPrice && effectivePrice && (
          <div className="delta-row">
            <span className="delta-label">Price vs Quote</span>
            <span className="delta-value">
              {executedPrice} vs {effectivePrice}
            </span>
          </div>
        )}

        {receiptData && (
          <>
            <div className="delta-row">
              <span className="delta-label">Gas Used</span>
              <span className="delta-value">
                {receiptData.gasUsed ? `${(Number(receiptData.gasUsed) / 1e6).toFixed(2)}M` : "-"}
              </span>
            </div>
            <div className="delta-row">
              <span className="delta-label">Gas Price</span>
              <span className="delta-value">
                {receiptData.effectiveGasPrice
                  ? `${(Number(receiptData.effectiveGasPrice) / 1e9).toFixed(2)} gwei`
                  : "-"}
              </span>
            </div>
            {receiptData.blockNumber && (
              <div className="delta-row">
                <span className="delta-label">Block</span>
                <span className="delta-value">#{receiptData.blockNumber}</span>
              </div>
            )}
          </>
        )}

        <div className="delta-row raw">
          <span className="delta-label">Raw bytes32</span>
          <code className="delta-value small">
            0x{delta.amount0.toString(16).padStart(32, "0")}
            {delta.amount1.toString(16).padStart(32, "0")}
          </code>
        </div>
      </div>

      {realizedSlippage !== null && (
        <div className={`delta-slippage ${realizedSlippage > 0.5 ? "high" : realizedSlippage > 0.1 ? "medium" : "low"}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="20" x2="12" y2="10" />
            <line x1="12" y1="4" x2="12" y2="4" />
          </svg>
          <div className="slippage-info">
            <span className="slippage-label">Realized Slippage</span>
            <span className="slippage-value">{realizedSlippage.toFixed(3)}%</span>
          </div>
          {realizedSlippage > 0.5 && (
            <span className="slippage-warning">High slippage — consider increasing max slippage</span>
          )}
        </div>
      )}

      {receiptData && (
        <div className="delta-receipt">
          <span className="receipt-label">Total tx cost</span>
          <span className="receipt-value">
            {receiptData.gasUsed && receiptData.effectiveGasPrice
              ? `${(Number(receiptData.gasUsed) * Number(receiptData.effectiveGasPrice) / 1e18).toFixed(6)} ETH`
              : "-"}
          </span>
        </div>
      )}
    </div>
  );
};

export default BalanceDeltaDisplay;
