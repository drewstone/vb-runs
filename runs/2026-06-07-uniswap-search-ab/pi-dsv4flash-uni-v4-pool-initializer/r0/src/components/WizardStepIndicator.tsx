import type { WizardStep } from '../types.ts'

interface StepIndicatorProps {
  currentStep: WizardStep
  onStepClick: (step: WizardStep) => void
}

const STEPS: { key: WizardStep; label: string }[] = [
  { key: 'tokens', label: 'Select Tokens' },
  { key: 'fees', label: 'Fee Tier' },
  { key: 'hooks', label: 'Hooks' },
  { key: 'price', label: 'Initial Price' },
  { key: 'review', label: 'Review' },
]

export function WizardStepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  const currentIdx = STEPS.findIndex(s => s.key === currentStep)

  const getStepStatus = (idx: number) => {
    if (idx < currentIdx) return 'completed'
    if (idx === currentIdx) return 'active'
    return ''
  }

  return (
    <div className="wizard-steps">
      {STEPS.map((step, idx) => {
        const status = getStepStatus(idx)
        return (
          <button
            key={step.key}
            className={`wizard-step ${status}`}
            onClick={() => {
              if (idx <= currentIdx) onStepClick(step.key)
            }}
            disabled={idx > currentIdx}
            type="button"
          >
            <span className="wizard-step-number">
              {status === 'completed' ? '✓' : idx + 1}
            </span>
            <span className="wizard-step-label">{step.label}</span>
          </button>
        )
      })}
    </div>
  )
}
