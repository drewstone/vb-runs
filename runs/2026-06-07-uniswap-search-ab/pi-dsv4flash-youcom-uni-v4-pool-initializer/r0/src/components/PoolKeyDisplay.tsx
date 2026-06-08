import type { PoolKey } from "@uniswap/v4-sdk";

interface PoolKeyDisplayProps {
  poolKey: PoolKey | null;
  poolId: string | null;
}

export function PoolKeyDisplay({ poolKey, poolId }: PoolKeyDisplayProps) {
  if (!poolKey) return null;

  return (
    <div className="pool-key-display">
      <h3 className="section-title">Pool Key</h3>
      <div className="key-grid">
        <div className="key-row">
          <span className="key-label">currency0</span>
          <span className="key-value mono">{poolKey.currency0}</span>
        </div>
        <div className="key-row">
          <span className="key-label">currency1</span>
          <span className="key-value mono">{poolKey.currency1}</span>
        </div>
        <div className="key-row">
          <span className="key-label">fee</span>
          <span className="key-value mono">{poolKey.fee}</span>
        </div>
        <div className="key-row">
          <span className="key-label">tickSpacing</span>
          <span className="key-value mono">{poolKey.tickSpacing}</span>
        </div>
        <div className="key-row">
          <span className="key-label">hooks</span>
          <span className="key-value mono">{poolKey.hooks}</span>
        </div>
      </div>

      {poolId && (
        <div className="pool-id-section">
          <h3 className="section-title">Pool ID</h3>
          <div className="pool-id-box">
            <div className="pool-id-value mono">{poolId}</div>
            <div className="pool-id-note">
              keccak256(abi.encode(PoolKey)) &middot; bytes32 identifier used by PoolManager
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
