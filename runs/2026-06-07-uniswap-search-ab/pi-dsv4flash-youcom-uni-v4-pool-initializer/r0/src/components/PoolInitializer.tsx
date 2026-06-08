import { useState, useMemo, useCallback } from "react";
import { isAddress, type Address } from "viem";
import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { Pool, type PoolKey } from "@uniswap/v4-sdk";
import { TokenSelect } from "./TokenSelect.tsx";
import { FeeSelector } from "./FeeSelector.tsx";
import { PriceCalculator } from "./PriceCalculator.tsx";
import { PoolKeyDisplay } from "./PoolKeyDisplay.tsx";
import {
  sortTokens,
  addressToToken,
} from "../utils/poolKey.ts";
import { encodeSqrtRatioX96 } from "../utils/price.ts";
import {
  ZERO_ADDRESS,
  TOKEN_PRESETS,
  DEFAULT_SQRT_PRICE,
  POOL_MANAGER_ADDRESS,
} from "../utils/constants.ts";
import { parseSqrtPrice } from "../utils/price.ts";

/** ABI for PoolManager.initialize(PoolKey, uint160) returns (bytes32) */
const POOL_MANAGER_ABI = [
  {
    type: "function" as const,
    name: "initialize",
    inputs: [
      {
        type: "tuple",
        name: "key",
        components: [
          { type: "address", name: "currency0" },
          { type: "address", name: "currency1" },
          { type: "uint24", name: "fee" },
          { type: "int24", name: "tickSpacing" },
          { type: "address", name: "hooks" },
        ],
      },
      { type: "uint160", name: "sqrtPriceX96" },
    ],
    outputs: [{ type: "bytes32", name: "poolId" }],
    stateMutability: "nonpayable",
  },
] as const;

type Step = "tokens" | "fee" | "hooks" | "price" | "review";

const STEPS: { key: Step; label: string }[] = [
  { key: "tokens", label: "Tokens" },
  { key: "fee", label: "Fee Tier" },
  { key: "hooks", label: "Hooks" },
  { key: "price", label: "Price" },
  { key: "review", label: "Review" },
];

export function PoolInitializer() {
  const [step, setStep] = useState<Step>("tokens");
  const [token0, setToken0] = useState<Address>(
    TOKEN_PRESETS[0].address as Address,
  );
  const [token1, setToken1] = useState<Address>(
    TOKEN_PRESETS[3].address as Address,
  );
  const [fee, setFee] = useState(500);
  const [tickSpacing, setTickSpacing] = useState(10);
  const [hooks, setHooks] = useState<Address>(ZERO_ADDRESS);
  const [sqrtPrice, setSqrtPrice] = useState(DEFAULT_SQRT_PRICE);

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  const isValidToken0 = isAddress(token0);
  const isValidToken1 = isAddress(token1);
  const isValidHooks = isAddress(hooks);
  const parsedSqrt = parseSqrtPrice(sqrtPrice);
  const hasValidSqrt = parsedSqrt > 0n;

  // Resolve decimals from presets by address
  const meta0 = TOKEN_PRESETS.find(
    (t) => t.address.toLowerCase() === token0.toLowerCase(),
  );
  const meta1 = TOKEN_PRESETS.find(
    (t) => t.address.toLowerCase() === token1.toLowerCase(),
  );
  const decimals0 = meta0?.decimals ?? 18;
  const decimals1 = meta1?.decimals ?? 18;

  // Determine sorted order for validation
  const tokensAreDifferent = token0 !== token1;
  let addressesSorted = false;
  try {
    if (isValidToken0 && isValidToken1 && tokensAreDifferent) {
      const [c0] = sortTokens(token0, token1);
      addressesSorted = c0 === token0;
    }
  } catch {
    // ignore
  }

  // Build the PoolKey whenever form fields change using the v4 SDK directly
  const poolKey: PoolKey | null = useMemo(() => {
    if (!isValidToken0 || !isValidToken1 || !tokensAreDifferent) return null;
    try {
      const [addr0, addr1] = sortTokens(token0, token1);
      const dec0 = addr0 === token0 ? decimals0 : decimals1;
      const dec1 = addr1 === token1 ? decimals1 : decimals0;
      const t0 = addressToToken(addr0, dec0);
      const t1 = addressToToken(addr1, dec1);
      return Pool.getPoolKey(t0, t1, fee, tickSpacing, hooks);
    } catch {
      return null;
    }
  }, [token0, token1, fee, tickSpacing, hooks, isValidToken0, isValidToken1, tokensAreDifferent, decimals0, decimals1]);

  // Compute PoolId for display using Pool.getPoolId directly
  const computedPoolId: string | null = useMemo(() => {
    if (!poolKey) return null;
    try {
      const t0 = addressToToken(poolKey.currency0, decimals0);
      const t1 = addressToToken(poolKey.currency1, decimals1);
      return Pool.getPoolId(t0, t1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks);
    } catch {
      return null;
    }
  }, [poolKey, decimals0, decimals1]);

  // Wagmi write hook
  const { writeContract, data: writeData, isPending: isWritePending } = useWriteContract();

  // Transaction receipt
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: writeData,
    });

  // The returned PoolId from the tx (bytes32 hex)
  const returnedPoolId = isConfirmed && writeData ? writeData : null;

  const handleInitialize = useCallback(() => {
    if (!poolKey) return;

    // Compute sqrtPriceX96 from the sqrtPrice input using the SDK's encodeSqrtRatioX96
    const sqrtPriceX96 = encodeSqrtRatioX96(
      Math.floor(Number.parseFloat(sqrtPrice) * 10 ** 12).toString(),
      (10 ** 12).toString(),
    );

    writeContract({
      address: POOL_MANAGER_ADDRESS,
      abi: POOL_MANAGER_ABI,
      functionName: "initialize",
      args: [
        {
          currency0: poolKey.currency0 as `0x${string}`,
          currency1: poolKey.currency1 as `0x${string}`,
          fee: poolKey.fee,
          tickSpacing: poolKey.tickSpacing,
          hooks: poolKey.hooks as `0x${string}`,
        },
        BigInt(sqrtPriceX96.toString()),
      ],
    });
  }, [poolKey, sqrtPrice, writeContract]);

  const canAdvance = useMemo(() => {
    switch (step) {
      case "tokens":
        return isValidToken0 && isValidToken1 && tokensAreDifferent && addressesSorted;
      case "fee":
        return true;
      case "hooks":
        return isValidHooks;
      case "price":
        return hasValidSqrt;
      case "review":
        return true;
    }
  }, [step, isValidToken0, isValidToken1, tokensAreDifferent, addressesSorted, isValidHooks, hasValidSqrt]);

  const advance = useCallback(() => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx < STEPS.length - 1) {
      setStep(STEPS[idx + 1].key);
    }
  }, [step]);

  const retreat = useCallback(() => {
    const idx = STEPS.findIndex((s) => s.key === step);
    if (idx > 0) {
      setStep(STEPS[idx - 1].key);
    }
  }, [step]);

  return (
    <div className="initializer">
      {/* Step indicator */}
      <div className="step-indicator">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`step-dot ${stepIndex === i ? "active" : ""} ${stepIndex > i ? "done" : ""}`}
            onClick={() => {
              if (i <= stepIndex) setStep(s.key);
            }}
          >
            <div className="step-circle">
              {stepIndex > i ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2.5 6l2.5 2.5 4.5-5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <span className="step-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Form content */}
      <div className="step-content">
        {step === "tokens" && (
          <div className="step-panel">
            <h2 className="panel-title">Select Pool Tokens</h2>
            <p className="panel-desc">
              Choose the two tokens that define the pool pair. The lower address
              automatically becomes currency0.
            </p>
            <div className="token-fields">
              <TokenSelect
                label="Token A"
                value={token0}
                onChange={setToken0}
                otherAddress={token1}
              />
              <TokenSelect
                label="Token B"
                value={token1}
                onChange={setToken1}
                otherAddress={token0}
              />
            </div>
            {!tokensAreDifferent && (
              <p className="field-error">Tokens must be different addresses</p>
            )}
            {tokensAreDifferent && !addressesSorted && (
              <p className="field-error">
                Token A must have the lower address to be currency0. Swap the tokens.
              </p>
            )}
          </div>
        )}

        {step === "fee" && (
          <div className="step-panel">
            <h2 className="panel-title">Set Fee Tier</h2>
            <p className="panel-desc">
              Select the swap fee for this pool. Tick spacing is derived from
              the fee tier.
            </p>
            <FeeSelector
              fee={fee}
              tickSpacing={tickSpacing}
              onChange={(f, ts) => {
                setFee(f);
                setTickSpacing(ts);
              }}
            />
          </div>
        )}

        {step === "hooks" && (
          <div className="step-panel">
            <h2 className="panel-title">Configure Hooks</h2>
            <p className="panel-desc">
              Set the hooks contract address. Use the zero address if no hooks
              are needed.
            </p>
            <div className="hooks-field">
              <label className="field-label">Hooks Address</label>
              <input
                type="text"
                className={`field-input mono ${!isValidHooks && hooks !== ZERO_ADDRESS ? "invalid" : ""}`}
                placeholder="0x0000000000000000000000000000000000000000"
                value={hooks}
                onChange={(e) => setHooks(e.target.value as Address)}
              />
              <div className="hooks-quick">
                <button
                  type="button"
                  className={`quick-btn ${hooks === ZERO_ADDRESS ? "active" : ""}`}
                  onClick={() => setHooks(ZERO_ADDRESS)}
                >
                  Zero Address (no hooks)
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "price" && (
          <div className="step-panel">
            <h2 className="panel-title">Set Initial Price</h2>
            <p className="panel-desc">
              Enter sqrtPriceX96 directly or use the calculator to convert from
              a human-readable price.
            </p>
            <PriceCalculator
              sqrtPriceX96={sqrtPrice}
              onSqrtPriceChange={setSqrtPrice}
              decimals0={decimals0}
              decimals1={decimals1}
            />
          </div>
        )}

        {step === "review" && (
          <div className="step-panel">
            <h2 className="panel-title">Review &amp; Initialize</h2>
            <p className="panel-desc">
              Verify the pool configuration below, then initialize via
              <code className="inline-code"> PoolManager.initialize(key, sqrtPriceX96)</code>.
            </p>

            <PoolKeyDisplay poolKey={poolKey} poolId={computedPoolId} />

            {poolKey && hasValidSqrt && (
              <div className="init-section">
                <div className="init-row">
                  <span className="init-label">sqrtPriceX96</span>
                  <span className="init-value mono">{parsedSqrt.toString()}</span>
                </div>
              </div>
            )}

            {/* Transaction states */}
            {isConfirmed && returnedPoolId ? (
              <div className="success-banner">
                <div className="success-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="12" fill="currentColor" opacity="0.15" />
                    <path
                      d="M7 12.5l3 3 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="success-text">
                  <strong>Pool Initialized</strong>
                  <p className="success-desc">
                    PoolId returned from transaction:
                  </p>
                  <span className="mono pool-id-result">{returnedPoolId}</span>
                </div>
              </div>
            ) : isWritePending ? (
              <div className="tx-pending">
                <div className="spinner" />
                <span>Confirm transaction in your wallet...</span>
              </div>
            ) : isConfirming ? (
              <div className="tx-pending">
                <div className="spinner" />
                <span>Waiting for transaction confirmation...</span>
              </div>
            ) : (
              <button
                type="button"
                className="btn-primary btn-init"
                disabled={!poolKey || !hasValidSqrt}
                onClick={handleInitialize}
              >
                Initialize Pool
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="step-nav">
        <button
          type="button"
          className="btn-secondary"
          disabled={stepIndex === 0}
          onClick={retreat}
        >
          Back
        </button>
        <div className="step-nav-right">
          {step !== "review" && (
            <button
              type="button"
              className="btn-primary"
              disabled={!canAdvance}
              onClick={advance}
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
