import { Check } from 'lucide-react'
import { focusRing } from '../auth/styles'

export interface StepItem {
  id: string
  title: string
  description: string
}

interface Props {
  steps: StepItem[]
  current: number
  furthest: number // the furthest step reached, so finished steps can be revisited
  onSelect: (index: number) => void
  disabled?: boolean
}

// The vertical progress list in the onboarding sidebar. Finished steps are buttons back to that step.
export function OnboardingStepper({ steps, current, furthest, onSelect, disabled }: Props) {
  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const active = i === current
        // Passed on the way to the furthest step (the furthest one itself was reached, not finished)
        const finished = !active && i < furthest
        const clickable = i <= furthest && !active && !disabled
        const marker = (
          <span
            className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition duration-300 ${
              active
                ? 'bg-rc-blue text-white shadow-[0_0_0_6px_rgba(34,81,232,0.12)]'
                : finished
                  ? 'bg-rc-teal text-white'
                  : 'border border-rc-line bg-white text-slate-500'
            }`}
          >
            {finished ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : i + 1}
          </span>
        )
        const text = (
          <span className="min-w-0 pt-1">
            <span className={`block text-sm font-semibold ${active ? 'text-rc-navy' : finished ? 'text-slate-700' : 'text-slate-500'}`}>{step.title}</span>
            <span className={`mt-0.5 block text-[13px] leading-snug ${active ? 'text-slate-600' : 'text-slate-500'}`}>{step.description}</span>
          </span>
        )
        const state = active ? 'current step' : finished ? 'completed' : 'not started'
        return (
          <li key={step.id} className="relative pb-7 last:pb-0" aria-current={active ? 'step' : undefined}>
            {i < steps.length - 1 && (
              <span className={`absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-px ${i < furthest ? 'bg-rc-teal/50' : 'bg-rc-line'}`} aria-hidden />
            )}
            {clickable ? (
              <button type="button" onClick={() => onSelect(i)} className={`flex w-full gap-3.5 rounded-xl text-left transition hover:opacity-80 ${focusRing}`}>
                {marker}
                {text}
                <span className="sr-only">({state}, go back to edit)</span>
              </button>
            ) : (
              <div className="flex gap-3.5">
                {marker}
                {text}
                <span className="sr-only">({state})</span>
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

// The phone version: the step name and a slim bar
export function CompactProgress({ steps, current }: { steps: StepItem[]; current: number }) {
  const percent = Math.round(((current + 1) / steps.length) * 100)
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm font-semibold">
        <span className="text-rc-navy">{steps[current]?.title}</span>
        <span className="text-slate-500">
          Step {current + 1} of {steps.length}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-rc-line"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={current + 1}
        aria-label={`Step ${current + 1} of ${steps.length}`}
      >
        <div className="h-full rounded-full bg-rc-blue transition-all duration-500 ease-out" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
