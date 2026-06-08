import type { FC } from "react";
import type { TxRecord } from "../hooks/useSwap";

interface Props {
  txs: TxRecord[];
}

const TransactionHistory: FC<Props> = ({ txs }) => {
  if (txs.length === 0) {
    return (
      <div className="tx-history empty">
        <div className="tx-empty-state">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
          <span>No transactions yet. Connect your wallet and swap to get started.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="tx-history">
      <div className="tx-history-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
        <span>Transaction History</span>
        <span className="tx-count">{txs.length}</span>
      </div>
      <div className="tx-list">
        {txs.map((tx) => (
          <div key={tx.hash} className={`tx-item ${tx.status}`}>
            <div className="tx-left">
              <span className="tx-action">{tx.tokenIn} → {tx.tokenOut}</span>
              <span className="tx-pair">{tx.amountIn} {tx.tokenIn}</span>
            </div>
            <div className="tx-right">
              {tx.realizedSlippage !== null && (
                <span className={`tx-slippage ${tx.realizedSlippage > 0.5 ? "high" : ""}`}>
                  {tx.realizedSlippage.toFixed(2)}% slip
                </span>
              )}
              <span className={`tx-status-badge ${tx.status}`}>
                {tx.status === "confirmed" ? "✓" : tx.status === "pending" ? "..." : "✗"}
              </span>
              <a
                href={`https://etherscan.io/tx/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tx-link"
                title="View on Etherscan"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TransactionHistory;
