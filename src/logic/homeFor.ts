import type { UserRole } from '../types'
import { volunteerPaths } from '../volunteer/paths'
import { paths } from '../workspace/paths'

// The main page each type of account lands on after signing in.
export const HOME_FOR: Record<UserRole, string> = {
  PLATFORM_ADMIN: '/admin',
  ORG_ADMIN: '/org',
  PARTNER: paths.overview,
  DRIVER: volunteerPaths.overview,
  VOLUNTEER: volunteerPaths.overview, // the volunteer workspace, without its driving pages
}

export const ROLE_LABELS: Record<UserRole, string> = {
  PLATFORM_ADMIN: 'Relay Collective admin',
  ORG_ADMIN: 'Transport provider',
  PARTNER: 'Partner organization',
  DRIVER: 'Driver',
  VOLUNTEER: 'Volunteer',
}

// Where a ride's detail page lives for the partner organization that booked it.
export function ridePath(rideId: string): string {
  return paths.ride(rideId)
}
