import { AlertTriangle, CalendarCheck, CalendarDays, CalendarPlus, ChevronRight, MapPin, PiggyBank, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ActivityChart } from '../components/dashboard/ActivityChart'
import { NetworkImpact } from '../components/dashboard/NetworkImpact'
import { NextPickup } from '../components/dashboard/NextPickup'
import { RideList, type RideTab } from '../components/dashboard/RideList'
import { StatTile } from '../components/dashboard/StatTile'
import { TopDestinations } from '../components/dashboard/TopDestinations'
import { PageHeader } from '../../../components/workspace/PageHeader'
import { SectionError } from '../../../components/workspace/states'
import { panel } from '../../../components/workspace/styles'
import { card, primaryButton, tones, type Tone } from '../../../components/ui'
import { useApp } from '../../../hooks/useApp'
import { useData } from '../../../hooks/useData'
import { useNow } from '../../../hooks/useNow'
import { useWorkspace } from '../../../hooks/useWorkspace'
import { FARE_SAVED_NOTE, formatDollars } from '../../../logic/estimateFare'
import {
  actionTitle,
  byPickup,
  countdown,
  finishedAt,
  isFinished,
  needsAction,
  partnerStats,
  ridesPerDay,
  topDestinations,
} from '../logic/rideInsights'
import { dataService } from '../../../services'
import { careRidePaths as paths } from '../paths'

// The chart shows two weeks back and one week ahead
const DAYS_BACK = 14
const DAYS_AHEAD = 7

interface Shortcut {
  to: string
  title: string
  detail: string
  icon: LucideIcon
  tone: Tone
}

function scrollToRides() {
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById('rides')?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' })
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

// The transportation module's home: what needs doing, what's next, and how rides are going, all in one place.
export function Dashboard() {
  const { currentUser } = useApp()
  const now = useNow()
  const orgId = currentUser?.orgId
  // Rides, location and drivers are already loaded by the workspace shell
  const { rides: loadedRides, house, driverOf } = useWorkspace()
  const rides = loadedRides.data
  const destinations = useData(() => dataService.listDestinations(orgId), orgId) ?? []
  const [tab, setTab] = useState<RideTab>()

  if (!currentUser) return null

  const all = rides ?? []
  const nowDate = new Date(now)
  const attention = all.filter((r) => needsAction(r, nowDate)).sort(byPickup)
  // A ride already under way comes first, then by pickup time
  const upcoming = all
    .filter((r) => !needsAction(r, nowDate) && !isFinished(r))
    .sort((a, b) => Number(b.status === 'PICKED_UP') - Number(a.status === 'PICKED_UP') || byPickup(a, b))
  const past = all.filter(isFinished).sort((a, b) => finishedAt(b).localeCompare(finishedAt(a)))
  const stats = partnerStats(all, now)
  const next = upcoming[0]

  const openTab = (t: RideTab) => {
    setTab(t)
    scrollToRides()
  }

  // What went wrong, in words: the one problem, or the problems shared by several rides
  const problems = [...new Set(attention.map((r) => actionTitle(r, nowDate)))].join(' · ')
  const onlyOne = attention.length === 1 ? attention[0] : undefined
  const alertText = 'inline-flex items-center gap-1.5 text-left font-semibold text-red-700 hover:underline'

  // One sentence on the state of things, most urgent first
  const summary =
    attention.length > 0 ? (
      onlyOne ? (
        <Link to={paths.ride(onlyOne.id)} className={alertText}>
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          {problems} for the ride to {onlyOne.destinationName}.
        </Link>
      ) : (
        <button type="button" onClick={() => openTab('upcoming')} className={alertText}>
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
          {attention.length} rides need action: {problems.toLowerCase()}.
        </button>
      )
    ) : rides === undefined ? (
      loadedRides.error ? "We couldn't load your rides." : 'Loading your rides…'
    ) : next ? (
      <>
        {stats.today > 0 ? `${plural(stats.today, 'ride', 'rides')} today. ` : ''}
        {next.status === 'PICKED_UP'
          ? `A client is on the way to ${next.destinationName}.`
          : next.type === 'ON_DEMAND'
            ? `Finding a driver for ${next.destinationName} now.`
            : `Next pickup ${countdown(new Date(next.pickupTime).getTime(), now)}, to ${next.destinationName}.`}
      </>
    ) : (
      'Nothing booked yet. A ride takes about a minute to book.'
    )

  const shortcuts: Shortcut[] = [
    {
      to: paths.destinations,
      title: 'Destinations',
      detail: plural(destinations.length, 'saved place', 'saved places'),
      icon: MapPin,
      tone: 'teal',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          title="Ride overview"
          description={summary}
          actions={
            <Link to={paths.newRide} className={primaryButton}>
              <CalendarPlus className="h-5 w-5" aria-hidden />
              Request a ride
            </Link>
          }
        />
        {house && (
          <span className="-mt-3 inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm text-slate-600 ring-1 ring-slate-200">
            <MapPin className="h-4 w-4 shrink-0 text-rc-teal-ink" aria-hidden />
            <span className="truncate">Pickups from {house.address}</span>
          </span>
        )}
      </div>

      {loadedRides.error && !rides && (
        <div className={panel}>
          <SectionError message="We couldn't load your organization's rides. Please try again." />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {attention.length > 0 ? (
          <StatTile
            label="Needs action"
            value={attention.length}
            icon={<AlertTriangle className="h-5 w-5" />}
            tone="coral"
            note={problems}
            alert
            to={onlyOne && paths.ride(onlyOne.id)}
            onClick={onlyOne ? undefined : () => openTab('upcoming')}
            actionLabel={onlyOne ? `Open the ride to ${onlyOne.destinationName}` : 'Show rides that need action'}
          />
        ) : (
          <StatTile label="Today" value={stats.today} icon={<CalendarDays className="h-5 w-5" />} tone="coral" note={stats.today ? 'Pickups today' : 'Nothing today'} />
        )}
        <StatTile
          label="Upcoming"
          value={attention.length + upcoming.length}
          icon={<CalendarCheck className="h-5 w-5" />}
          tone="brand"
          note="Booked and on the way"
          onClick={() => openTab('upcoming')}
          actionLabel="Show upcoming rides"
        />
        <StatTile
          label="Completed"
          value={stats.completed}
          icon={<CalendarCheck className="h-5 w-5" />}
          tone="teal"
          note="Free rides given"
          onClick={() => openTab('past')}
          actionLabel="Show past rides"
        />
        <StatTile
          label="Bus fares saved"
          value={formatDollars(stats.faresSaved)}
          icon={<PiggyBank className="h-5 w-5" />}
          tone="ink"
          note={FARE_SAVED_NOTE}
        />
      </div>

      {/* Phones: one column, next pickup first. Desktop: rides and activity, with a side column. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:items-start">
        <div className="contents lg:col-span-2 lg:block lg:space-y-6">
          <div className="order-2 lg:order-0">
            <RideList attention={attention} upcoming={upcoming} past={past} driverOf={driverOf} now={now} tab={tab} onTab={setTab} />
          </div>

          <div className="order-4 lg:order-0">
            <ActivityChart
              days={ridesPerDay(all, now, DAYS_BACK, DAYS_AHEAD)}
              today={DAYS_BACK}
              title="Ride activity"
              subtitle="By pickup day, two weeks back and one ahead"
            />
          </div>
        </div>

        <div className="contents lg:block lg:space-y-6">
          <div className="order-1 lg:order-0">
            <NextPickup ride={next} driverName={next && driverOf(next)?.name} vehicle={next && driverOf(next)?.vehicle} now={now} />
          </div>

          <div className="order-3 lg:order-0">
            <TopDestinations places={topDestinations(all, 5)} />
          </div>

          <nav aria-label="Manage" className={`${card} order-5 p-2 lg:order-0`}>
            {shortcuts.map(({ to, title, detail, icon: Icon, tone }) => (
              <Link
                key={to}
                to={to}
                className="group flex items-center gap-3 rounded-xl p-3 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone].tile}`} aria-hidden>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{title}</span>
                  <span className="block truncate text-sm text-slate-500">{detail}</span>
                </span>
                <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <NetworkImpact />
    </div>
  )
}
