import { ArrowRight, Building2, CalendarPlus, Check, CircleAlert, CircleCheck, Clock, History, Inbox, MapPin, Route, TriangleAlert, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NextPickup } from '../../modules/careride'
import { ActionRequiredList } from '../../components/workspace/ActionRequiredList'
import { MetricCard, MetricGroup } from '../../components/workspace/MetricCard'
import { PageHeader } from '../../components/workspace/PageHeader'
import { QuickActions, type QuickAction } from '../../components/workspace/QuickActions'
import { RecentActivityList } from '../../components/workspace/RecentActivityList'
import { RoleBadge } from '../../components/membership/MemberRoleSelector'
import { ActiveModuleFeature, PlannedModuleCard } from '../../components/workspace/ServiceModuleCard'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { panel, panelHead, panelLink, panelTitle } from '../../components/workspace/styles'
import { primaryButton } from '../../components/ui'
import { useApp } from '../../hooks/useApp'
import { useNow } from '../../hooks/useNow'
import { useWorkspace } from '../../hooks/useWorkspace'
import { actionItems, byPickup, COMPLETED_WINDOW_DAYS, isFinished, needsAction, recentActivity, requestMetrics } from '../../modules/careride/domain'
import type { House, Organization, User } from '../../types'
import { CARERIDE, FEATURED_PLANNED } from '../../workspace/modules'
import { paths } from '../../workspace/paths'
import { greetingFor } from '../../logic/formatTime'

const ACTION_LIMIT = 5
const ACTIVITY_LIMIT = 8

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// A partner organization's account is shared and often named after the organization or its house.
// Greet a person by first name, but don't greet "Belkin House" as "Belkin".
function greetingName(user: User, org?: Organization, house?: House): string | undefined {
  const name = user.name.trim()
  const shared = [org?.name, house?.name].some((n) => n && n.trim().toLowerCase() === name.toLowerCase())
  return name && !shared ? name.split(/\s+/)[0] : undefined
}

// The organization's home on the platform: who it is, what needs attention, the modules it works in
// (CareRide, with how its rides are going, and what's planned), then recent activity and shortcuts.
export function Overview() {
  const { currentUser } = useApp()
  const { org, house, rides, driverOf, orgRole, isAdmin } = useWorkspace()
  const now = useNow()
  if (!currentUser) return null

  const nowDate = new Date(now)
  const all = rides.data
  const metrics = all && requestMetrics(all, nowDate)
  const actions = all ? actionItems(all, nowDate) : []
  const activity = all ? recentActivity(all, ACTIVITY_LIMIT) : []
  const loading = !all && !rides.error
  const failed = !all && !!rides.error

  const name = greetingName(currentUser, org, house)
  const greeting = greetingFor(nowDate.getHours())
  const date = nowDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })

  const quickActions: QuickAction[] = [
    { to: paths.newRide, label: 'Request a ride', detail: 'Book transportation for someone you support', icon: CalendarPlus },
    { to: paths.requests, label: 'View requests', detail: metrics ? plural(metrics.open, 'open request', 'open requests') : 'Every request in one list', icon: Inbox },
    { to: paths.destinations, label: 'Saved destinations', detail: 'Places your clients often go', icon: MapPin },
    { to: paths.organization, label: 'Organization profile', detail: 'Details, location, and access', icon: Building2 },
    { to: paths.team, label: isAdmin ? 'Manage team' : 'View team', detail: isAdmin ? 'Members, requests, and invitations' : 'Who works in this workspace', icon: UsersRound },
  ]

  // The ride staff will be asked about next, chosen the same way as on the transportation home:
  // one already under way first, then by pickup time. Shown only when there is one.
  const next = (all ?? [])
    .filter((r) => !needsAction(r, nowDate) && !isFinished(r))
    .sort((a, b) => Number(b.status === 'PICKED_UP') - Number(a.status === 'PICKED_UP') || byPickup(a, b))[0]

  return (
    <div className="space-y-8">
      <div className="mb-7">
        <PageHeader
          title={name ? `${greeting}, ${name}.` : `${greeting}.`}
          eyebrow={date}
          description="Here's what's happening across your organization."
        />
        {/* The organization at a glance: whose workspace this is, where rides start, and this person's role in it */}
        <dl className="-mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-600">
          <div className="flex min-w-0 items-center gap-1.5">
            <dt className="sr-only">Organization</dt>
            <Building2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <dd className="min-w-0 truncate font-semibold text-rc-navy">{org?.name ?? 'Your organization'}</dd>
          </div>
          {house && house.name.trim().toLowerCase() !== org?.name.trim().toLowerCase() && (
            <div className="flex min-w-0 items-center gap-1.5">
              <dt className="sr-only">Pickup location</dt>
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
              <dd className="min-w-0 truncate">{house.name}</dd>
            </div>
          )}
          {orgRole && (
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Your role</dt>
              <dd>
                <RoleBadge role={orgRole} />
              </dd>
            </div>
          )}
        </dl>
      </div>

      {!currentUser.houseId && (
        <p role="note" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-sun-50 p-4 text-sm text-amber-900">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          This account has no pickup location yet, so it can't request rides. Ask the Relay Collective team to add one.
        </p>
      )}

      {/* First: anything that needs staff. A clear day takes one quiet line, so the space goes to real work. */}
      <section aria-labelledby="action-title" className={`${panel} overflow-hidden ${actions.length > 0 ? 'border-red-200' : ''}`}>
        {actions.length > 0 || loading || failed ? (
          <>
            <div className={`${panelHead} ${actions.length > 0 ? 'border-red-100 bg-red-50/60' : ''}`}>
              <h2 id="action-title" className={`${panelTitle} flex items-center gap-2`}>
                {actions.length > 0 && <TriangleAlert className="h-[18px] w-[18px] text-red-700" aria-hidden />}
                Needs your attention
                {actions.length > 0 && (
                  <span className="rounded-full bg-care-red px-2 py-0.5 font-sans text-xs font-bold tabular-nums text-white">{actions.length}</span>
                )}
              </h2>
              {actions.length > ACTION_LIMIT && (
                <Link to={`${paths.requests}?view=attention`} className={panelLink}>
                  View all <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </div>
            {loading ? (
              <SkeletonRows rows={2} label="Loading requests that need attention" />
            ) : failed ? (
              <SectionError />
            ) : (
              <ActionRequiredList items={actions} now={now} limit={ACTION_LIMIT} />
            )}
          </>
        ) : (
          <>
            <h2 id="action-title" className="sr-only">
              Needs your attention
            </h2>
            <EmptyState compact icon={<Check strokeWidth={2.5} />} title="You're all caught up." text="No transportation requests need attention right now." />
          </>
        )}
      </section>

      {/* The modules this organization works in. CareRide leads with its live numbers; planned modules are
          labelled, quieter, and have no way in, so they never read as something to open. */}
      <section aria-labelledby="modules-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 id="modules-title" className="font-heading text-xl font-bold tracking-[-0.02em] text-rc-navy">
              Your modules
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">Everything your organization needs to coordinate community support, all in one place.</p>
          </div>
          <Link to={paths.services} className={`${panelLink} -mr-2`}>
            All modules <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <ActiveModuleFeature module={CARERIDE} headingId="careride-title">
            {failed && <p className="border-t border-slate-200 px-5 py-3 text-sm text-red-700 sm:px-6">Couldn't load these numbers.</p>}
            <MetricGroup bare className="grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Need attention"
                value={metrics?.attention}
                hint={metrics?.attention ? 'Open them to resolve' : 'Nothing waiting on you'}
                icon={CircleAlert}
                to={`${paths.requests}?view=attention`}
                alert
              />
              <MetricCard label="Awaiting a driver" value={metrics?.waiting} hint="Drivers are being asked" icon={Clock} to={`${paths.requests}?view=waiting`} />
              <MetricCard
                label="Confirmed or under way"
                value={metrics?.confirmed}
                hint="A driver has accepted"
                icon={Route}
                to={`${paths.requests}?view=confirmed`}
              />
              <MetricCard
                label="Completed"
                value={metrics?.completedRecently}
                hint={`In the last ${COMPLETED_WINDOW_DAYS} days`}
                icon={CircleCheck}
                to={`${paths.requests}?view=past`}
              />
            </MetricGroup>
          </ActiveModuleFeature>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2">
            {FEATURED_PLANNED.map((m) => (
              <PlannedModuleCard key={m.id} module={m} short />
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <section aria-labelledby="activity-title" className={`${panel} lg:col-span-2`}>
          <div className={panelHead}>
            <div>
              <h2 id="activity-title" className={panelTitle}>
                Recent activity
              </h2>
              <p className="text-sm text-slate-500">CareRide requests, as each ride last changed</p>
            </div>
            {activity.length > 0 && (
              <Link to={paths.requests} className={panelLink}>
                All requests <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            )}
          </div>
          {loading ? (
            <SkeletonRows rows={4} label="Loading recent activity" />
          ) : failed ? (
            <SectionError />
          ) : activity.length === 0 ? (
            <EmptyState
              icon={<History className="h-6 w-6" />}
              title="No transportation activity yet"
              text="Your organization hasn't created any transportation requests yet."
              action={
                currentUser.houseId && (
                  <Link to={paths.newRide} className={primaryButton}>
                    <CalendarPlus className="h-5 w-5" aria-hidden /> Request a ride
                  </Link>
                )
              }
            />
          ) : (
            <RecentActivityList items={activity} now={now} />
          )}
        </section>

        {/* Phones: today's ride and the shortcuts come before the activity log */}
        <div className="space-y-6 max-lg:order-first">
          {next && <NextPickup ride={next} driverName={driverOf(next)?.name} vehicle={driverOf(next)?.vehicle} now={now} />}
          <section aria-labelledby="quick-title" className={panel}>
            <div className={panelHead}>
              <h2 id="quick-title" className={panelTitle}>
                Quick actions
              </h2>
            </div>
            <QuickActions actions={quickActions} />
          </section>
        </div>
      </div>
    </div>
  )
}
