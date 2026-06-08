import type { FeeTier } from '../types.ts'
import { FEE_TIERS } from '../utils/fees.ts'

interface FeeTierSelectorProps {
  selected: FeeTier | null
  tickSpacing: number
  customTickSpacing: boolean
  onFeeChange: (fee: FeeTier) => void
  onTickSpacingChange: (spacing: number) => void
  onCustomToggle: (custom: boolean) => void
}

export function FeeTierSelector({
  selected,
  tickSpacing,
  customTickSpacing,
  onFeeChange,
  onTickSpacingChange,
  onCustomToggle,
}: FeeTierSelectorProps) {
  return (
    <>
      <div className="form-group">
        <div className="form-label-row">
          <label className="form-label">Fee Tier</label>
        </div>
        <div className="fee-tier-grid">
          {FEE_TIERS.map(tier => (
            <button
              key={tier.fee}
              type="button"
              className={`fee-tier-option ${selected?.fee === tier.fee ? 'selected' : ''}`}
              onClick={() => onFeeChange(tier)}
            >
              <span className="fee-pct">{tier.label}</span>
              <span className="fee-label">Fee</span>
              <span className="fee-spacing">tick {tier.tickSpacing}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="toggle-row">
        <div>
          <div className="toggle-label">Custom Tick Spacing</div>
          <div className="toggle-desc">Override the default tick spacing for this fee tier</div>
        </div>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={customTickSpacing}
            onChange={e => onCustomToggle(e.target.checked)}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {customTickSpacing && (
        <div className="form-group">
          <label className="form-label">Tick Spacing</label>
          <input
            type="number"
            className="text-input"
            value={tickSpacing}
            onChange={e => onTickSpacingChange(Math.max(1, Number(e.target.value)))}
            min={1}
            max={10000}
            placeholder="e.g. 60"
          />
          <div className="form-hint">
            Lower values = more precise pricing but higher gas. Standard: 10 (0.05%), 60 (0.30%), 200 (1.00%)
          </div>
        </div>
      )}
    </>
  )
}
