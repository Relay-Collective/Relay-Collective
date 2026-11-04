import { ArrowRight, BadgeCheck, Building2, Car, Check, ChevronRight, CircleCheck, ClipboardCheck, Flag, History, MessagesSquare, Route, TriangleAlert, Truck, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { adminPaths } from '../../admin/paths'
import { DateText } from '../../components/admin/controls'
import { ActivityRow } from '../../components/admin/ActivityRow'
import { VerificationBadge } from '../../components/admin/VerificationBadge'
import { MetricCard, MetricGroup } from '../../components/workspace/MetricCard'
import { PageHeader } from '../../components/workspace/PageHeader'
import { ModuleBadge, ModuleIconTile, PlannedModuleCard } from '../../components/workspace/ServiceModuleCard'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { focusRing, panel, panelHead, panelLink, panelTitle, sectionTitle } from '../../components/workspace/styles'
import { useAdmin } from '../../hooks/useAdmin'
import { useNow } from '../../hooks/useNow'
import { approvalQueue, platformMetrics, recentIssues, registrationActivity, reportedIssues, rideStage } from '../../logic/adminSummary'
import { formatDayTime } from '../../logic/formatTime'
import { CARERIDE, PLANNED_MODULES } from '../../workspace/modules'

const ATTENTION_LIMIT = 8
const ACTIVITY_LIMIT = 8

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

interface Task {
  id: string
  type: string
  icon: ReactNode
  subject: string
  detail?: string
  status: ReactNode
  at?: string
  to: string
  action: string
  urgent?: boolean // a ride with no driver: someone is waiting, so it leads the list and reads red
}

// The admin's landing page: what needs a decision, how the network is doing, and what changed lately
export function AdminOverview() {
  const { orgs, drivers, accounts, rides, feedback, feedbackSummary, personName, orgName, driverName } = useAdmin()
  const now = useNow()

  const core = orgs.data && drivers.data && accounts.data && rides.data
  const coreError = !core && (orgs.error || drivers.error || accounts.error || rides.error)
  const metrics = core ? platformMetrics({ orgs: orgs.data!, drivers: drivers.data!, accounts: accounts.data!, rides: rides.data! }) : undefined

  const tasks: Task[] = []
  if (orgs.data && drivers.data) {
    for (const item of approvalQueue(orgs.data, drivers.data)) {
      const isOrg = item.subject === 'ORGANIZATION'
      const driver = isOrg ? undefined : drivers.data.find((d) => d.id === item.id)
      tasks.push({
        id: `review:${item.id}`,
        type: isOrg ? 'Organization registration' : 'Driver verification',
        icon: isOrg ? <Building2 className="h-4 w-4" /> : <Car className="h-4 w-4" />,
        subject: (isOrg ? orgName(item.id) : personName(driver?.userId)) ?? 'Unnamed applicant',
        status: <VerificationBadge status={item.status} />,
        at: item.submittedAt,
        to: adminPaths.review(isOrg ? 'organizations' : 'drivers', item.id),
        action: 'Review',
      })
    }
  }
  if (feedback.data) {
    for (const issue of recentIssues(reportedIssues(feedback.data, rides.data ?? []), new Date(now))) {
      tasks.push({
        id: `issue:${issue.id}`,
        type: issue.kind === 'DRIVER_FLAG' ? 'Issue flagged by a driver' : 'Ride rated poorly by staff',
        icon: <Flag className="h-4 w-4" />,
        subject: orgName(issue.feedback.orgId) ?? 'Partner organization',
        detail: issue.kind === 'DRIVER_FLAG' ? driverName(issue.feedback.driverId) : undefined,
        status: <span className="text-xs font-semibold text-amber-800">Reported</span>,
        at: issue.feedback.at,
        to: adminPaths.issues,
        action: 'View issue',
      })
    }
  }
  if (rides.data) {
    const stuck = rides.data.filter((x) => rideStage(x) === 'noDriver').sort((a, b) => a.pickupTime.localeCompare(b.pickupTime))
    for (const r of stuck) {
      tasks.push({
        id: `ride:${r.id}`,
        type: 'Transportation · no driver available',
        icon: <Truck className="h-4 w-4" />,
        subject: orgName(r.orgId) ?? 'Partner organization',
        detail: `To ${r.destinationName}, ${formatDayTime(r.pickupTime)}`,
        status: (
          <span className="inline-flex items-center gap-1 rounded-full bg-care-red px-2 py-0.5 text-xs font-bold text-white">
            <TriangleAlert className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            No driver available
          </span>
        ),
        urgent: true,
        at: r.createdAt,
        to: adminPaths.ride(r.id),
        action: 'View ride',
      })
    }
  }
  // Feedback & Suggestions waiting for a first look: one line for all of it, opening the filtered inbox
  const newFeedback = feedbackSummary.data?.new ?? 0
  if (newFeedback > 0) {
    tasks.push({
      id: 'feedback:new',
      type: 'Feedback & suggestions',
      icon: <MessagesSquare className="h-4 w-4" />,
      subject: plural(newFeedback, 'new submission', 'new submissions'),
      status: <span className="text-xs font-semibold text-amber-800">Not reviewed yet</span>,
      to: `${adminPaths.feedback}?status=new`,
      action: 'Review',
    })
  }
  // Nothing goes quiet: rides without a driver lead, so the list limit can never push them out of view
  tasks.sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent))
  const urgentCount = tasks.filter((t) => t.urgent).length
  const tasksLoading = !orgs.data || !drivers.data

  const activity = orgs.data && drivers.data ? registrationActivity(orgs.data, drivers.data).slice(0, ACTIVITY_LIMIT) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Monitor the organizations, services, and activity across Relay Collective."
      />

      <section aria-labelledby="metrics-title">
        <h2 id="metrics-title" className="sr-only">
          Platform metrics
        </h2>
        {coreError && (
          <div className={`${panel} mb-3`}>
            <SectionError message="We couldn't load the platform totals. Please try again." />
          </div>
        )}
        <MetricGroup className="grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="Organizations"
            value={metrics?.organizations}
            hint={metrics ? `${plural(metrics.partnerOrgs, 'partner', 'partners')} · ${plural(metrics.providers, 'provider', 'providers')}` : 'Partners and providers'}
            icon={Building2}
            to={adminPaths.organizations}
          />
          <MetricCard
            label="Pending approvals"
            value={metrics && metrics.pendingOrgs + metrics.pendingDrivers}
            hint={metrics ? `${plural(metrics.pendingOrgs, 'organization', 'organizations')} · ${plural(metrics.pendingDrivers, 'driver', 'drivers')}` : 'Waiting for a decision'}
            icon={ClipboardCheck}
            to={adminPaths.approvals}
            alert="amber"
          />
          <MetricCard label="Registered users" value={metrics?.accounts} hint="People who can sign in" icon={Users} to={adminPaths.users} />
          <MetricCard label="Verified drivers" value={metrics?.verifiedDrivers} hint="Can get ride requests" icon={BadgeCheck} to={`${adminPaths.users}?role=DRIVER`} />
          <MetricCard
            label="Active ride requests"
            value={metrics?.activeRides}
            hint="Transportation, not yet finished"
            icon={Route}
            to={adminPaths.transportation}
          />
          <MetricCard
            label="Completed rides"
            value={metrics?.completedRides}
            hint="Transportation, all time"
            icon={CircleCheck}
            to={`${adminPaths.transportation}?stage=completed`}
          />
        </MetricGroup>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5 xl:items-start">
        <section aria-labelledby="attention-title" className={`${panel} xl:col-span-3`}>
          <div className={panelHead}>
            <h2 id="attention-title" className={`${panelTitle} flex items-center gap-2`}>
              Requires attention
              {tasks.length > 0 && (
                <span className={`rounded-full px-2 py-0.5 font-sans text-xs font-bold tabular-nums ${urgentCount ? 'bg-care-red text-white' : 'bg-sun-400 text-ink'}`}>
                  {tasks.length}
                  {urgentCount > 0 && <span className="sr-only">, {urgentCount} urgent</span>}
                </span>
              )}
            </h2>
            <Link to={adminPaths.approvals} className={panelLink}>
              Approvals <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          {tasksLoading && !(orgs.error || drivers.error) ? (
            <SkeletonRows rows={3} label="Loading tasks" />
          ) : orgs.error && !orgs.data ? (
            <SectionError message="We couldn't load what needs attention. Please try again." />
          ) : tasks.length === 0 ? (
            <EmptyState compact icon={<Check strokeWidth={2.5} />} title="Nothing needs attention." text="No applications are waiting, and no recent issues were reported." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.slice(0, ATTENTION_LIMIT).map((t) => (
                <li key={t.id}>
                  <Link to={t.to} className={`group flex items-center gap-3 px-5 py-3.5 transition-colors duration-150 ease-out-quart ${t.urgent ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50'} ${focusRing} focus-visible:ring-inset focus-visible:ring-offset-0`}>
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${t.urgent ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`} aria-hidden>
                      {t.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-slate-500">{t.type}</span>
                      <span className="block truncate font-semibold text-rc-navy">{t.subject}</span>
                      {t.detail && <span className="block truncate text-sm text-slate-600">{t.detail}</span>}
                      <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                        {t.status}
                        {t.at && <DateText at={t.at} />}
                      </span>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-rc-blue">
                      <span className="max-sm:sr-only">{t.action}</span>
                      <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {tasks.length > ATTENTION_LIMIT && (
            <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600">
              {tasks.length - ATTENTION_LIMIT} more. Open{' '}
              <Link to={adminPaths.approvals} className="font-semibold text-rc-blue hover:underline">
                Approvals
              </Link>{' '}
              or{' '}
              <Link to={adminPaths.issues} className="font-semibold text-rc-blue hover:underline">
                Issues
              </Link>{' '}
              to see everything.
            </p>
          )}
        </section>

        <section aria-labelledby="activity-title" className={`${panel} xl:col-span-2`}>
          <div className={panelHead}>
            <div>
              <h2 id="activity-title" className={panelTitle}>
                Recent platform activity
              </h2>
              <p className="text-sm text-slate-500">Registrations and review decisions</p>
            </div>
            <Link to={adminPaths.activity} className={panelLink}>
              All activity <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          {!activity ? (
            orgs.error || drivers.error ? <SectionError /> : <SkeletonRows rows={4} label="Loading activity" />
          ) : activity.length === 0 ? (
            <EmptyState compact tone="neutral" icon={<History />} title="No recorded activity yet" text="Registrations and review decisions will appear here." />
          ) : (
            <ol className="divide-y divide-slate-100">
              {activity.map((e) => (
                <ActivityRow key={e.id} event={e} now={now} compact />
              ))}
            </ol>
          )}
        </section>
      </div>

      <section aria-labelledby="services-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="services-title" className={sectionTitle}>
              Service overview
            </h2>
            <p className="mt-1 text-[15px] text-slate-600">Modules on the platform. CareRide, for transportation, is the only one in use today.</p>
          </div>
          <Link to={adminPaths.services} className={panelLink}>
            All services <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start">
          <article className={`${panel} p-5`}>
            <div className="flex items-start justify-between gap-3">
              <ModuleIconTile module={CARERIDE} />
              <ModuleBadge status="active" />
            </div>
            <h3 className="mt-4 font-heading text-lg font-bold text-rc-navy">{CARERIDE.name}</h3>
            <p className="text-sm font-medium text-slate-500">{CARERIDE.tagline}</p>
            <p className="mt-1 text-sm text-slate-600">The existing MVP: partner organizations request rides, verified drivers accept them.</p>
            {metrics && (
              <p className="mt-3 text-sm text-slate-700">
                <strong className="font-semibold text-rc-navy">{plural(metrics.activeRides, 'active request', 'active requests')}</strong> ·{' '}
                {plural(metrics.verifiedDrivers, 'verified driver', 'verified drivers')}
              </p>
            )}
            <Link to={adminPaths.transportation} className={`${panelLink} -ml-2 mt-3`}>
              Manage CareRide <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </article>
          <div className="grid gap-3">
            {PLANNED_MODULES.map((m) => (
              <PlannedModuleCard key={m.id} module={m} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
