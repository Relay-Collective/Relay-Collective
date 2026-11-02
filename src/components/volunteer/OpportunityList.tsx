import { ArrowRight, Inbox } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../hooks/useApp'
import { useVolunteer } from '../../hooks/useVolunteer'
import { volunteerPaths } from '../../volunteer/paths'
import { Notice } from '../admin/controls'
import { EmptyState, SkeletonRows } from '../workspace/states'
import { OpportunityCard, type Answer } from './OpportunityCard'
import { VolunteerLoadError } from './states'

const pickupArea = (name?: string, city?: string) => (name ? [name, city].filter(Boolean).join(', ') : undefined)

// The requests waiting on this driver, oldest first, with what happened to the last one they answered.
export function OpportunityList({ limit, showMap = false }: { limit?: number; showMap?: boolean }) {
  const { refresh } = useApp()
  const { driver, offers, houseOf } = useVolunteer()
  const [last, setLast] = useState<Answer>()

  const all = [...(offers.data ?? [])].sort((a, b) => a.offer.sentAt.localeCompare(b.offer.sentAt))
  const shown = limit ? all.slice(0, limit) : all

  const onAnswered = (answer: Answer) => {
    setLast(answer)
    refresh()
  }

  return (
    <div className="space-y-3">
      {last && (
        <Notice tone="success" onDismiss={() => setLast(undefined)}>
          {last.accepted ? (
            <>
              Ride accepted. It's in your upcoming rides.{' '}
              <Link to={volunteerPaths.ride(last.ride.id)} className="font-semibold underline underline-offset-2">
                Open the ride
              </Link>
            </>
          ) : (
            'Request declined. We’ll ask other drivers.'
          )}
        </Notice>
      )}
      {!offers.data && !offers.error ? (
        <SkeletonRows rows={2} label="Loading ride requests" />
      ) : !offers.data ? (
        <VolunteerLoadError />
      ) : all.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          {/* On the overview this is one quiet row; the full list page keeps the larger version */}
          <EmptyState
            compact={!!limit}
            tone="neutral"
            icon={<Inbox className={limit ? undefined : 'h-6 w-6'} />}
            title={limit ? 'No ride requests right now' : 'There are no transportation requests available to you right now.'}
            text="New requests that fit your vehicle, cities, and availability show up here on their own."
          />
        </div>
      ) : (
        <>
          {shown.map(({ offer, ride }) => {
            const house = ride.returnOfRideId ? undefined : houseOf(ride)
            return (
              <OpportunityCard
                key={offer.id}
                offer={offer}
                ride={ride}
                from={pickupArea(house?.name, house?.city)}
                changed={ride.reconfirmDriverId === driver?.id}
                showMap={showMap}
                onAnswered={onAnswered}
              />
            )
          })}
          {limit && all.length > limit && (
            <Link to={volunteerPaths.opportunities} className="inline-flex min-h-11 items-center gap-1 font-semibold text-rc-blue hover:underline">
              See all {all.length} requests <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </>
      )}
    </div>
  )
}
