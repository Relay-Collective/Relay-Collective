import { BadgeCheck, Check, CircleX, Clock, FileText, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Driver } from '../../types'
import { DRIVER_KIND_LABELS, driverKind } from '../../volunteer/participation'
import { verificationRequirements } from '../../volunteer/verification'
import { volunteerPaths } from '../../volunteer/paths'
import { panel, panelHead, panelLink, panelTitle } from '../workspace/styles'

const DAY = new Intl.DateTimeFormat(undefined, { month: 'long', day: 'numeric', year: 'numeric' })

const LOOK: Record<Driver['status'], { icon: LucideIcon; className: string; title: string; text: string }> = {
  PENDING: {
    icon: Clock,
    className: 'bg-sun-100 text-amber-900',
    title: 'Your driver application is currently under review.',
    text: 'The Relay Collective team reviews every driver before any ride requests are sent. There’s nothing more you need to do right now. We may contact you about your licence or other documents.',
  },
  APPROVED: {
    icon: BadgeCheck,
    className: 'bg-emerald-50 text-emerald-800',
    title: 'You’re approved to drive.',
    text: 'Ride requests that fit your vehicle, cities, and availability are sent to you. You always choose which to accept.',
  },
  REJECTED: {
    icon: CircleX,
    className: 'bg-slate-100 text-slate-700',
    title: 'Your driver application wasn’t approved.',
    text: 'You won’t receive ride requests. Contact the Relay Collective team if you have questions about the decision.',
  },
}

const STATE_ICON = { done: Check, waiting: Clock, missing: CircleX } as const
const STATE_CLASS = { done: 'bg-emerald-700 text-white', waiting: 'bg-sun-100 text-amber-900', missing: 'bg-slate-100 text-slate-600' } as const
const STATE_TEXT = { done: 'Complete', waiting: 'In progress', missing: 'Needs attention' } as const

// A volunteer who applied from their workspace reads about their CareRide application; everyone else, as before
function panelName(driver: Driver): string {
  if (!driver.appliedAsVolunteer || driver.status === 'APPROVED') return 'Driver verification'
  return driver.status === 'PENDING' ? 'CareRide application under review' : 'CareRide application'
}

// The driver's review status in words, and what it's based on
export function VerificationSummary({ driver, detailed = false }: { driver: Driver; detailed?: boolean }) {
  const look = LOOK[driver.status]
  const Icon = look.icon
  return (
    <section aria-labelledby="verification-title" className={panel}>
      <div className={panelHead}>
        <h2 id="verification-title" className={panelTitle}>
          {detailed ? 'Review status' : panelName(driver)}
        </h2>
        {!detailed && (
          <Link to={volunteerPaths.verification} className={panelLink}>
            Details
          </Link>
        )}
      </div>
      <div className="flex items-start gap-4 px-5 py-5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${look.className}`} aria-hidden>
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <p className="font-heading text-lg font-bold text-rc-navy" role="status">
            {look.title}
          </p>
          <p className="mt-1 text-sm text-slate-600">{look.text}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            {DRIVER_KIND_LABELS[driverKind(driver)]}
            {driver.createdAt && ` · Applied ${DAY.format(new Date(driver.createdAt))}`}
          </p>
        </div>
      </div>
      {detailed && (
        <ol className="divide-y divide-slate-100 border-t border-slate-100" aria-label="Verification requirements">
          {verificationRequirements(driver).map((r) => {
            const StateIcon = STATE_ICON[r.state]
            return (
              <li key={r.label} className="flex items-start gap-3 px-5 py-4">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${STATE_CLASS[r.state]}`} aria-hidden>
                  <StateIcon className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2">
                    <span className="font-semibold text-rc-navy">{r.label}</span>
                    <span className="text-xs font-semibold text-slate-500">{STATE_TEXT[r.state]}</span>
                  </span>
                  <span className="mt-0.5 flex items-start gap-1.5 text-sm text-slate-600">
                    {r.document && <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
                    {r.detail}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
