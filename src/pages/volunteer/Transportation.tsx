import { ArrowRight, CalendarClock, History, Navigation } from 'lucide-react'
import { Link } from 'react-router-dom'
import { RequestStatusCard } from '../../components/RequestStatusCard'
import { AssignmentRow } from '../../components/volunteer/AssignmentRow'
import { OpportunityList } from '../../components/volunteer/OpportunityList'
import { RequireApprovedDriver, VolunteerLoadError } from '../../components/volunteer/states'
import { TripPanel, UndoFinish } from '../../components/volunteer/TripPanel'
import { secondaryButton } from '../../components/ui'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SkeletonRows } from '../../components/workspace/states'
import { compactButton, panel, panelHead, panelLink, panelTitle } from '../../components/workspace/styles'
import { useNow } from '../../hooks/useNow'
import { useVolunteer } from '../../hooks/useVolunteer'
import { canUndoFinish } from '../../logic/dispatch'
import { volunteerPaths } from '../../volunteer/paths'

const RECENT = 5

// The driver's transportation service: new requests, the trip now, what's next, and what's done.
// The heading ids (requests-title, current-title, past-title) are what the /demo deck scrolls to.
export function Transportation() {
  return (
    <RequireApprovedDriver>
      <TransportationHome />
    </RequireApprovedDriver>
  )
}

function TransportationHome() {
  const { driver, rides, groups, offers, houseOf } = useVolunteer()
  const now = useNow()
  const [current, ...later] = groups ? [...groups.active, ...groups.upcoming] : []
  const recent = groups?.completed.slice(0, RECENT) ?? []
  const count = offers.data?.length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transportation, with CareRide"
        title="CareRide"
        description="Ride requests matched to your vehicle, cities, and availability, and the trips you've said yes to."
        actions={
          <>
            <Link to={volunteerPaths.rides} className={`${secondaryButton} ${compactButton}`}>
              <History className="h-4 w-4" aria-hidden /> My rides
            </Link>
            <Link to={volunteerPaths.availability} className={`${secondaryButton} ${compactButton}`}>
              <CalendarClock className="h-4 w-4" aria-hidden /> Availability
            </Link>
          </>
        }
      />

      {driver && <RequestStatusCard driver={driver} showSettingsLink />}

      <section aria-labelledby="requests-title">
        <h2 id="requests-title" className={`${panelTitle} mb-3 flex scroll-mt-28 items-center gap-2`}>
          New requests
          {count > 0 && <span className="rounded-full bg-sun-400 px-2 py-0.5 text-xs font-bold tabular-nums text-ink">{count}</span>}
        </h2>
        <OpportunityList showMap />
      </section>

      {!rides.data ? (
        <section aria-labelledby="current-title" className={panel}>
          <div className={panelHead}>
            <h2 id="current-title" className={panelTitle}>
              Next ride
            </h2>
          </div>
          {rides.error ? <VolunteerLoadError /> : <SkeletonRows rows={2} label="Loading your rides" />}
        </section>
      ) : current ? (
        <TripPanel ride={current} headingId="current-title" title={groups!.active.includes(current) ? 'Your trip now' : 'Next ride'} />
      ) : (
        <section aria-labelledby="current-title" className={panel}>
          <div className={panelHead}>
            <h2 id="current-title" className={`${panelTitle} scroll-mt-28`}>
              Next ride
            </h2>
          </div>
          <EmptyState icon={<Navigation className="h-6 w-6" />} title="You don't have any upcoming commitments." text="When you accept a request, it shows up here." />
        </section>
      )}

      {later.length > 0 && (
        <section aria-labelledby="upcoming-title" className={panel}>
          <div className={panelHead}>
            <h2 id="upcoming-title" className={panelTitle}>
              Coming up
            </h2>
            <Link to={volunteerPaths.commitments} className={panelLink}>
              All commitments <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <ul className="divide-y divide-slate-100">
            {later.map((r) => (
              <AssignmentRow key={r.id} ride={r} house={houseOf(r)} now={now} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="past-title" className={panel}>
        <div className={panelHead}>
          <h2 id="past-title" className={`${panelTitle} scroll-mt-28`}>
            Recent rides
          </h2>
          {recent.length > 0 && (
            <Link to={`${volunteerPaths.rides}?tab=completed`} className={panelLink}>
              Ride history <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
        {!rides.data ? (
          rides.error ? <VolunteerLoadError /> : <SkeletonRows rows={2} label="Loading past rides" />
        ) : recent.length === 0 ? (
          <EmptyState icon={<History className="h-6 w-6" />} title="No past rides yet." text="Rides you finish are listed here." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((r) => (
              <AssignmentRow key={r.id} ride={r} house={houseOf(r)} now={now} when="finished">
                {canUndoFinish(r) && <UndoFinish ride={r} />}
              </AssignmentRow>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
