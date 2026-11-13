import type { RideEventKind } from './index'

export type NotificationKind = RideEventKind | 'OFFER'
export interface CareRideNotification {
  id: string
  ride_id: string
  kind: NotificationKind
  created_at: string
  read_at: string | null
}
