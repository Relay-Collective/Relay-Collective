import type { Driver, Organization, Ride, RideFeedback, User, VerificationStatus } from '../types'
import { isFinished } from '../modules/careride/domain'

// What the platform admin console says about the network. Every number and list comes from records
// the backend already keeps; nothing here is estimated or filled in.

const DAY = 24 * 3_600_000

export const VERIFICATION_TEXT: Record<VerificationStatus, string> = {
  PENDING: 'Pending review',
  APPROVED: 'Approved',
  REJECTED: 'Not approved',
}

export type ReviewSubject = 'ORGANIZATION' | 'DRIVER'

export interface ApprovalItem {
  subject: ReviewSubject
  id: string
  status: VerificationStatus
  submittedAt?: string // missing on records made before registration dates were shown
}

// Everything waiting for a decision, oldest first, so nobody waits longest by accident
export function approvalQueue(orgs: Organization[], drivers: Driver[]): ApprovalItem[] {
  const items: ApprovalItem[] = [
    ...orgs.filter((o) => o.status === 'PENDING').map((o) => ({ subject: 'ORGANIZATION' as const, id: o.id, status: o.status, submittedAt: o.createdAt })),
    ...drivers.filter((d) => d.status === 'PENDING').map((d) => ({ subject: 'DRIVER' as const, id: d.id, status: d.status, submittedAt: d.createdAt })),
  ]
  return items.sort((a, b) => (a.submittedAt ?? '￿').localeCompare(b.submittedAt ?? '￿'))
}

// Decisions already made, most recent first
export function recentDecisions(orgs: Organization[], drivers: Driver[]): ApprovalItem[] {
  const decided = (x: Organization | Driver) => x.status !== 'PENDING' && !!x.reviewedAt
  return [
    ...orgs.filter(decided).map((o) => ({ subject: 'ORGANIZATION' as const, id: o.id, status: o.status, submittedAt: o.createdAt, at: o.reviewedAt! })),
    ...drivers.filter(decided).map((d) => ({ subject: 'DRIVER' as const, id: d.id, status: d.status, submittedAt: d.createdAt, at: d.reviewedAt! })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .map(({ subject, id, status, submittedAt }) => ({ subject, id, status, submittedAt }))
}

export type AdminEventKind = 'REGISTERED' | 'APPROVED' | 'REJECTED'

export interface AdminEvent {
  id: string
  kind: AdminEventKind
  subject: ReviewSubject
  subjectId: string
  at: string
  actorId?: string // the admin who decided
}

// Registrations and the latest review decision on each organization and driver, newest first.
// Only the latest decision is stored, so this is a record of where things stand, not a full audit log.
export function registrationActivity(orgs: Organization[], drivers: Driver[]): AdminEvent[] {
  const events: AdminEvent[] = []
  const add = (subject: ReviewSubject, x: Organization | Driver) => {
    if (x.createdAt) events.push({ id: `${x.id}:REGISTERED`, kind: 'REGISTERED', subject, subjectId: x.id, at: x.createdAt })
    if (x.reviewedAt && x.status !== 'PENDING') {
      const kind = x.status === 'APPROVED' ? 'APPROVED' : 'REJECTED'
      events.push({ id: `${x.id}:${kind}`, kind, subject, subjectId: x.id, at: x.reviewedAt, actorId: x.reviewedBy })
    }
  }
  orgs.forEach((o) => add('ORGANIZATION', o))
  drivers.forEach((d) => add('DRIVER', d))
  return events.sort((a, b) => b.at.localeCompare(a.at))
}

export type IssueKind = 'DRIVER_FLAG' | 'POOR_RATING'

export interface Issue {
  id: string
  kind: IssueKind
  feedback: RideFeedback
  ride?: Ride
}

// Problems people reported after a ride: a driver's flag, or staff saying it didn't go well. Newest first.
export function reportedIssues(feedback: RideFeedback[], rides: Ride[]): Issue[] {
  return feedback
    .filter((f) => f.authorRole === 'DRIVER' || f.rating === 'DOWN')
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((f) => ({ id: f.id, kind: f.authorRole === 'DRIVER' ? 'DRIVER_FLAG' : 'POOR_RATING', feedback: f, ride: rides.find((r) => r.id === f.rideId) }))
}

export const RECENT_ISSUE_DAYS = 14

export function recentIssues(issues: Issue[], now: Date): Issue[] {
  const since = now.getTime() - RECENT_ISSUE_DAYS * DAY
  return issues.filter((i) => new Date(i.feedback.at).getTime() >= since)
}

// The transportation module's ride stages, as an admin overseeing it would group them
export type RideStage = 'waiting' | 'noDriver' | 'scheduled' | 'underWay' | 'completed' | 'closed'

export function rideStage(r: Ride): RideStage {
  switch (r.status) {
    case 'SEARCHING':
    case 'OFFERED':
      return 'waiting'
    case 'NEEDS_ATTENTION':
      return 'noDriver'
    case 'ACCEPTED':
      return r.driverOnTheWayAt || r.driverArrivedAt ? 'underWay' : 'scheduled'
    case 'PICKED_UP':
      return 'underWay'
    case 'COMPLETED':
      return 'completed'
    default:
      return 'closed' // cancelled, sent on transit, or a no-show
  }
}

export const RIDE_STAGES: { id: RideStage; label: string }[] = [
  { id: 'waiting', label: 'Finding a driver' },
  { id: 'noDriver', label: 'No driver available' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'underWay', label: 'Under way' },
  { id: 'completed', label: 'Completed' },
  { id: 'closed', label: 'Cancelled or no-show' },
]

export function rideStageCounts(rides: Ride[]): Record<RideStage, number> {
  const counts: Record<RideStage, number> = { waiting: 0, noDriver: 0, scheduled: 0, underWay: 0, completed: 0, closed: 0 }
  for (const r of rides) counts[rideStage(r)]++
  return counts
}

export interface PlatformMetrics {
  organizations: number
  partnerOrgs: number
  providers: number
  pendingOrgs: number
  accounts: number // people who can sign in
  verifiedDrivers: number
  pendingDrivers: number
  activeRides: number // transportation requests not yet finished
  completedRides: number
}

export function platformMetrics(input: { orgs: Organization[]; drivers: Driver[]; accounts: User[]; rides: Ride[] }): PlatformMetrics {
  const { orgs, drivers, accounts, rides } = input
  return {
    organizations: orgs.length,
    partnerOrgs: orgs.filter((o) => o.type === 'PARTNER_ORG').length,
    providers: orgs.filter((o) => o.type === 'TRANSPORT_PROVIDER').length,
    pendingOrgs: orgs.filter((o) => o.status === 'PENDING').length,
    accounts: accounts.length,
    verifiedDrivers: drivers.filter((d) => d.status === 'APPROVED').length,
    pendingDrivers: drivers.filter((d) => d.status === 'PENDING').length,
    activeRides: rides.filter((r) => !isFinished(r)).length,
    completedRides: rides.filter((r) => r.status === 'COMPLETED').length,
  }
}

// Matches a record by any of the given fields, ignoring case and extra spaces
export function matches(query: string, ...fields: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase()
  return !q || fields.some((f) => f?.toLowerCase().includes(q))
}

export type SortDirection = 'asc' | 'desc'

// Sorts by text, putting missing values last whichever way
export function sortBy<T>(items: T[], key: (item: T) => string | undefined, direction: SortDirection): T[] {
  return [...items].sort((a, b) => {
    const x = key(a)
    const y = key(b)
    if (x === y) return 0
    if (x === undefined) return 1
    if (y === undefined) return -1
    return direction === 'asc' ? x.localeCompare(y) : y.localeCompare(x)
  })
}

export function page<T>(items: T[], pageIndex: number, size: number): { items: T[]; pages: number; index: number } {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const index = Math.min(Math.max(0, pageIndex), pages - 1)
  return { items: items.slice(index * size, index * size + size), pages, index }
}
