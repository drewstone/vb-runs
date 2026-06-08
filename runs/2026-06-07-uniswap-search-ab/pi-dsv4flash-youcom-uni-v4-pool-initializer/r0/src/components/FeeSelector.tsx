import { FEE_TIERS } from "../utils/constants.ts";

interface FeeSelectorProps {
  fee: number;
  tickSpacing: number;
  onChange: (fee: number, tickSpacing: number) => void;
}

export function FeeSelector({ fee, tickSpacing, onChange }: FeeSelectorProps) {
  return (
    <div className="fee-selector">
      <label className="field-label">Fee Tier</label>
      <div className="fee-grid">
        {FEE_TIERS.map((tier) => (
          <button
            key={tier.value}
            type="button"
            className={`fee-option ${fee === tier.value ? "active" : ""}`}
            onClick={() => onChange(tier.value, tier.tickSpacing)}
          >
            <span className="fee-label">{tier.label}</span>
            <span className="fee-sub">
              Tick {tier.tickSpacing > 0 ? "±" : ""}{tier.tickSpacing}
            </span>
          </button>
        ))}
      </div>
      <div className="fee-info">
        <span className="mono">fee: {fee}</span>
        <span className="mono">tickSpacing: {tickSpacing}</span>
      </div>
    </div>
  );
}
