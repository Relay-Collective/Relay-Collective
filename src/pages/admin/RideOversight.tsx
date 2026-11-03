import { Flag, Info, ShieldCheck, ThumbsDown, ThumbsUp } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { adminPaths } from '../../admin/paths'
import { Breadcrumbs, DateText, DetailList } from '../../components/admin/controls'
import { RideHistory, StatusBadge } from '../../modules/careride'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { useAdmin } from '../../hooks/useAdmin'
import { formatDayTime } from '../../logic/formatTime'
import { passengersLabel, requestReference, rideBadgeLabel } from '../../modules/careride/domain'

// One ride, for investigating: where it is, who's involved, and every change made to it.
// Rider names, notes, and pickup instructions are left off: oversight doesn't need them.
export function RideOversight() {
  const { id = '' } = useParams()
  const { rides, feedback, orgName, driverName, drivers } = useAdmin()
  const ride = rides.data?.find((r) => r.id === id)
  const crumbs = [{ label: 'Transportation', to: adminPaths.transportation }, { label: ride ? `Ride #${requestReference(ride.id)}` : 'Ride' }]

  if (!ride) {
    return (
      <div>
        <Breadcrumbs items={crumbs} />
        <div className={panel}>
          {!rides.data ? (
            rides.error ? <SectionError message="We couldn't load this ride. Please try again." /> : <SkeletonRows rows={4} label="Loading ride" />
          ) : (
            <EmptyState icon={<Info className="h-6 w-6" />} title="Ride not found" text="It may be older than the rides loaded here, or the link is wrong." />
          )}
        </div>
      </div>
    )
  }

  const driverUserId = drivers.data?.find((d) => d.id === ride.driverId)?.userId
  const notes = (feedback.data ?? []).filter((f) => f.rideId === ride.id)
  const needs = [ride.needsWheelchair && 'Wheelchair', ride.needsAssistance && 'Help getting in and out'].filter(Boolean).join(', ') || 'None'

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs items={crumbs} />
        <PageHeader
          title={`${ride.returnOfRideId ? 'Return from' : 'Ride to'} ${ride.destinationName}`}
          description={
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={ride.status} label={rideBadgeLabel(ride)} /> Ref. #{requestReference(ride.id)}
            </span>
          }
        />
      </div>

      <p className="flex items-start gap-2 text-sm text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rc-teal-ink" aria-hidden />
        Rider names, notes, and pickup instructions aren’t shown here. The booking organization can see them on its own ride page.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="ride-title" className={panel}>
          <div className={panelHead}>
            <h2 id="ride-title" className={panelTitle}>
              Request
            </h2>
          </div>
          <DetailList
            rows={[
              ['Organization', <Link key="o" to={adminPaths.organization(ride.orgId)} className="font-semibold text-rc-blue hover:underline">{orgName(ride.orgId) ?? 'Organization'}</Link>],
              ['Type', ride.type === 'ON_DEMAND' ? 'As soon as possible' : 'Scheduled'],
              ['Pickup', formatDayTime(ride.pickupTime)],
              ['Destination', ride.destinationName],
              ['Passengers', passengersLabel(ride.passengers)],
              ['Access needs', needs],
              ['Driver', driverUserId ? <Link key="d" to={adminPaths.user(driverUserId)} className="font-semibold text-rc-blue hover:underline">{driverName(ride.driverId)}</Link> : 'Not assigned'],
              ['Requested', <DateText key="r" at={ride.createdAt} withTime />],
              ...(ride.cancelReason ? ([['Outcome', ride.cancelReason]] as [string, string][]) : []),
            ]}
          />
        </section>

        <div className="space-y-6">
          <section aria-labelledby="ride-history-title" className={panel}>
            <div className={panelHead}>
              <h2 id="ride-history-title" className={panelTitle}>
                Change history
              </h2>
            </div>
            <div className="px-5 py-4">
              <RideHistory rideId={ride.id} />
            </div>
          </section>

          <section aria-labelledby="ride-feedback-title" className={panel}>
            <div className={panelHead}>
              <h2 id="ride-feedback-title" className={panelTitle}>
                Feedback
              </h2>
            </div>
            {notes.length === 0 ? (
              <p className="px-5 py-4 text-sm text-slate-600">No feedback on this ride.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notes.map((f) => {
                  const Icon = f.authorRole === 'DRIVER' ? Flag : f.rating === 'DOWN' ? ThumbsDown : ThumbsUp
                  return (
                    <li key={f.id} className="flex gap-3 px-5 py-3 text-sm">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                      <div className="min-w-0">
                        <p className="font-semibold text-rc-navy">
                          {f.authorRole === 'DRIVER' ? 'Driver flagged an issue' : f.rating === 'DOWN' ? "Staff: it didn't go well" : 'Staff: it went well'}
                        </p>
                        {f.note && <p className="mt-0.5 whitespace-pre-line break-words text-slate-700">“{f.note}”</p>}
                        <p className="mt-0.5 text-xs text-slate-500">
                          <DateText at={f.at} withTime />
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
