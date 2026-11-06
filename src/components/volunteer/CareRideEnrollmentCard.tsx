import { ArrowRight, ChevronDown } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from '../../hooks/useApp'
import { useVolunteer } from '../../hooks/useVolunteer'
import { CareRideMark } from '../../modules/careride/brand'
import { hasDraft } from '../../onboarding/drafts'
import { canApplyToCareRide, careRideEnrollmentView } from '../../volunteer/enrollment'
import { volunteerPaths } from '../../volunteer/paths'
import { primaryButton } from '../ui'
import { compactButton, focusRing, panel } from '../workspace/styles'

// The way into CareRide for a general volunteer, on their Overview. Optional, and open whatever their interests:
// choosing Transportation isn't required, and applying never grants anything until the team approves it.
// Once they've applied, the account is a CareRide driver's and the Overview shows their application instead.
export function CareRideEnrollmentCard() {
  const { identity, currentUser } = useApp()
  const { workspace } = useVolunteer()
  if (!identity || !canApplyToCareRide(currentUser)) return null
  const view = careRideEnrollmentView(workspace, hasDraft('careride', identity.id))

  return (
    <section aria-labelledby="careride-enroll-title" className={`${panel} overflow-hidden`}>
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:p-6">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 shadow-[inset_0_0_0_1px_var(--color-brand-100)]" aria-hidden>
          <CareRideMark tone="brand" className="h-8 w-8" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="careride-enroll-title" className="font-heading text-[22px] font-bold leading-tight tracking-[-0.03em] text-ink">
            Drive with CareRide
          </h2>
          <p className="mt-0.5 font-semibold text-rc-navy">Help people reach essential services.</p>
          <p className="mt-2 text-sm text-slate-600">
            Volunteer drivers support community members travelling to medical appointments, housing services, and other important destinations.
          </p>
          {view === 'IN_PROGRESS' && (
            <p className="mt-3 inline-flex items-center rounded-full bg-sun-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">Application not submitted yet</p>
          )}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link to={volunteerPaths.careRideApply} className={`${primaryButton} ${compactButton}`}>
              {view === 'IN_PROGRESS' ? 'Continue application' : 'Apply to drive'} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <details className="group mt-4 rounded-xl border border-slate-200/80">
            <summary
              className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 text-sm font-semibold text-rc-blue [&::-webkit-details-marker]:hidden ${focusRing}`}
            >
              Learn about CareRide
              <ChevronDown className="h-4 w-4 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
            </summary>
            <ul className="list-disc space-y-1.5 px-4 pb-4 pl-8 text-sm text-slate-600">
              <li>You drive your own car, in the cities and at the times you choose, and you accept only the rides that suit you.</li>
              <li>The Relay Collective team verifies every driver before any ride requests are sent. Applying doesn’t approve you to drive.</li>
              <li>It’s the same account: your volunteer profile and interests stay exactly as they are.</li>
            </ul>
          </details>
        </div>
      </div>
    </section>
  )
}
