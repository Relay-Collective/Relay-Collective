import { HOME_FOR } from '../logic/homeFor'
import type { Organization, User } from '../types'

export const onboardingPaths = {
  start: '/onboarding',
  organization: '/onboarding/organization',
  provider: '/onboarding/provider', // CareRide driver sign-up
  volunteer: '/onboarding/volunteer', // general volunteer: interests, no vehicle
  join: '/onboarding/join', // find an organization and ask to join it
  joinStatus: '/onboarding/join/status', // where that request stands
  application: '/application', // an organization's review status
  invite: (token: string) => `/invite/${encodeURIComponent(token)}`,
}

// Where someone lands after signing in, from what the backend says about them: their role,
// and for organization staff, whether the organization is approved. Never from a choice made on screen.
export function homePath(user: User, org: Organization | undefined): string {
  if (user.role === 'PARTNER' && org && org.status !== 'APPROVED') return onboardingPaths.application
  return HOME_FOR[user.role]
}

// Landing pages send ?role=partner|driver|volunteer. A preference for which path to show first, nothing more.
export function pathForIntent(intent: string | null): string {
  if (intent === 'partner') return onboardingPaths.organization
  if (intent === 'driver') return onboardingPaths.provider
  if (intent === 'volunteer') return onboardingPaths.volunteer
  return onboardingPaths.start
}
