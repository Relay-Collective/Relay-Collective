import { Accessibility, ArrowRight, Flag, HandHelping, Inbox, MapPin, MessageSquareText, Phone, SearchX, UserRound, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Breadcrumbs } from '../../components/admin/controls'
import { FlagIssueButton } from '../../components/FlagIssueButton'
import { primaryButton } from '../../components/ui'
import { RideStatusBadge } from '../../components/volunteer/RideStatusBadge'
import { RideTimeline } from '../../components/volunteer/RideTimeline'
import { RequireApprovedDriver, RestrictedState, VolunteerLoadError } from '../../components/volunteer/states'
import { TripPanel, UndoFinish } from '../../components/volunteer/TripPanel'
import { PageHeader } from '../../components/workspace/PageHeader'
import { SkeletonRows } from '../../components/workspace/states'
import { panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { useVolunteer } from '../../hooks/useVolunteer'
import { canGiveFeedback } from '../../logic/feedback'
import { formatDayTime } from '../../logic/formatTime'
import { passengersLabel, riderLabel } from '../../modules/careride/domain'
import { isUnderWay } from '../../logic/volunteerSummary'
import { ExternalLink } from '../../native/ExternalLink'
import type { Ride } from '../../types'
import { volunteerPaths } from '../../volunteer/paths'

// One ride the driver accepted. Only rides on this driver's own list open here: the address alone is never enough.
export function RideDetail() {
  return (
    <RequireApprovedDriver>
      <RideDetailPage />
    </RequireApprovedDriver>
  )
}

function RideDetailPage() {
  const { id = '' } = useParams()
  const { rides, offers } = useVolunteer()
  const ride = rides.data?.find((r) => r.id === id)
  const crumbs = <Breadcrumbs items={[{ label: 'Transportation', to: volunteerPaths.transport }, { label: 'My rides', to: volunteerPaths.rides }, { label: 'Ride' }]} />

  if (!rides.data) return <div className="space-y-4">{crumbs}{rides.error ? <VolunteerLoadError /> : <SkeletonRows rows={4} label="Loading the ride" />}</div>

  if (!ride) {
    // Still a request: it opens where it can be answered, without the details an accepted ride shows
    const offered = offers.data?.some((o) => o.ride.id === id)
    return offered ? (
      <RestrictedState
        icon={<Inbox className="h-6 w-6" />}
        title="This ride is waiting for your answer."
        action={
          <Link to={volunteerPaths.opportunities} className={primaryButton}>
            Answer the request <ArrowRight className="h-5 w-5" aria-hidden />
          </Link>
        }
      >
        <p>Pickup details show here once you accept it.</p>
      </RestrictedState>
    ) : (
      <RestrictedState icon={<SearchX className="h-6 w-6" />} title="We couldn't find this ride." action={<Link to={volunteerPaths.rides} className={primaryButton}>My rides</Link>}>
        <p>It isn't on your list. It may have gone to another driver, or the link is wrong.</p>
      </RestrictedState>
    )
  }

  const live = ride.status === 'ACCEPTED' || ride.status === 'PICKED_UP'

  return (
    <div className="space-y-6">
      <div>
        {crumbs}
        <PageHeader
          eyebrow={ride.type === 'ON_DEMAND' ? 'On demand' : formatDayTime(ride.pickupTime)}
          title={`Ride to ${ride.destinationName}`}
          actions={<RideStatusBadge ride={ride} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <div className="space-y-6 lg:col-span-2">
          {live ? (
            <TripPanel ride={ride} headingId="trip-title" title={isUnderWay(ride) ? 'Your trip now' : 'Trip steps'} showDetailsLink={false} />
          ) : (
            <FinishedSummary ride={ride} />
          )}
        </div>

        <div className="space-y-6">
          <Requirements ride={ride} />
          <section aria-labelledby="timeline-title" className={panel}>
            <div className={panelHead}>
              <h2 id="timeline-title" className={panelTitle}>
                Status
              </h2>
            </div>
            <div className="p-5">
              <RideTimeline ride={ride} />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <span className="mt-0.5 shrink-0 text-slate-400" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-slate-500">{label}</dt>
        <dd className="text-sm text-rc-navy">{children}</dd>
      </div>
    </div>
  )
}

// What the trip needs. Rider names and notes are shown only because this driver accepted the ride.
function Requirements({ ride }: { ride: Ride }) {
  const riders = riderLabel(ride)
  return (
    <section aria-labelledby="needs-title" className={panel}>
      <div className={panelHead}>
        <h2 id="needs-title" className={panelTitle}>
          Trip requirements
        </h2>
      </div>
      <dl className="divide-y divide-slate-100">
        <Row icon={<Users className="h-4 w-4" />} label="Passengers">
          {passengersLabel(ride.passengers)}
        </Row>
        {riders && (
          <Row icon={<UserRound className="h-4 w-4" />} label="Who to pick up">
            {riders}
          </Row>
        )}
        <Row icon={<Accessibility className="h-4 w-4" />} label="Wheelchair">
          {ride.needsWheelchair ? 'Needs a wheelchair accessible vehicle' : 'Not needed'}
        </Row>
        <Row icon={<HandHelping className="h-4 w-4" />} label="Assistance">
          {ride.needsAssistance ? 'Needs help getting in and out' : 'Not needed'}
        </Row>
        {ride.notes && (
          <Row icon={<MessageSquareText className="h-4 w-4" />} label="Note from the front desk">
            {ride.notes}
          </Row>
        )}
      </dl>
    </section>
  )
}

// A ride that's over: where it went, a way to flag a problem, and undo for a few minutes after a mistaken tap
function FinishedSummary({ ride }: { ride: Ride }) {
  const { houseOf, feedback } = useVolunteer()
  const house = houseOf(ride)
  return (
    <section aria-labelledby="summary-title" className={panel}>
      <div className={panelHead}>
        <h2 id="summary-title" className={panelTitle}>
          Trip
        </h2>
      </div>
      <dl className="divide-y divide-slate-100">
        <Row icon={<MapPin className="h-4 w-4" />} label="Pickup">
          {house?.name ? `${house.name}, ${ride.pickupAddress}` : ride.pickupAddress}
        </Row>
        <Row icon={<Flag className="h-4 w-4" />} label="Destination">
          {ride.destinationName}
          {ride.destinationAddress !== ride.destinationName && <span className="block text-slate-600">{ride.destinationAddress}</span>}
        </Row>
        {ride.status === 'CANCELLED' && ride.cancelReason && (
          <Row icon={<MessageSquareText className="h-4 w-4" />} label="Why it was cancelled">
            {ride.cancelReason}
          </Row>
        )}
        {house?.phone && (
          <Row icon={<Phone className="h-4 w-4" />} label="Front desk">
            <ExternalLink href={`tel:${house.phone}`} className="font-semibold text-rc-blue underline underline-offset-2">
              {house.phone}
            </ExternalLink>
          </Row>
        )}
      </dl>
      {canGiveFeedback(ride) && (
        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center">
          <FlagIssueButton ride={ride} flagged={feedback.find((f) => f.rideId === ride.id)} />
          <UndoFinish ride={ride} />
        </div>
      )}
    </section>
  )
}
