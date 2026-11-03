import type { Ride } from '../../../types'
import { faresSavedFor } from '../../../logic/estimateFare'
import { startOfDay } from '../../../logic/formatTime'
import { isDriverLate, wasDropped } from './rideAlerts'

const DAY = 24 * 60 * 60_000

export const FINISHED: Ride['status'][] = ['COMPLETED', 'NO_SHOW', 'CANCELLED']

export const isFinished = (r: Ride) => FINISHED.includes(r.status)

// A ride staff should look at now: nobody took it, its driver dropped it, or its driver is late.
export const needsAction = (r: Ride, now?: Date) => r.status === 'NEEDS_ATTENTION' || wasDropped(r) || isDriverLate(r, now)

const NO_DRIVER_OPTIONS = 'Ask drivers again, change the time, or send on transit'

// What happened, in a few words, or undefined if the ride doesn't need staff.
export function actionTitle(r: Ride, now?: Date): string | undefined {
  if (isDriverLate(r, now)) return 'Driver is late'
  if (r.status === 'NEEDS_ATTENTION') return 'No driver available'
  if (wasDropped(r)) return "Driver can't make it"
  return undefined
}

// One line on what happened and what's next, or undefined if the ride doesn't need staff.
export function actionReason(r: Ride, now?: Date): string | undefined {
  if (isDriverLate(r, now)) return "The driver hasn't arrived yet. Give them a call"
  if (r.status === 'NEEDS_ATTENTION') return wasDropped(r) ? `The driver can't make it. ${NO_DRIVER_OPTIONS}` : NO_DRIVER_OPTIONS
  if (wasDropped(r)) return "The driver can't make it. We're asking others"
  return undefined
}

export const finishedAt = (r: Ride) => r.completedAt ?? r.cancelledAt ?? r.pickupTime

export const byPickup = (a: Ride, b: Ride) => a.pickupTime.localeCompare(b.pickupTime)

export interface PartnerStats {
  today: number // rides picking up today, not cancelled
  upcoming: number // not finished, picking up from now on
  completed: number
  faresSaved: number // dollars: completed rides × one-zone bus fare
}

export function partnerStats(rides: Ride[], now: number): PartnerStats {
  const todayStart = startOfDay(now)
  const pickup = (r: Ride) => new Date(r.pickupTime).getTime()
  const completed = rides.filter((r) => r.status === 'COMPLETED')
  return {
    today: rides.filter((r) => r.status !== 'CANCELLED' && pickup(r) >= todayStart && pickup(r) < todayStart + DAY).length,
    upcoming: rides.filter((r) => !isFinished(r)).length,
    completed: completed.length,
    faresSaved: faresSavedFor(completed.length),
  }
}

export interface DayCount {
  start: number // ms, start of the day
  count: number
}

// Rides per day by pickup time, from `before` days ago to `after` days ahead, oldest first. Cancelled rides don't count.
export function ridesPerDay(rides: Ride[], now: number, before: number, after: number): DayCount[] {
  const today = new Date(startOfDay(now))
  const days: DayCount[] = []
  for (let i = -before; i <= after; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i) // by calendar date, so daylight saving can't shift a day
    days.push({ start: d.getTime(), count: 0 })
  }
  for (const r of rides) {
    if (r.status === 'CANCELLED') continue
    const day = days.find((d) => d.start === startOfDay(new Date(r.pickupTime).getTime()))
    if (day) day.count++
  }
  return days
}

export interface PlaceCount {
  name: string
  address: string
  count: number
  lastRideId: string // the most recent ride there, to book again from
}

// Where clients go most, by finished or booked rides (not cancelled). Ties go to the most recent.
export function topDestinations(rides: Ride[], limit: number): PlaceCount[] {
  const places = new Map<string, PlaceCount & { last: string }>()
  for (const r of rides) {
    if (r.status === 'CANCELLED' || r.returnOfRideId) continue // a return trip goes back home, not somewhere new
    const key = r.destinationId ?? r.destinationAddress
    const place = places.get(key)
    if (!place) {
      places.set(key, { name: r.destinationName, address: r.destinationAddress, count: 1, lastRideId: r.id, last: r.pickupTime })
    } else {
      place.count++
      if (r.pickupTime > place.last) Object.assign(place, { last: r.pickupTime, lastRideId: r.id })
    }
  }
  return [...places.values()]
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, limit)
    .map(({ name, address, count, lastRideId }) => ({ name, address, count, lastRideId }))
}

// "in 45 min", "in 2 h 10 min", "in 3 days", or "now" once it's due.
export function countdown(toMs: number, now: number): string {
  const minutes = Math.round((toMs - now) / 60_000)
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `in ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ''}`
  const days = Math.round((startOfDay(toMs) - startOfDay(now)) / DAY)
  return days === 1 ? 'tomorrow' : `in ${days} days`
}
