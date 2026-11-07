import { ShieldCheck, ShieldOff } from 'lucide-react'
import { Breadcrumbs } from '../../components/admin/controls'
import { RestrictedState } from '../../components/volunteer/states'
import { VerificationSummary } from '../../components/volunteer/VerificationSummary'
import { PageHeader } from '../../components/workspace/PageHeader'
import { SkeletonRows } from '../../components/workspace/states'
import { panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { useVolunteer } from '../../hooks/useVolunteer'
import { volunteerPaths } from '../../volunteer/paths'

// Where a driver's review stands: what's required, why, what's on file, and what happens next.
// Read-only. Only the Relay Collective team approves or rejects, through an admin-only database function.
export function Verification() {
  const { driver, driverLoaded } = useVolunteer()
  const crumbs = <Breadcrumbs items={[{ label: 'My profile', to: volunteerPaths.profile }, { label: 'Driver verification' }]} />

  if (!driverLoaded) return <SkeletonRows rows={4} label="Loading your verification status" />
  if (!driver) {
    return (
      <RestrictedState icon={<ShieldOff className="h-6 w-6" />} title="This service isn't available to your account.">
        <p>There's no driver application on this account.</p>
      </RestrictedState>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        {crumbs}
        <PageHeader title="Driver verification" description="Every driver is checked by a person on the Relay Collective team before receiving any ride requests." />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="lg:col-span-2">
          <VerificationSummary driver={driver} detailed />
        </div>
        <section aria-labelledby="why-title" className={panel}>
          <div className={panelHead}>
            <h2 id="why-title" className={`${panelTitle} flex items-center gap-2`}>
              <ShieldCheck className="h-4 w-4 text-rc-teal-ink" aria-hidden /> Why we ask
            </h2>
          </div>
          <ul className="list-disc space-y-2 px-5 py-4 pl-9 text-sm text-slate-700">
            <li>Passengers are often people in vulnerable situations. Checking each driver keeps them safe.</li>
            <li>Your vehicle and capacity decide which rides you're matched with, so they're fixed once approved. Contact the team to change them.</li>
            <li>Driving professionally doesn't replace this review: every driver goes through it.</li>
            <li>Documents are never shown through public links. Only the Relay Collective team sees what's on file.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
