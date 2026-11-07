import type { Ride } from '../../../types'
import { actionReason, actionTitle, byPickup, countdown, finishedAt, isFinished, needsAction } from './rideInsights'
import { isSentOnTransit } from './rideText'

// What the workspace says about an organization's requests. Transportation is the only kind today,
// so everything here reads rides; every number comes straight from the rides the account can see.

const HOUR = 3_600_000
const DAY = 24 * HOUR

// A waiting ride this close to pickup is worth a look, even before it runs out of drivers to ask
export const SOON_MS = DAY
export const COMPLETED_WINDOW_DAYS = 30

const waitingForDriver = (r: Ride) => r.status === 'SEARCHING' || r.status === 'OFFERED'
const confirmedOrUnderWay = (r: Ride) => r.status === 'ACCEPTED' || r.status === 'PICKED_UP'

// The views of the requests list. Every open ride is in exactly one of attention, waiting, confirmed.
export type RequestView = 'open' | 'attention' | 'waiting' | 'confirmed' | 'past'

export const REQUEST_VIEWS: { id: RequestView; label: string }[] = [
  { id: 'open', label: 'All open' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'waiting', label: 'Awaiting a driver' },
  { id: 'confirmed', label: 'Confirmed or under way' },
  { id: 'past', label: 'Past' },
]

export function isRequestView(value: string | null): value is RequestView {
  return REQUEST_VIEWS.some((v) => v.id === value)
}

export function inView(r: Ride, view: RequestView, now: Date): boolean {
  switch (view) {
    case 'open':
      return !isFinished(r)
    case 'attention':
      return !isFinished(r) && needsAction(r, now)
    case 'waiting':
      return waitingForDriver(r) && !needsAction(r, now)
    case 'confirmed':
      return confirmedOrUnderWay(r) && !needsAction(r, now)
    case 'past':
      return isFinished(r)
  }
}

// Open requests soonest first; past ones most recent first
export function sortForView(rides: Ride[], view: RequestView): Ride[] {
  return [...rides].sort(view === 'past' ? (a, b) => finishedAt(b).localeCompare(finishedAt(a)) : byPickup)
}

export interface RequestMetrics {
  open: number
  attention: number
  waiting: number
  confirmed: number
  completedRecently: number // in the last COMPLETED_WINDOW_DAYS days
}

export function requestMetrics(rides: Ride[], now: Date): RequestMetrics {
  const since = now.getTime() - COMPLETED_WINDOW_DAYS * DAY
  const count = (view: RequestView) => rides.filter((r) => inView(r, view, now)).length
  return {
    open: count('open'),
    attention: count('attention'),
    waiting: count('waiting'),
    confirmed: count('confirmed'),
    completedRecently: rides.filter((r) => r.status === 'COMPLETED' && !!r.completedAt && new Date(r.completedAt).getTime() >= since).length,
  }
}

export type ActionUrgency = 'urgent' | 'soon'

export interface ActionItem {
  ride: Ride
  urgency: ActionUrgency
  title: string
  reason: string
}

// Work staff should look at: rides that need them now, then waiting rides with a pickup coming up.
export function actionItems(rides: Ride[], now: Date): ActionItem[] {
  const urgent: ActionItem[] = rides
    .filter((r) => !isFinished(r) && needsAction(r, now))
    .sort(byPickup)
    .map((ride) => ({ ride, urgency: 'urgent', title: actionTitle(ride, now)!, reason: actionReason(ride, now)! }))

  const soon: ActionItem[] = rides
    .filter((r) => {
      if (!inView(r, 'waiting', now) || r.type !== 'SCHEDULED') return false
      const until = new Date(r.pickupTime).getTime() - now.getTime()
      return until <= SOON_MS
    })
    .sort(byPickup)
    .map((ride) => ({
      ride,
      urgency: 'soon',
      title: 'Still waiting for a driver',
      reason: `Pickup ${countdown(new Date(ride.pickupTime).getTime(), now.getTime())}. We're still asking drivers.`,
    }))

  return [...urgent, ...soon]
}

export type ActivityKind = 'REQUESTED' | 'CONFIRMED' | 'PICKED_UP' | 'COMPLETED' | 'NO_SHOW' | 'TRANSIT' | 'EXPIRED' | 'CANCELLED'

export interface ActivityItem {
  id: string
  ride: Ride
  kind: ActivityKind
  at: string
}

// The latest things that happened to the organization's rides, newest first.
// Read from each ride's own timestamps, so a step a driver took back is not shown.
export function recentActivity(rides: Ride[], limit: number): ActivityItem[] {
  const items: ActivityItem[] = []
  const add = (ride: Ride, kind: ActivityKind, at: string | undefined) => {
    if (at) items.push({ id: `${ride.id}:${kind}`, ride, kind, at })
  }
  for (const r of rides) {
    add(r, 'REQUESTED', r.createdAt)
    add(r, 'CONFIRMED', r.acceptedAt)
    add(r, 'PICKED_UP', r.pickedUpAt)
    if (r.status === 'COMPLETED') add(r, 'COMPLETED', r.completedAt)
    if (r.status === 'NO_SHOW') add(r, 'NO_SHOW', r.cancelledAt)
    if (r.status === 'CANCELLED') add(r, isSentOnTransit(r) ? 'TRANSIT' : r.expired ? 'EXPIRED' : 'CANCELLED', r.cancelledAt)
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

export const ACTIVITY_TEXT: Record<ActivityKind, string> = {
  REQUESTED: 'Ride requested',
  CONFIRMED: 'Driver confirmed',
  PICKED_UP: 'Client picked up',
  COMPLETED: 'Ride completed',
  NO_SHOW: "Client didn't show",
  TRANSIT: 'Sent on transit',
  EXPIRED: 'No driver found',
  CANCELLED: 'Ride cancelled',
}

// A short reference staff can read out or search for. Not a secret: it is part of the ride's id.
export function requestReference(rideId: string): string {
  return rideId.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()
}

// Matches a ride by where it's going or its reference. Rider names are left out on purpose.
export function matchesQuery(r: Ride, query: string): boolean {
  const q = query.trim().replace(/^#/, '').toLowerCase()
  if (!q) return true
  return [r.destinationName, r.destinationAddress, requestReference(r.id)].some((s) => s.toLowerCase().includes(q))
}
