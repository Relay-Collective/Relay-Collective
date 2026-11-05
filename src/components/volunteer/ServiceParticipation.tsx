import { ArrowRight, Compass } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCurrentOrg } from '../../hooks/useCurrent'
import { useVolunteer } from '../../hooks/useVolunteer'
import { CareRideMark } from '../../modules/careride/brand'
import { volunteerPaths } from '../../volunteer/paths'
import { DRIVER_KIND_LABELS } from '../../volunteer/participation'
import { VerificationBadge } from '../admin/VerificationBadge'
import { panel, panelHead, panelLink, panelTitle } from '../workspace/styles'

// The services this person is actually enrolled in, never their interests. CareRide is the one operational
// service today, and only a driver profile (approved by the Relay Collective team) enrolls anyone in it.
//
// welcome: the general volunteer's Overview, where no enrollment is where the journey starts.
export function ServiceParticipation({ title = 'Service participation', welcome = false }: { title?: string; welcome?: boolean }) {
  const { workspace } = useVolunteer()
  const org = useCurrentOrg()
  const enrolled = workspace.careRide !== 'NOT_ENROLLED'

  return (
    <section aria-labelledby="participation-title" className={panel}>
      <div className={panelHead}>
        <h2 id="participation-title" className={panelTitle}>
          {title}
        </h2>
      </div>

      {!enrolled && (
        <div className={`flex items-start gap-4 px-5 sm:px-6 ${welcome ? 'py-6' : 'py-4'}`}>
          {welcome && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-rc-blue" aria-hidden>
              <Compass className="h-6 w-6" />
            </span>
          )}
          <div className="min-w-0">
            <p className={welcome ? 'font-heading text-lg font-bold tracking-[-0.02em] text-rc-navy' : 'font-semibold text-rc-navy'}>
              {welcome ? 'Your volunteering journey starts here.' : 'You’re not enrolled in a service yet.'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {welcome
                ? 'Your interests are saved. As more services become available through Relay Collective, there will be more ways to get involved.'
                : 'Your interests are saved separately. Taking part in a service is its own enrollment.'}
            </p>
          </div>
        </div>
      )}

      <ul className={enrolled ? '' : 'border-t border-slate-100'}>
        <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 sm:px-6">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 shadow-[inset_0_0_0_1px_var(--color-brand-100)]"
            aria-hidden
          >
            <CareRideMark tone="brand" className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-rc-navy">CareRide · Transportation</span>
            <span className="block text-sm text-slate-600">
              {enrolled && workspace.driverKind
                ? DRIVER_KIND_LABELS[workspace.driverKind]
                : 'Running today. Driving is a separate enrollment, and isn’t open to volunteer accounts yet.'}
              {enrolled && org ? ` · ${org.name}` : ''}
            </span>
          </span>
          {workspace.careRide === 'NOT_ENROLLED' ? (
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              Not enrolled
            </span>
          ) : (
            <VerificationBadge status={workspace.careRide} />
          )}
        </li>
      </ul>

      {enrolled && (
        <div className="border-t border-slate-100 px-3 py-2">
          <Link to={volunteerPaths.verification} className={panelLink}>
            Driver verification <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      )}
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
        Service roles are granted by the Relay Collective team after review.
      </p>
    </section>
  )
}
