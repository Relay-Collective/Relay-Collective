import type { UserRole } from '../types'
import type { CareRideNotification } from '../types/notifications'
import { volunteerPaths } from '../volunteer/paths'
import { careRidePaths } from '../modules/careride/paths'

export function hasCareRideInbox(role?: UserRole) {
  return role === 'DRIVER' || role === 'PARTNER' || role === 'ORG_ADMIN'
}

export function notificationPath(role?: UserRole) {
  if (role === 'DRIVER') return volunteerPaths.notifications
  if (role === 'PARTNER') return careRidePaths.notifications
  if (role === 'ORG_ADMIN') return '/org/notifications'
  return '/home'
}

export function notificationRidePath(role: UserRole, item: CareRideNotification) {
  if (role === 'DRIVER') {
    return item.kind === 'OFFER' || item.kind === 'DRIVER_REMOVED' || item.kind === 'EDITED' ? volunteerPaths.opportunities : volunteerPaths.ride(item.ride_id)
  }
  if (role === 'ORG_ADMIN') return '/org/bookings'
  return careRidePaths.ride(item.ride_id)
}
