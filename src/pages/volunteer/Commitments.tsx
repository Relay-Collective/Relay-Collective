import { ArrowRight, CalendarClock } from 'lucide-react'
import { Link } from 'react-router-dom'
import { AssignmentRow } from '../../components/volunteer/AssignmentRow'
import { RequireApprovedDriver, VolunteerLoadError } from '../../components/volunteer/states'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SkeletonRows } from '../../components/workspace/states'
import { panel, panelHead, panelLink, panelTitle } from '../../components/workspace/styles'
import { useNow } from '../../hooks/useNow'
import { useVolunteer } from '../../hooks/useVolunteer'
import { commitmentsFrom, type Commitment } from '../../logic/volunteerSummary'
import { volunteerPaths } from '../../volunteer/paths'
import { dayLabel, startOfDay } from '../../logic/formatTime'

// Group by pickup day, with trips under way and as-soon-as-possible rides first
function byDay(items: Commitment[], now: number): [string, Commitment[]][] {
  const groups = new Map<string, Commitment[]>()
  for (const c of items) {
    const key = c.underWay || c.asSoonAsPossible ? 'Now' : dayLabel(startOfDay(Date.parse(c.startsAt)), now)
    groups.set(key, [...(groups.get(key) ?? []), c])
  }
  return [...groups]
}

// Everything the volunteer has said yes to and hasn't finished, across services. Transportation is the only one today.
export function Commitments() {
  const { rides, groups, houseOf } = useVolunteer()
  const now = useNow()
  const items = groups ? commitmentsFrom(groups) : []

  return (
    <RequireApprovedDriver>
      <div className="space-y-6">
        <PageHeader
          title="My commitments"
          description="Rides you've accepted and haven't finished yet. Open one for pickup details and trip steps."
          actions={
            <Link to={volunteerPaths.rides} className={panelLink}>
              Ride history <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          }
        />
        {!rides.data && !rides.error ? (
          <div className={panel}>
            <SkeletonRows rows={3} label="Loading your commitments" />
          </div>
        ) : !rides.data ? (
          <div className={panel}>
            <VolunteerLoadError />
          </div>
        ) : items.length === 0 ? (
          <div className={panel}>
            <EmptyState
              icon={<CalendarClock className="h-6 w-6" />}
              title="You don't have any upcoming commitments."
              text="When you accept a ride request, it shows up here."
              action={
                <Link to={volunteerPaths.opportunities} className={panelLink}>
                  See available requests <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              }
            />
          </div>
        ) : (
          byDay(items, now).map(([day, list], i) => (
            <section key={day} aria-labelledby={`day-${i}`} className={panel}>
              <div className={panelHead}>
                <h2 id={`day-${i}`} className={panelTitle}>
                  {day}
                </h2>
                <span className="text-xs font-medium text-slate-500">
                  {list.length} {list.length === 1 ? 'ride' : 'rides'}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {list.map((c) => (
                  <AssignmentRow key={c.id} ride={c.ride} house={houseOf(c.ride)} now={now} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </RequireApprovedDriver>
  )
}
