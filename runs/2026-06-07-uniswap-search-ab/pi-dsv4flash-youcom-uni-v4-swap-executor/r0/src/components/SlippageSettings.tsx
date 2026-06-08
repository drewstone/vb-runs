import type { FC } from "react";

interface SlippageSettingsProps {
  /** Slippage in basis points (e.g. 50 = 0.5%) */
  slippageBps: bigint;
  /** Called when slippage changes */
  onChange: (bps: bigint) => void;
}

const PRESETS = [
  { label: "0.1%", bps: 10n },
  { label: "0.5%", bps: 50n },
  { label: "1.0%", bps: 100n },
];

const SlippageSettings: FC<SlippageSettingsProps> = ({ slippageBps, onChange }) => {
  return (
    <div className="slippage-settings">
      <div className="settings-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
        <span>Max Slippage</span>
      </div>
      <div className="slippage-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.bps.toString()}
            className={`slippage-btn ${slippageBps === preset.bps ? "active" : ""}`}
            onClick={() => onChange(preset.bps)}
            type="button"
          >
            {preset.label}
          </button>
        ))}
        <div className="slippage-custom">
          <input
            type="number"
            min="0.01"
            max="50"
            step="0.01"
            placeholder="Custom"
            value={Number(slippageBps) / 100}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val >= 0.01 && val <= 50) {
                onChange(BigInt(Math.floor(val * 100)));
              }
            }}
            className="slippage-custom-input"
          />
          <span className="slippage-unit">%</span>
        </div>
      </div>
    </div>
  );
};

export default SlippageSettings;
