interface PriceImpactBarProps {
  /** Price impact as a decimal (0.05 = 5%) */
  impact: number;
}

/**
 * Visual price impact indicator.
 * Shows a colored bar + label based on severity.
 */
export function PriceImpactBar({ impact }: PriceImpactBarProps) {
  const percent = Math.min(impact * 100, 100);

  let color: string;
  let level: string;
  if (percent < 0.5) {
    color = "var(--color-success)";
    level = "Low";
  } else if (percent < 2) {
    color = "var(--color-warning)";
    level = "Medium";
  } else if (percent < 5) {
    color = "var(--color-danger)";
    level = "High";
  } else {
    color = "var(--color-critical)";
    level = "Very High";
  }

  const severityClass =
    percent < 0.5
      ? "price-impact--low"
      : percent < 2
        ? "price-impact--medium"
        : percent < 5
          ? "price-impact--high"
          : "price-impact--critical";

  return (
    <div className={`price-impact ${severityClass}`}>
      <div className="price-impact__header">
        <span className="price-impact__label">Price Impact</span>
        <span className="price-impact__value" style={{ color }}>
          {percent.toFixed(2)}%
        </span>
      </div>
      <div className="price-impact__track">
        <div
          className="price-impact__fill"
          style={{
            width: `${Math.min(percent * 3, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span className="price-impact__level" style={{ color }}>
        {level} impact
      </span>
    </div>
  );
}
