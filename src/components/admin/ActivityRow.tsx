import { BadgeCheck, Building2, Car, CircleX, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { adminPaths } from '../../admin/paths'
import { useAdmin } from '../../hooks/useAdmin'
import type { AdminEvent, AdminEventKind } from '../../logic/adminSummary'
import { focusRing } from '../workspace/styles'
import { timeAgo } from '../../logic/formatTime'

const LOOK: Record<AdminEventKind, { icon?: LucideIcon; tone: string }> = {
  REGISTERED: { tone: 'bg-brand-50 text-rc-blue' },
  APPROVED: { icon: BadgeCheck, tone: 'bg-emerald-50 text-emerald-800' },
  REJECTED: { icon: CircleX, tone: 'bg-slate-100 text-slate-600' },
}

// One registration or review decision: who, what happened, by whom, and when
export function ActivityRow({ event, now, compact }: { event: AdminEvent; now: number; compact?: boolean }) {
  const { orgName, driverName, personName, drivers } = useAdmin()
  const isOrg = event.subject === 'ORGANIZATION'
  const name = (isOrg ? orgName(event.subjectId) : driverName(event.subjectId)) ?? (isOrg ? 'An organization' : 'A driver')
  const actor = personName(event.actorId)
  const look = LOOK[event.kind]
  const Icon = look.icon ?? (isOrg ? Building2 : Car)
  const userId = isOrg ? undefined : drivers.data?.find((d) => d.id === event.subjectId)?.userId
  const to = isOrg ? adminPaths.organization(event.subjectId) : userId ? adminPaths.user(userId) : adminPaths.users

  const what = {
    REGISTERED: isOrg ? 'Organization registered' : 'Driver signed up',
    APPROVED: isOrg ? 'Organization approved' : 'Driver approved',
    REJECTED: isOrg ? 'Organization not approved' : 'Driver not approved',
  }[event.kind]

  return (
    <li>
      <Link to={to} className={`flex items-center gap-3 px-5 ${compact ? 'py-3' : 'py-3.5'} transition hover:bg-slate-50 ${focusRing} focus-visible:ring-inset`}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${look.tone}`} aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-rc-navy">{name}</span>
          <span className="block truncate text-sm text-slate-600">
            {what}
            {event.kind !== 'REGISTERED' && (actor ? ` by ${actor}` : ' by an admin')}
          </span>
        </span>
        <time dateTime={event.at} title={new Date(event.at).toLocaleString()} className="shrink-0 text-xs font-medium text-slate-500">
          {timeAgo(event.at, now)}
        </time>
      </Link>
    </li>
  )
}
