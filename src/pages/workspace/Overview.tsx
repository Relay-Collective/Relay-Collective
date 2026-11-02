import { ArrowRight, Building2, CalendarPlus, Check, ChevronRight, CircleAlert, CircleCheck, Clock, History, Inbox, MapPin, Route, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NextPickup } from '../../components/dashboard/NextPickup'
import { ActionRequiredList } from '../../components/workspace/ActionRequiredList'
import { MetricCard, MetricGroup } from '../../components/workspace/MetricCard'
import { PageHeader } from '../../components/workspace/PageHeader'
import { QuickActions, type QuickAction } from '../../components/workspace/QuickActions'
import { RecentActivityList } from '../../components/workspace/RecentActivityList'
import { AvailabilityPill } from '../../components/workspace/ServiceModuleCard'
import { EmptyState, SectionError, Skeleton, SkeletonRows } from '../../components/workspace/states'
import { focusRing, panel, panelHead, panelLink, panelTitle } from '../../components/workspace/styles'
import { primaryButton } from '../../components/ui'
import { useApp } from '../../hooks/useApp'
import { useNow } from '../../hooks/useNow'
import { useWorkspace } from '../../hooks/useWorkspace'
import { actionItems, COMPLETED_WINDOW_DAYS, recentActivity, requestMetrics } from '../../logic/requestSummary'
import { byPickup, greetingFor, isFinished, needsAction } from '../../logic/rideInsights'
import type { House, Organization, User } from '../../types'
import { LIVE_MODULES, PLANNED_MODULES } from '../../workspace/modules'
import { paths } from '../../workspace/paths'

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

// The organization's home: what needs attention, how requests are going, and the services it can use.
export function Overview() {
  const { currentUser } = useApp()
  const { org, house, rides, driverOf } = useWorkspace()
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
  ]

  const transport = LIVE_MODULES[0]
  // The ride staff will be asked about next, chosen the same way as on the transportation home:
  // one already under way first, then by pickup time. Shown only when there is one.
  const next = (all ?? [])
    .filter((r) => !needsAction(r, nowDate) && !isFinished(r))
    .sort((a, b) => Number(b.status === 'PICKED_UP') - Number(a.status === 'PICKED_UP') || byPickup(a, b))[0]

  return (
    <div className="space-y-8">
      <PageHeader
        title={name ? `${greeting}, ${name}.` : `${greeting}.`}
        eyebrow={date}
        description={org ? `Here's what's happening at ${org.name}.` : "Here's what's happening in your workspace."}
      />

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

      <section aria-labelledby="metrics-title">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="metrics-title" className={panelTitle}>
            Transportation requests
          </h2>
          {failed && <p className="text-sm text-red-700">Couldn't load these numbers.</p>}
        </div>
        <MetricGroup className="grid-cols-2 lg:grid-cols-4">
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
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <section aria-labelledby="activity-title" className={`${panel} lg:col-span-2`}>
          <div className={panelHead}>
            <div>
              <h2 id="activity-title" className={panelTitle}>
                Recent activity
              </h2>
              <p className="text-sm text-slate-500">Transportation requests, as each ride last changed</p>
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

          {/* Working services link in; planned ones are listed, labelled, and never look like something you can open */}
          <section aria-labelledby="services-title" className={panel}>
            <div className={panelHead}>
              <h2 id="services-title" className={panelTitle}>
                Your services
              </h2>
              <Link to={paths.services} className={panelLink}>
                All services <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            {transport && (
              <Link to={transport.to} className={`group flex items-center gap-3 px-5 py-4 transition-colors duration-150 ease-out-quart hover:bg-slate-50 ${focusRing} focus-visible:ring-inset focus-visible:ring-offset-0`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rc-mint text-rc-teal-ink" aria-hidden>
                  <transport.icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-rc-navy">{transport.name}</span>
                    <AvailabilityPill availability="live" />
                  </span>
                  <span className="mt-0.5 block text-sm text-slate-600">
                    {metrics ? (
                      <>
                        {plural(metrics.open, 'open request', 'open requests')}
                        {metrics.attention > 0 && <span className="font-semibold text-red-700"> · {metrics.attention} need attention</span>}
                      </>
                    ) : loading ? (
                      <Skeleton className="mt-1 h-4 w-28" />
                    ) : (
                      'Ride requests and trip progress'
                    )}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition duration-150 ease-out-quart group-hover:translate-x-0.5 group-hover:text-rc-navy" aria-hidden />
              </Link>
            )}
            <div className="border-t border-slate-100 px-5 pb-4 pt-3">
              <p className="text-[13px] font-semibold text-slate-500">On the roadmap</p>
              <ul className="mt-2 space-y-2.5">
                {PLANNED_MODULES.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 text-sm text-slate-600">
                    <m.icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{m.name}</span>
                    <AvailabilityPill availability="planned" />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
