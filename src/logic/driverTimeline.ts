import type { Ride } from '../types'

// A ride's progress as its driver sees it, from the times recorded on the ride itself.
// (Drivers can't read the full change history; staff and admins can.)

export interface TimelineStep {
  label: string
  at?: string // when it happened
  state: 'done' | 'current' | 'upcoming' | 'stopped'
}

export function driverTimeline(ride: Ride): TimelineStep[] {
  const points: { label: string; at?: string }[] = [
    { label: 'Accepted', at: ride.acceptedAt },
    { label: 'On the way to pickup', at: ride.driverOnTheWayAt },
    { label: 'Arrived at pickup', at: ride.driverArrivedAt },
    { label: 'Passenger picked up', at: ride.pickedUpAt },
    { label: 'Passenger dropped off', at: ride.completedAt },
  ]

  // A ride that stopped short ends with what stopped it, after the steps that did happen
  if (ride.status === 'NO_SHOW' || ride.status === 'CANCELLED') {
    const happened = points.filter((p) => p.at).map((p) => ({ ...p, state: 'done' as const }))
    return [...happened, { label: ride.status === 'NO_SHOW' ? 'Passenger didn’t show' : 'Ride cancelled', at: ride.cancelledAt, state: 'stopped' }]
  }

  // An accepted ride may predate recorded acceptance times; it still counts as accepted
  const reached = ride.status === 'ACCEPTED' || ride.status === 'PICKED_UP' || ride.status === 'COMPLETED'
  const lastDone = points.reduce((last, p, i) => (p.at || (i === 0 && reached) ? i : last), -1)
  return points.map((p, i) => ({
    ...p,
    state: i <= lastDone ? 'done' : i === lastDone + 1 && ride.status !== 'COMPLETED' ? 'current' : 'upcoming',
  }))
}
