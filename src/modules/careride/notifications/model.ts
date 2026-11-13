import type { NotificationKind } from '../../../types/notifications'

export interface PushPreferences { offers: boolean; updates: boolean }
export const DEFAULT_PREFERENCES: PushPreferences = { offers: true, updates: true }

export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  OFFER: 'New ride request',
  REQUESTED: 'Ride requested',
  EDITED: 'Ride details changed',
  SENT_AGAIN: 'Ride sent to drivers again',
  NO_DRIVER_AVAILABLE: 'Ride needs attention',
  DRIVER_ACCEPTED: 'Driver confirmed',
  DRIVER_DROPPED: 'Driver released the ride',
  DRIVER_REMOVED: 'Driver assignment removed',
  ON_THE_WAY: 'Driver is on the way',
  ARRIVED: 'Driver arrived',
  PICKED_UP: 'Passenger picked up',
  COMPLETED: 'Ride completed',
  NO_SHOW: 'Passenger wasn’t there',
  CANCELLED: 'Ride cancelled',
  STEP_UNDONE: 'Ride progress corrected',
}
