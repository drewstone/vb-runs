import { useAccount, useBalance } from "wagmi";
import { TOKENS } from "../constants";
import type { FC } from "react";

interface TokenInputProps {
  /** Token symbol (e.g. "ETH", "USDC") */
  token: string;
  /** Amount string */
  amount: string;
  /** Called when amount changes */
  onAmountChange: (value: string) => void;
  /** Called when token changes */
  onTokenChange: (token: string) => void;
  /** Token options to show */
  tokens?: string[];
  /** Label for the input */
  label: string;
  /** Whether to show balance */
  showBalance?: boolean;
  /** Disable input */
  disabled?: boolean;
}

const TokenInput: FC<TokenInputProps> = ({
  token,
  amount,
  onAmountChange,
  onTokenChange,
  tokens = Object.keys(TOKENS),
  label,
  showBalance = true,
  disabled = false,
}) => {
  const { address } = useAccount();
  const tokenData = TOKENS[token];
  const { data: balance } = useBalance({
    address,
    token: token === "ETH" ? undefined : tokenData?.address,
    query: { enabled: showBalance && !!address && !!tokenData },
  });

  const handleMax = () => {
    if (balance) {
      onAmountChange(balance.formatted);
    }
  };

  return (
    <div className="token-input">
      <div className="token-input-header">
        <span className="token-input-label">{label}</span>
        {showBalance && address && balance && (
          <button className="token-balance-btn" onClick={handleMax} type="button">
            Balance: {parseFloat(balance.formatted).toFixed(4)}
          </button>
        )}
      </div>
      <div className="token-input-row">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={amount}
          onChange={(e) => {
            const val = e.target.value;
            // Only allow numbers and decimal point
            if (/^\d*\.?\d*$/.test(val) || val === "") {
              onAmountChange(val);
            }
          }}
          disabled={disabled}
          className="token-amount-input"
        />
        <div className="token-select-wrap">
          <select
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            className="token-select"
          >
            {tokens.map((sym) => (
              <option key={sym} value={sym}>
                {sym}
              </option>
            ))}
          </select>
          {tokenData && (
            <span className="token-name">{tokenData.name}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenInput;
