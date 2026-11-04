import { AlertCircle } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LogoMark } from './brand/LogoMark'
import { useApp } from '../hooks/useApp'
import { useCurrentOrg } from '../hooks/useCurrent'
import { HOME_FOR } from '../logic/homeFor'
import { onboardingPaths } from '../onboarding/routing'
import type { UserRole } from '../types'
import { primaryButton, secondaryButton } from './ui'

// Signed-in pages only. Everyone else goes to sign-in and comes back here afterwards.
// Sign-in is outside this gate, so sending people there does not loop.
// Being signed in is enough here (onboarding lives behind this gate); RequireAccount also needs a role.
export function RequireAuth() {
  const { ready, identity, sessionError, retrySession, signOut } = useApp()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status" aria-label="Loading">
        <LogoMark className="h-16 w-16 animate-pulse" />
      </div>
    )
  }
  // Different from being signed out: the login may be fine but the account couldn't be loaded.
  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div role="alert" className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-rest)] p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-red-600" aria-hidden />
          <h1 className="mt-3 text-xl font-bold">We couldn't open your account</h1>
          <p className="mt-2 text-slate-600">{sessionError}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <button type="button" className={primaryButton} onClick={retrySession}>
              Try again
            </button>
            <button type="button" className={secondaryButton} onClick={() => void signOut()}>
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    )
  }
  if (!identity) {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/signin" replace state={{ from }} />
  }
  return <Outlet />
}

// Pages for people with a Relay Collective role. A new identity finishes onboarding first.
export function RequireAccount() {
  const { currentUser } = useApp()
  if (!currentUser) return <Navigate to={onboardingPaths.start} replace />
  return <Outlet />
}

// The organization workspace, unless the application was turned down: that person sees its status instead.
// A pending organization can still prepare its workspace; the backend refuses bookings until approval.
export function RequireOrgNotRejected() {
  const org = useCurrentOrg()
  if (org?.status === 'REJECTED') return <Navigate to={onboardingPaths.application} replace />
  return <Outlet />
}

// Pages for one kind of account. Anyone else is sent to their own home page.
// This is for usability only: the database's access rules are what actually protect data.
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { currentUser } = useApp()
  if (currentUser && !roles.includes(currentUser.role)) return <Navigate to={HOME_FOR[currentUser.role]} replace />
  return <Outlet />
}
