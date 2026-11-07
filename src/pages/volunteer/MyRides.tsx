import { CalendarClock, CircleCheck, CircleX, Route } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Breadcrumbs, FilterTabs } from '../../components/admin/controls'
import { secondaryButton } from '../../components/ui'
import { AssignmentRow } from '../../components/volunteer/AssignmentRow'
import { RequireApprovedDriver, VolunteerLoadError } from '../../components/volunteer/states'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SkeletonRows } from '../../components/workspace/states'
import { compactButton, panel } from '../../components/workspace/styles'
import { useNow } from '../../hooks/useNow'
import { useVolunteer } from '../../hooks/useVolunteer'
import type { DriverRideGroups } from '../../logic/volunteerSummary'
import { volunteerPaths } from '../../volunteer/paths'

type Tab = 'upcoming' | 'active' | 'completed' | 'cancelled'

const PAGE = 20

const TABS: { id: Tab; label: string; empty: string; icon: ReactNode }[] = [
  { id: 'upcoming', label: 'Upcoming', empty: "You don't have any upcoming rides.", icon: <CalendarClock className="h-6 w-6" /> },
  { id: 'active', label: 'Active', empty: 'No trip is under way.', icon: <Route className="h-6 w-6" /> },
  { id: 'completed', label: 'Completed', empty: 'No completed rides yet.', icon: <CircleCheck className="h-6 w-6" /> },
  { id: 'cancelled', label: 'Cancelled', empty: 'None of your rides were cancelled.', icon: <CircleX className="h-6 w-6" /> },
]

const isTab = (v: string | null): v is Tab => TABS.some((t) => t.id === v)

// Every ride this driver accepted, by where it is in its lifecycle. "Completed" includes rides where the passenger didn't show.
export function MyRides() {
  const { rides, groups, houseOf } = useVolunteer()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: Tab = isTab(requested) ? requested : groups?.active.length ? 'active' : 'upcoming'
  const [shown, setShown] = useState(PAGE)
  const list = groups ? groups[tab as keyof DriverRideGroups] : []
  const meta = TABS.find((t) => t.id === tab)!

  return (
    <RequireApprovedDriver>
      <div className="space-y-6">
        <div>
          <Breadcrumbs items={[{ label: 'Transportation', to: volunteerPaths.transport }, { label: 'My rides' }]} />
          <PageHeader title="My rides" description="Rides you've accepted, from what's next to what's done. Open a ride for its details." />
        </div>

        <section aria-label="Rides" className={panel}>
          <div className="border-b border-slate-100 p-3 sm:p-4">
            <FilterTabs
              label="Show rides"
              value={tab}
              onChange={(id) => {
                setShown(PAGE)
                setParams({ tab: id }, { replace: true })
              }}
              options={TABS.map((t) => ({ id: t.id, label: t.label, count: groups?.[t.id].length, alert: t.id === 'active' }))}
            />
          </div>
          {!rides.data && !rides.error ? (
            <SkeletonRows rows={4} label="Loading your rides" />
          ) : !rides.data ? (
            <VolunteerLoadError />
          ) : list.length === 0 ? (
            <EmptyState icon={meta.icon} title={meta.empty} />
          ) : (
            <>
              <ul className="divide-y divide-slate-100" aria-live="polite">
                {list.slice(0, shown).map((r) => (
                  <AssignmentRow key={r.id} ride={r} house={houseOf(r)} now={now} when={tab === 'completed' || tab === 'cancelled' ? 'finished' : 'pickup'} />
                ))}
              </ul>
              {list.length > shown && (
                <div className="border-t border-slate-100 p-4">
                  <button type="button" className={`${secondaryButton} ${compactButton}`} onClick={() => setShown((n) => n + PAGE)}>
                    Show older rides
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </RequireApprovedDriver>
  )
}
