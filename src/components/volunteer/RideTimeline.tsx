import { Check, CircleX } from 'lucide-react'
import { driverTimeline } from '../../logic/driverTimeline'
import { formatTime } from '../../logic/formatTime'
import type { Ride } from '../../types'

// What has happened on this ride so far, in order, with times. Read-only: steps are taken in the trip panel.
export function RideTimeline({ ride }: { ride: Ride }) {
  const steps = driverTimeline(ride)
  return (
    <ol className="space-y-0" aria-label="Ride progress">
      {steps.map((step, i) => {
        const last = i === steps.length - 1
        const dot =
          step.state === 'done'
            ? 'bg-rc-teal text-white'
            : step.state === 'stopped'
              ? 'bg-slate-600 text-white'
              : step.state === 'current'
                ? 'border-2 border-rc-blue bg-white'
                : 'border-2 border-slate-200 bg-white'
        return (
          <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0" aria-current={step.state === 'current' ? 'step' : undefined}>
            {!last && <span className={`absolute left-[11px] top-6 bottom-0 w-0.5 ${step.state === 'done' ? 'bg-rc-teal/40' : 'bg-slate-200'}`} aria-hidden />}
            <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${dot}`} aria-hidden>
              {step.state === 'done' && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
              {step.state === 'stopped' && <CircleX className="h-3.5 w-3.5" />}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-sm font-semibold ${step.state === 'upcoming' ? 'text-slate-500' : 'text-rc-navy'}`}>
                {step.label}
                <span className="sr-only">
                  {step.state === 'done' ? ' (done)' : step.state === 'current' ? ' (next)' : step.state === 'stopped' ? '' : ' (later)'}
                </span>
              </p>
              {step.at && <p className="text-xs text-slate-500">{formatTime(step.at)}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
