import { type Address } from "viem";
import { TOKEN_PRESETS } from "../utils/constants.ts";

interface TokenSelectProps {
  label: string;
  value: Address;
  onChange: (addr: Address) => void;
  otherAddress: Address;
}

export function TokenSelect({ label, value, onChange, otherAddress }: TokenSelectProps) {
  const tokenMeta = TOKEN_PRESETS.find((t) => t.address.toLowerCase() === value.toLowerCase());
  const available = TOKEN_PRESETS.filter(
    (t) => t.address.toLowerCase() !== otherAddress.toLowerCase(),
  );

  return (
    <div className="token-select">
      <label className="field-label">{label}</label>
      <div className="token-input-group">
        <div className="token-presets">
          {available.map((t) => (
            <button
              key={t.address}
              type="button"
              className={`token-chip ${value.toLowerCase() === t.address.toLowerCase() ? "active" : ""}`}
              onClick={() => onChange(t.address as Address)}
            >
              {t.symbol}
            </button>
          ))}
        </div>
        <input
          type="text"
          className="field-input mono"
          placeholder="0x..."
          value={value}
          onChange={(e) => onChange(e.target.value as Address)}
        />
        {tokenMeta && (
          <span className="token-meta">
            {tokenMeta.name} &middot; {tokenMeta.decimals} decimals
          </span>
        )}
      </div>
    </div>
  );
}
