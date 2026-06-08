import type { FlowStep } from '../types'

interface FlowVisualizerProps {
  steps: FlowStep[]
}

function StepIcon({ status }: { status: FlowStep['status'] }) {
  if (status === 'done') return <span>✓</span>
  if (status === 'active') return <span>●</span>
  if (status === 'error') return <span>✕</span>
  return <span style={{ fontSize: 10 }}>○</span>
}

export function FlowVisualizer({ steps }: FlowVisualizerProps) {
  return (
    <div className="card flow-visualizer">
      <div className="card-header">
        <span className="card-title">Swap Flow</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {steps.filter(s => s.status === 'done').length}/{steps.length} steps
        </span>
      </div>

      <div className="flow-steps">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          return (
            <div className="flow-step" key={step.id}>
              <div className="step-indicator-col">
                <div className={`step-dot ${step.status}`}>
                  <StepIcon status={step.status} />
                </div>
                {!isLast && <div className={`step-line ${step.status === 'done' ? 'done' : step.status === 'active' ? 'active' : ''}`} />}
              </div>
              <div className="step-content">
                <div className="step-label">{step.label}</div>
                <div className="step-description">{step.description}</div>
                {step.detail && (
                  <div className="step-detail">{step.detail}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
