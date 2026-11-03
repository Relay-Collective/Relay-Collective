import { ArrowRight, CalendarCheck, CalendarClock, Check, ChevronRight, CircleCheck, CircleDot, Hourglass, Inbox, Route, TriangleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CareRideMark } from '../../components/brand/CareRideMark'
import { RequestStatusCard } from '../../components/RequestStatusCard'
import { AssignmentRow } from '../../components/volunteer/AssignmentRow'
import { OpportunityList } from '../../components/volunteer/OpportunityList'
import { VolunteerLoadError } from '../../components/volunteer/states'
import { VerificationSummary } from '../../components/volunteer/VerificationSummary'
import { MetricCard, MetricGroup } from '../../components/workspace/MetricCard'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, Skeleton, SkeletonRows } from '../../components/workspace/states'
import { focusRing, panel, panelHead, panelLink, panelTitle } from '../../components/workspace/styles'
import { useApp } from '../../hooks/useApp'
import { useNow } from '../../hooks/useNow'
import { useVolunteer } from '../../hooks/useVolunteer'
import { greetingFor } from '../../logic/rideInsights'
import { commitmentsFrom, impactSummary, volunteerActions, type ActionKind, type VolunteerAction } from '../../logic/volunteerSummary'
import { canDrive } from '../../volunteer/participation'
import { volunteerPaths as paths } from '../../volunteer/paths'

const COMMITMENT_LIMIT = 3
const OPPORTUNITY_LIMIT = 2

function actionLink(a: VolunteerAction): string {
  const to: Record<ActionKind, string> = {
    VERIFICATION_PENDING: paths.verification,
    VERIFICATION_REJECTED: paths.verification,
    RECONFIRM: paths.opportunities,
    RESPOND: paths.opportunities,
    UNDER_WAY: a.rideId ? paths.ride(a.rideId) : paths.transport,
    SOON: a.rideId ? paths.ride(a.rideId) : paths.commitments,
    NO_HOURS: paths.availability,
    PROFILE_INCOMPLETE: paths.profile,
  }
  return to[a.kind]
}

// A volunteer's home: what needs them, what's next, and what they've given. Every number comes from their own records.
export function Overview() {
  const { currentUser } = useApp()
  const { driver, driverLoaded, rides, groups, offers, houseOf } = useVolunteer()
  const now = useNow()
  if (!currentUser) return null

  const nowDate = new Date(now)
  const first = currentUser.name.trim().split(/\s+/)[0]
  const greeting = greetingFor(nowDate.getHours())
  const date = nowDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
  const approved = canDrive(driver)

  const header = (
    <PageHeader
      title={first ? `${greeting}, ${first}.` : `${greeting}.`}
      eyebrow={date}
      description="Your time makes a difference. Here's what's happening in your workspace."
    />
  )

  if (!driverLoaded) {
    return (
      <div className="space-y-6">
        {header}
        <SkeletonRows rows={3} label="Loading your workspace" />
      </div>
    )
  }

  // Before approval there are no rides or requests to show, so the page is about the application
  if (!approved) {
    return (
      <div className="space-y-6">
        {header}
        {driver ? <VerificationSummary driver={driver} /> : <p className="text-slate-600">There's no driver profile on this account.</p>}
        {driver && <NextSteps />}
      </div>
    )
  }

  const actions = volunteerActions(driver, groups, offers.data, nowDate)
  const commitments = groups ? commitmentsFrom(groups) : []
  const impact = rides.data && impactSummary(rides.data, nowDate)
  const ridesLoading = !rides.data && !rides.error

  return (
    <div className="space-y-8">
      {header}

      {/* First: anything that needs this volunteer. A clear day is one quiet line. */}
      <section aria-labelledby="action-title" className={`${panel} overflow-hidden ${actions.length > 0 ? 'border-amber-300' : ''}`}>
        {!offers.data && !offers.error ? (
          <SkeletonRows rows={2} label="Loading tasks" />
        ) : actions.length === 0 ? (
          <>
            <h2 id="action-title" className="sr-only">
              Action required
            </h2>
            <EmptyState compact icon={<Check strokeWidth={2.5} />} title="You're all caught up." text="Nothing needs you right now." />
          </>
        ) : (
          <>
            <div className={`${panelHead} border-amber-200 bg-sun-50`}>
              <h2 id="action-title" className={`${panelTitle} flex items-center gap-2`}>
                Action required
                <span className="rounded-full bg-sun-400 px-2 py-0.5 font-sans text-xs font-bold tabular-nums text-ink">{actions.length}</span>
              </h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {actions.map((a) => (
                <li key={`${a.kind}-${a.rideId ?? ''}`}>
                  <Link to={actionLink(a)} className={`group flex items-start gap-3 px-5 py-4 transition-colors duration-150 ease-out-quart hover:bg-slate-50 ${focusRing} focus-visible:ring-inset focus-visible:ring-offset-0`}>
                    {a.urgent ? (
                      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                    ) : (
                      <CircleDot className="mt-0.5 h-5 w-5 shrink-0 text-rc-blue" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-rc-navy">{a.title}</span>
                      <span className="block text-sm text-slate-600">{a.detail}</span>
                    </span>
                    <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition duration-150 ease-out-quart group-hover:translate-x-0.5 group-hover:text-rc-navy" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="metrics-title">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="metrics-title" className={`${panelTitle} flex items-center gap-2`}>
            <CareRideMark tone="brand" className="h-5 w-5" /> CareRide
          </h2>
          {(rides.error || offers.error) && <p className="text-sm text-red-700">Some numbers couldn't load.</p>}
        </div>
        <MetricGroup className="grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Requests to answer"
            value={offers.data?.length}
            hint={offers.data?.length ? 'Waiting for your answer' : 'All caught up'}
            icon={Inbox}
            to={paths.opportunities}
            alert="amber"
          />
          <MetricCard label="Under way" value={groups?.active.length} hint="Trips you've started" icon={Route} to={`${paths.rides}?tab=active`} />
          <MetricCard label="Upcoming rides" value={groups?.upcoming.length} hint="Accepted, not started" icon={CalendarCheck} to={`${paths.rides}?tab=upcoming`} />
          <MetricCard label="Completed rides" value={impact?.ridesCompleted} hint="Passengers dropped off" icon={CircleCheck} to={`${paths.rides}?tab=completed`} />
        </MetricGroup>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="commitments-title" className={panel}>
            <div className={panelHead}>
              <h2 id="commitments-title" className={panelTitle}>
                Upcoming commitments
              </h2>
              {commitments.length > 0 && (
                <Link to={paths.commitments} className={panelLink}>
                  View all <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              )}
            </div>
            {ridesLoading ? (
              <SkeletonRows rows={2} label="Loading your commitments" />
            ) : !rides.data ? (
              <VolunteerLoadError />
            ) : commitments.length === 0 ? (
              <EmptyState
                compact
                tone="neutral"
                icon={<CalendarClock />}
                title="No upcoming commitments"
                text="When you accept a ride request, it shows up here."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {commitments.slice(0, COMMITMENT_LIMIT).map((c) => (
                  <AssignmentRow key={c.id} ride={c.ride} house={houseOf(c.ride)} now={now} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="opportunities-title">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="opportunities-title" className={panelTitle}>
                  Available opportunities
                </h2>
                <p className="text-sm text-slate-500">Transportation requests sent to you</p>
              </div>
              <Link to={paths.opportunities} className={panelLink}>
                All opportunities <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <OpportunityList limit={OPPORTUNITY_LIMIT} />
          </section>
        </div>

        <div className="space-y-6">

          {driver && <RequestStatusCard driver={driver} showSettingsLink />}

          <section aria-labelledby="impact-title" className={panel}>
            <div className={panelHead}>
              <h2 id="impact-title" className={panelTitle}>
                Your impact
              </h2>
            </div>
            {!impact ? (
              ridesLoading ? (
                <div className="space-y-2 p-5" role="status" aria-label="Loading">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-4 w-40" />
                </div>
              ) : (
                <VolunteerLoadError />
              )
            ) : impact.ridesCompleted === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-600">Your completed rides will be counted here.</p>
            ) : (
              <>
                <dl className="grid grid-cols-3 divide-x divide-slate-100">
                  {(
                    [
                      ['Rides given', impact.ridesCompleted],
                      ['Passengers', impact.passengersDriven],
                      ['This month', impact.thisMonth],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="px-4 py-4 text-center">
                      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                      <dd className="mt-1 font-heading text-2xl font-bold tabular-nums text-rc-navy">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Counted from rides you marked as dropped off. Thank you.</p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function NextSteps() {
  return (
    <section aria-labelledby="meanwhile-title" className={panel}>
      <div className={panelHead}>
        <h2 id="meanwhile-title" className={panelTitle}>
          While you wait
        </h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {[
          { to: paths.availability, icon: CalendarClock, title: 'Check your availability', text: 'Requests are only sent during these hours.' },
          { to: paths.profile, icon: Hourglass, title: 'Review your profile', text: 'Vehicle, cities, and contact details.' },
        ].map(({ to, icon: Icon, title, text }) => (
          <li key={to}>
            <Link to={to} className={`flex items-center gap-3 px-5 py-4 hover:bg-slate-50 ${focusRing}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-rc-blue" aria-hidden>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-rc-navy">{title}</span>
                <span className="block text-sm text-slate-600">{text}</span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
