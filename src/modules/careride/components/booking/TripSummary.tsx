import { ArrowRight, CircleCheck, Clock, HeartPulse, Hospital, TriangleAlert, User } from 'lucide-react'
import type { ReactNode } from 'react'
import { card } from '../../../../components/ui'
import type { Field } from '../../logic/bookingForm'
import { passengersLabel } from '../../logic/rideText'

interface Stop {
  name: string
  detail?: string
}

interface Props {
  from: Stop
  to?: Stop
  when?: string
  wait?: string // current hospital / urgent-care wait, if we have one for this place
  rider?: string
  passengers: number
  needs: string[]
  missing: { field: Field; label: string }[] // what still has to be filled in or fixed, in page order
  showErrors: boolean // after a send was tried: missing items are problems now, not just to-dos
  onJump: (field: Field) => void
  children: ReactNode // driver match, errors, and the send button
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    // A <dl> may only hold dt/dd, optionally in one wrapping div, so the icon sits inside the dt.
    <div className="relative grid min-w-0 grid-cols-[5.5rem_minmax(0,1fr)] gap-3 pl-6">
      <dt className="text-sm text-slate-600">
        <span className="absolute left-0 top-0.5 text-slate-500" aria-hidden>
          {icon}
        </span>
        {label}
      </dt>
      <dd className="min-w-0 break-words text-sm font-medium text-ink">{children}</dd>
    </div>
  )
}

const pending = (text: string) => <span className="font-normal text-slate-500">{text}</span>

// A live recap of the ride beside the form (below it on phones), so staff can check it at a glance before
// sending. It says plainly what's still missing, and each item goes straight to its field.
export function TripSummary({ from, to, when, wait, rider, passengers, needs, missing, showErrors, onJump, children }: Props) {
  const ready = missing.length === 0
  return (
    <div className={`${card} space-y-5 p-5 sm:p-6`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="trip-summary-heading" tabIndex={-1} className="font-display text-lg font-bold tracking-[-0.02em] focus:outline-none">
          Your ride
        </h2>
        {ready ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            <CircleCheck className="h-3.5 w-3.5" aria-hidden />
            Ready to send
          </span>
        ) : (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${showErrors ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'}`}
          >
            {missing.length} {missing.length === 1 ? 'thing' : 'things'} left
          </span>
        )}
      </div>

      <ol className="space-y-0" aria-label="Route">
        <li className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2 pb-4">
          <span className="flex justify-center pt-1" aria-hidden>
            <span className="relative z-10 h-3 w-3 rounded-full border-[3px] border-ink bg-white" />
          </span>
          <span className="absolute bottom-0 left-[0.6875rem] top-5 w-0.5 rounded-full bg-slate-300" aria-hidden />
          <span className="min-w-0">
            <span className="block text-xs font-medium text-slate-500">Pickup</span>
            <span className="block break-words text-sm font-semibold text-ink">{from.name}</span>
            {from.detail && <span className="block break-words text-xs text-slate-600">{from.detail}</span>}
          </span>
        </li>
        <li className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-2">
          <span className="flex justify-center pt-1" aria-hidden>
            <span
              className={`relative z-10 h-3 w-3 rounded-full ${to ? 'bg-coral-400 ring-4 ring-coral-100' : 'border-2 border-slate-300 bg-white'}`}
            />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-medium text-slate-500">Drop-off</span>
            {to ? (
              <>
                <span className="block break-words text-sm font-semibold text-ink">{to.name}</span>
                {to.detail && to.detail !== to.name && <span className="block break-words text-xs text-slate-600">{to.detail}</span>}
              </>
            ) : (
              <span className="block text-sm">{pending('Not chosen yet')}</span>
            )}
          </span>
        </li>
      </ol>

      <dl className="space-y-2.5 border-t border-slate-100 pt-4">
        <Row icon={<Clock className="h-4 w-4" />} label="When">
          {when ?? pending('Not chosen yet')}
        </Row>
        {wait && (
          <Row icon={<Hospital className="h-4 w-4" />} label="Wait">
            {wait}
          </Row>
        )}
        <Row icon={<User className="h-4 w-4" />} label="Riding">
          {passengersLabel(passengers)}
          {rider && <span className="block font-normal text-slate-600">{rider}</span>}
        </Row>
        <Row icon={<HeartPulse className="h-4 w-4" />} label="Needs">
          {needs.length > 0 ? (
            <span className="flex flex-wrap gap-1.5">
              {needs.map((n) => (
                <span key={n} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                  {n}
                </span>
              ))}
            </span>
          ) : (
            pending('None')
          )}
        </Row>
      </dl>

      {!ready && (
        <div className={`rounded-xl px-3 py-2.5 ${showErrors ? 'bg-red-50' : 'bg-slate-50'}`}>
          <p className={`flex items-center gap-2 text-sm font-semibold ${showErrors ? 'text-red-700' : 'text-ink'}`}>
            {showErrors && <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />}
            {showErrors ? 'Fix before sending' : 'Still needed'}
          </p>
          <ul className="mt-1">
            {missing.map((m) => (
              <li key={m.field}>
                <button
                  type="button"
                  onClick={() => onJump(m.field)}
                  className={`group -mx-1 flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-1 text-left text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500 ${
                    showErrors ? 'text-red-800' : 'text-brand-700'
                  }`}
                >
                  {m.label}
                  <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {children}
    </div>
  )
}
