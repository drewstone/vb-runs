interface HooksAddressInputProps {
  value: string
  onChange: (address: string) => void
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export function HooksAddressInput({ value, onChange }: HooksAddressInputProps) {
  const isZero = value === ZERO_ADDRESS

  return (
    <div className="form-group">
      <div className="form-label-row">
        <label className="form-label">Hooks Contract Address</label>
        <span
          className="zero-address-chip"
          onClick={() => onChange(ZERO_ADDRESS)}
        >
          {isZero ? '✓ Zero Address' : 'Set to Zero'}
        </span>
      </div>
      <input
        type="text"
        className="text-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={ZERO_ADDRESS}
        spellCheck={false}
      />
      <div className="form-hint">
        {isZero
          ? 'No hooks — pool will use default swap/position logic'
          : 'Deploy a hook contract and paste its address here. Hooks enable custom pool logic via callbacks.'}
      </div>

      <div className="callout" style={{ marginTop: 16 }}>
        <span className="callout-icon">ℹ</span>
        <div>
          <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 4 }}>
            About Hooks
          </strong>
          Uniswap V4 hooks are contracts that execute custom logic at key pool lifecycle events
          (before/after swap, add liquidity, etc.). Leave as zero address for a standard pool.
        </div>
      </div>
    </div>
  )
}
