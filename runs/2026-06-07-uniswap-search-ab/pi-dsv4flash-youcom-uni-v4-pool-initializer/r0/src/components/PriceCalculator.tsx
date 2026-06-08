import { useState, useCallback } from "react";
import {
  sqrtPriceX96ToPrice,
  priceToSqrtPriceX96,
} from "../utils/price.ts";

interface PriceCalculatorProps {
  sqrtPriceX96: string;
  onSqrtPriceChange: (val: string) => void;
  decimals0: number;
  decimals1: number;
}

export function PriceCalculator({
  sqrtPriceX96,
  onSqrtPriceChange,
  decimals0,
  decimals1,
}: PriceCalculatorProps) {
  const [priceInput, setPriceInput] = useState("");

  const handleSqrtChange = useCallback(
    (val: string) => {
      onSqrtPriceChange(val);
      try {
        if (BigInt(val) > 0n) {
          setPriceInput(sqrtPriceX96ToPrice(val, decimals0, decimals1));
        } else {
          setPriceInput("");
        }
      } catch {
        setPriceInput("");
      }
    },
    [onSqrtPriceChange, decimals0, decimals1],
  );

  const handlePriceChange = useCallback(
    (val: string) => {
      setPriceInput(val);
      const parsed = Number.parseFloat(val);
      if (!Number.isNaN(parsed) && parsed > 0) {
        const sqrt = priceToSqrtPriceX96(parsed, decimals0, decimals1);
        onSqrtPriceChange(sqrt);
      } else {
        onSqrtPriceChange("");
      }
    },
    [onSqrtPriceChange, decimals0, decimals1],
  );

  return (
    <div className="price-calculator">
      <label className="field-label">Price Calculator</label>
      <div className="calc-grid">
        <div className="calc-field">
          <span className="calc-unit">sqrtPriceX96</span>
          <input
            type="text"
            className="field-input mono"
            placeholder="e.g. 79228162514264337593543950336"
            value={sqrtPriceX96}
            onChange={(e) => handleSqrtChange(e.target.value)}
          />
        </div>
        <div className="calc-arrow">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 10h12M11 5l5 5-5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M4 10h12M11 5l5 5-5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="calc-field">
          <span className="calc-unit">Price (token1/token0)</span>
          <input
            type="text"
            className="field-input"
            placeholder="e.g. 1.0"
            value={priceInput}
            onChange={(e) => handlePriceChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
