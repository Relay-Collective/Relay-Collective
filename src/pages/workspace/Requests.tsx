import { CalendarPlus, ChevronRight, Inbox, Search, TriangleAlert, Truck } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { compactButton, focusRing, panel } from '../../components/workspace/styles'
import { input, primaryButton, secondaryButton } from '../../components/ui'
import { useNow } from '../../hooks/useNow'
import { useWorkspace } from '../../hooks/useWorkspace'
import type { DriverInfo } from '../../components/dashboard/RideList'
import { formatTime } from '../../logic/formatTime'
import { inView, isRequestView, matchesQuery, REQUEST_VIEWS, requestReference, sortForView, type RequestView } from '../../logic/requestSummary'
import { actionTitle, dayLabel } from '../../logic/rideInsights'
import { rideBadgeLabel } from '../../logic/rideText'
import type { Ride } from '../../types'
import { paths } from '../../workspace/paths'

const PAGE = 25

const EMPTY_TEXT: Record<RequestView, string> = {
  open: 'There are no open transportation requests.',
  attention: "You're all caught up. There are no active transportation requests requiring attention.",
  waiting: 'No requests are waiting for a driver right now.',
  confirmed: 'No requests are confirmed or under way right now.',
  past: 'Finished and cancelled requests will be kept here.',
}

// Every request the organization has made, in one list. Transportation is the only service so far,
// so each row says it's a ride, and the list is ready for other kinds when they arrive.
export function Requests() {
  const { rides, driverOf } = useWorkspace()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const picked = params.get('view')
  const view: RequestView = isRequestView(picked) ? picked : 'open'
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)

  const nowDate = new Date(now)
  const all = rides.data ?? []
  const counts = Object.fromEntries(REQUEST_VIEWS.map((v) => [v.id, all.filter((r) => inView(r, v.id, nowDate)).length])) as Record<RequestView, number>
  const matches = sortForView(
    all.filter((r) => inView(r, view, nowDate) && matchesQuery(r, query)),
    view,
  )

  const pickView = (id: RequestView) => {
    setParams(id === 'open' ? {} : { view: id }, { replace: true })
    setShown(PAGE)
  }

  return (
    <div>
      <PageHeader
        title="Requests"
        description="Track every request your organization has made. Transportation is the first service in your workspace."
        actions={
          <Link to={paths.newRide} className={`${primaryButton} ${compactButton}`}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> Request a ride
          </Link>
        }
      />

      <section aria-label="Requests" className={panel}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-3 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label="Show" className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1 max-xl:pr-8 max-xl:[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] lg:pb-0">
            {REQUEST_VIEWS.map((v) => {
              const on = v.id === view
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickView(v.id)}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors duration-150 ease-out-quart ${focusRing} ${
                    on ? 'bg-brand-50 text-brand-700 shadow-[inset_0_0_0_1px_var(--color-brand-200)]' : 'text-slate-600 hover:bg-slate-100 hover:text-rc-navy'
                  }`}
                >
                  {v.label}
                  {rides.data && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                        on && !(v.id === 'attention' && counts.attention) ? 'bg-white text-brand-700' : v.id === 'attention' && counts.attention ? 'bg-care-red text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {counts[v.id]}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              type="search"
              className={`${input} min-h-11 pl-10 text-[15px]`}
              placeholder="Search by place or reference"
              aria-label="Search requests by place or reference"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShown(PAGE)
              }}
            />
          </div>
        </div>

        {!rides.data && !rides.error ? (
          <SkeletonRows rows={5} label="Loading requests" />
        ) : !rides.data ? (
          <SectionError message="We couldn't load your organization's requests. Please try again." />
        ) : matches.length === 0 ? (
          query.trim() ? (
            <p className="px-4 py-10 text-center text-slate-600">No requests match “{query.trim()}”.</p>
          ) : all.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="No requests yet"
              text="Your organization hasn't created any transportation requests yet."
              action={
                <Link to={paths.newRide} className={primaryButton}>
                  <CalendarPlus className="h-5 w-5" aria-hidden /> Request a ride
                </Link>
              }
            />
          ) : (
            <EmptyState icon={<Inbox className="h-6 w-6" />} title="Nothing here" text={EMPTY_TEXT[view]} />
          )
        ) : (
          <>
            <RequestTable rides={matches.slice(0, shown)} driverOf={driverOf} now={now} />
            <p className="sr-only" aria-live="polite">
              {matches.length === 1 ? '1 request' : `${matches.length} requests`}
            </p>
            {matches.length > shown && (
              <div className="flex justify-center border-t border-slate-100 p-4">
                <button type="button" className={`${secondaryButton} ${compactButton}`} onClick={() => setShown((n) => n + PAGE)}>
                  Show {Math.min(PAGE, matches.length - shown)} more
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}

interface TableProps {
  rides: Ride[]
  driverOf: (ride: Ride) => DriverInfo | undefined
  now: number
}

function pickupText(ride: Ride, now: number) {
  if (ride.type === 'ON_DEMAND' && ride.status !== 'COMPLETED' && ride.status !== 'CANCELLED' && ride.status !== 'NO_SHOW') return 'As soon as possible'
  return `${dayLabel(new Date(ride.pickupTime).getTime(), now)}, ${formatTime(ride.pickupTime)}`
}

// The same as the rides list shows: who's driving, only while a ride is confirmed or under way
const driverName = (ride: Ride, driver?: DriverInfo) =>
  (ride.status === 'ACCEPTED' || ride.status === 'PICKED_UP') && driver ? (driver.name ?? 'Driver assigned') : undefined

// A table from the tablet breakpoint up; stacked rows on phones, so nothing scrolls sideways.
function RequestTable({ rides, driverOf, now }: TableProps) {
  const nowDate = new Date(now)
  return (
    <>
      <table className="hidden w-full text-left text-sm md:table">
        <caption className="sr-only">Requests, with service, status, pickup time, and driver</caption>
        <thead className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">
              Request
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-3 py-3 font-semibold">
              Pickup
            </th>
            <th scope="col" className="hidden px-3 py-3 font-semibold lg:table-cell">
              Driver
            </th>
            <th scope="col" className="px-5 py-3 text-right font-semibold">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rides.map((r) => {
            const alert = actionTitle(r, nowDate)
            return (
              <tr key={r.id} className={alert ? 'bg-red-50/50' : 'hover:bg-slate-50'}>
                <td className="px-5 py-3.5">
                  <ServiceChip />
                  <Link to={paths.ride(r.id)} className={`mt-1 block rounded font-semibold text-rc-navy hover:underline ${focusRing}`}>
                    {r.returnOfRideId ? 'Return from' : 'Ride to'} {r.destinationName}
                  </Link>
                  <span className="text-xs text-slate-500">Ref. #{requestReference(r.id)}</span>
                </td>
                <td className="px-3 py-3.5">
                  <StatusBadge status={r.status} label={rideBadgeLabel(r)} />
                  {alert && (
                    <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-red-700">
                      <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> {alert}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3.5 whitespace-nowrap text-slate-700">{pickupText(r, now)}</td>
                <td className="hidden px-3 py-3.5 text-slate-700 lg:table-cell">{driverName(r, driverOf(r)) ?? <span className="text-slate-500">—</span>}</td>
                <td className="px-5 py-3.5 text-right">
                  <Link
                    to={paths.ride(r.id)}
                    className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`}
                    aria-label={`View the ${r.returnOfRideId ? 'return' : 'ride'} to ${r.destinationName}, reference ${requestReference(r.id)}`}
                  >
                    View <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <ul className="divide-y divide-slate-100 md:hidden">
        {rides.map((r) => {
          const alert = actionTitle(r, nowDate)
          const driver = driverName(r, driverOf(r))
          return (
            <li key={r.id}>
              <Link to={paths.ride(r.id)} className={`flex items-start gap-3 p-4 ${alert ? 'bg-red-50/50' : ''} ${focusRing} focus-visible:ring-inset`}>
                <span className="min-w-0 flex-1">
                  <ServiceChip />
                  <span className="mt-1 block font-semibold text-rc-navy">
                    {r.returnOfRideId ? 'Return from' : 'Ride to'} {r.destinationName}
                  </span>
                  <span className="block text-sm text-slate-600">
                    {pickupText(r, now)}
                    {driver && ` · ${driver}`}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={r.status} label={rideBadgeLabel(r)} />
                    {alert && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-red-700">
                        <TriangleAlert className="h-3.5 w-3.5" aria-hidden /> {alert}
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">Ref. #{requestReference(r.id)}</span>
                </span>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              </Link>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function ServiceChip() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rc-mint px-2 py-0.5 text-xs font-semibold text-rc-teal-ink">
      <Truck className="h-3.5 w-3.5" aria-hidden /> Transportation
    </span>
  )
}
