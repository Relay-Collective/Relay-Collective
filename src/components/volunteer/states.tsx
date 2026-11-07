import { CircleX, Hourglass, ShieldOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useVolunteer } from '../../hooks/useVolunteer'
import { canDrive } from '../../volunteer/participation'
import { volunteerPaths } from '../../volunteer/paths'
import { secondaryButton } from '../ui'
import { SectionError, SkeletonRows } from '../workspace/states'
import { compactButton, panel } from '../workspace/styles'

// A whole-page message in place of content the account can't use (yet), with the one useful next step.
export function RestrictedState({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className={`${panel} mx-auto max-w-xl px-6 py-10 text-center`} aria-labelledby="restricted-title">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sun-100 text-amber-900" aria-hidden>
        {icon}
      </span>
      <h1 id="restricted-title" className="font-heading text-2xl font-bold tracking-tight text-rc-navy">
        {title}
      </h1>
      <div className="mt-2 text-slate-600">{children}</div>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </section>
  )
}

const verificationLink = (
  <Link to={volunteerPaths.verification} className={`${secondaryButton} ${compactButton}`}>
    View verification status
  </Link>
)

// Transportation pages for approved drivers only. Everyone else is told why, in words, instead of seeing empty lists.
// For usability only: the backend refuses requests and ride actions to drivers who aren't approved.
export function RequireApprovedDriver({ children }: { children: ReactNode }) {
  const { driver, driverLoaded } = useVolunteer()
  if (!driverLoaded) return <SkeletonRows rows={3} label="Loading your workspace" />
  if (!driver) {
    return (
      <RestrictedState icon={<ShieldOff className="h-6 w-6" />} title="This service isn't available to your account.">
        <p>There's no driver profile on this account. Contact the Relay Collective team if you think that's a mistake.</p>
      </RestrictedState>
    )
  }
  if (driver.status === 'PENDING') {
    return (
      <RestrictedState icon={<Hourglass className="h-6 w-6" />} title="Your driver application is currently under review." action={verificationLink}>
        <p>The Relay Collective team reviews every driver before the first ride. Once you're approved, requests that fit your availability show up here.</p>
      </RestrictedState>
    )
  }
  if (!canDrive(driver)) {
    return (
      <RestrictedState icon={<CircleX className="h-6 w-6" />} title="Your driver application wasn't approved." action={verificationLink}>
        <p>You won't receive ride requests. Contact the Relay Collective team if you have questions about the decision.</p>
      </RestrictedState>
    )
  }
  return <>{children}</>
}

// The load-failure message every volunteer section uses
export function VolunteerLoadError() {
  return <SectionError message="We couldn't load your information. Please try again." />
}
