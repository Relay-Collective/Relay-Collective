import { ArrowRight, BadgeCheck, CircleX, Clock, Info, MapPin, UsersRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/workspace/PageHeader'
import { ModuleBadge, ModuleIconTile } from '../../components/workspace/ServiceModuleCard'
import { Skeleton } from '../../components/workspace/states'
import { OrganizationVisibilitySettings } from '../../components/membership/OrganizationVisibilitySettings'
import { RoleBadge } from '../../components/membership/MemberRoleSelector'
import { panel, panelHead, panelLink, panelTitle } from '../../components/workspace/styles'
import { useApp } from '../../hooks/useApp'
import { useWorkspace } from '../../hooks/useWorkspace'
import type { VerificationStatus } from '../../types'
import { ACTIVE_MODULES } from '../../workspace/modules'
import { paths } from '../../workspace/paths'

const VERIFICATION: Record<VerificationStatus, { text: string; icon: typeof BadgeCheck; className: string }> = {
  APPROVED: { text: 'Verified', icon: BadgeCheck, className: 'bg-emerald-50 text-emerald-800' },
  PENDING: { text: 'Waiting for approval', icon: Clock, className: 'bg-sun-100 text-amber-900' },
  REJECTED: { text: 'Not approved', icon: CircleX, className: 'bg-red-50 text-red-800' },
}

// Who the organization is, where its rides start, who can find it, and a way to its team.
// The registered details are read-only: they're set when the organization registers.
export function OrganizationProfile() {
  const { currentUser } = useApp()
  const { org, house, orgRole, isAdmin, pendingJoinRequests } = useWorkspace()
  if (!currentUser) return null

  const verification = org && VERIFICATION[org.status]

  return (
    <div className="space-y-6">
      <PageHeader title="Organization profile" description="Your organization's details on Relay Collective, as registered." />

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="profile-title" className={panel}>
          <div className={panelHead}>
            <h2 id="profile-title" className={panelTitle}>
              Profile
            </h2>
            {verification && (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${verification.className}`}>
                <verification.icon className="h-3.5 w-3.5" aria-hidden />
                {verification.text}
              </span>
            )}
          </div>
          <Details
            rows={[
              ['Organization name', org?.name],
              ['Type', org && 'Partner organization'],
              ['Contact person', org?.contactName],
              ['Contact phone', org?.contactPhone],
              ['Hears about new bookings', org && (org.bookingNotifications || 'Not set')],
            ]}
            loading={!org}
          />
        </section>

        <section aria-labelledby="location-title" className={panel}>
          <div className={panelHead}>
            <h2 id="location-title" className={`${panelTitle} flex items-center gap-2`}>
              <MapPin className="h-4 w-4 text-rc-teal-ink" aria-hidden /> Service location
            </h2>
            <Link to={paths.destinations} className={panelLink}>
              Saved destinations <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          {currentUser.houseId ? (
            <Details
              rows={[
                ['Name', house?.name],
                ['Address', house && `${house.address}${house.city && !house.address.includes(house.city) ? `, ${house.city}` : ''}`],
                ['Phone', house?.phone],
              ]}
              loading={!house}
              note="Every ride your organization requests starts here."
            />
          ) : (
            <p className="px-5 py-4 text-sm text-slate-600">No location is set up yet. Ask the Relay Collective team to add one before you request rides.</p>
          )}
        </section>

        <section aria-labelledby="org-services-title" className={panel}>
          <div className={panelHead}>
            <h2 id="org-services-title" className={panelTitle}>
              Modules
            </h2>
            <Link to={paths.services} className={panelLink}>
              All modules <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {ACTIVE_MODULES.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-5 py-3">
                <ModuleIconTile module={m} size="sm" />
                <span className="min-w-0 flex-1">
                  <Link to={m.route} className="font-semibold text-rc-navy hover:underline">
                    {m.name}
                  </Link>
                  <span className="block text-sm text-slate-500">{m.category}</span>
                </span>
                <ModuleBadge status="active" />
              </li>
            ))}
          </ul>
        </section>

        <OrganizationVisibilitySettings org={org} isAdmin={isAdmin} />

        <section aria-labelledby="team-link-title" className={`${panel} lg:col-span-2`}>
          <div className={panelHead}>
            <h2 id="team-link-title" className={`${panelTitle} flex items-center gap-2`}>
              <UsersRound className="h-4 w-4 text-rc-blue" aria-hidden /> Team
            </h2>
            <Link to={paths.team} className={panelLink}>
              {isAdmin ? 'Manage team' : 'View team'} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm text-slate-600">
            {orgRole && (
              <span className="inline-flex items-center gap-2">
                Your role: <RoleBadge role={orgRole} />
              </span>
            )}
            {isAdmin && !!pendingJoinRequests && (
              <Link to={paths.teamTab('requests')} className="font-semibold text-rc-blue hover:underline">
                {pendingJoinRequests} {pendingJoinRequests === 1 ? 'request' : 'requests'} to join waiting for review
              </Link>
            )}
          </div>
        </section>
      </div>

      <p className="flex items-start gap-2 text-sm text-slate-500">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Editing your registered details isn't available in the workspace yet. If something here is out of date, let the Relay Collective team know.
      </p>
    </div>
  )
}

function Details({ rows, loading, note }: { rows: [label: string, value: ReactNode][]; loading: boolean; note?: string }) {
  return (
    <div className="px-5 py-4">
      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="font-medium text-slate-500">{label}</dt>
            <dd className="break-words text-rc-navy">{loading ? <Skeleton className="h-4 w-36" /> : value || '—'}</dd>
          </div>
        ))}
      </dl>
      {note && <p className="mt-4 text-sm text-slate-500">{note}</p>}
    </div>
  )
}
