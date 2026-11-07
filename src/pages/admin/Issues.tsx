import { Flag, ThumbsDown } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { adminPaths } from '../../admin/paths'
import { DateText, FilterTabs, Pagination, Toolbar } from '../../components/admin/controls'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { panel } from '../../components/workspace/styles'
import { useAdmin } from '../../hooks/useAdmin'
import { useNow } from '../../hooks/useNow'
import { page, RECENT_ISSUE_DAYS, recentIssues, reportedIssues, type IssueKind } from '../../logic/adminSummary'
import { formatDayTime } from '../../logic/formatTime'

const PAGE_SIZE = 20

type KindFilter = 'all' | IssueKind
type WhenFilter = 'recent' | 'all'

// Problems people reported after a ride: driver flags, and rides staff said didn't go well.
// Only platform admins can read this feedback; drivers never see staff ratings.
export function Issues() {
  const { feedback, rides, orgName, driverName } = useAdmin()
  const now = useNow()
  const [kind, setKind] = useState<KindFilter>('all')
  const [when, setWhen] = useState<WhenFilter>('recent')
  const [pageIndex, setPageIndex] = useState(0)

  const all = feedback.data ? reportedIssues(feedback.data, rides.data ?? []) : []
  const inWindow = when === 'recent' ? recentIssues(all, new Date(now)) : all
  const filtered = inWindow.filter((i) => kind === 'all' || i.kind === kind)
  const shown = page(filtered, pageIndex, PAGE_SIZE)

  return (
    <div className="space-y-4">
      <PageHeader title="Issues" description="Problems reported after transportation rides. Each one links to the ride and its full change history." />
      <section aria-label="Issues" className={panel}>
        <Toolbar>
          <FilterTabs
            label="Kind"
            value={kind}
            onChange={(v) => {
              setKind(v)
              setPageIndex(0)
            }}
            options={[
              { id: 'all' as KindFilter, label: 'All', count: feedback.data ? inWindow.length : undefined },
              { id: 'DRIVER_FLAG' as KindFilter, label: 'Flagged by drivers', count: feedback.data ? inWindow.filter((i) => i.kind === 'DRIVER_FLAG').length : undefined },
              { id: 'POOR_RATING' as KindFilter, label: 'Rated poorly by staff', count: feedback.data ? inWindow.filter((i) => i.kind === 'POOR_RATING').length : undefined },
            ]}
          />
          <FilterTabs
            label="When"
            value={when}
            onChange={(v) => {
              setWhen(v)
              setPageIndex(0)
            }}
            options={[
              { id: 'recent' as WhenFilter, label: `Last ${RECENT_ISSUE_DAYS} days` },
              { id: 'all' as WhenFilter, label: 'All time' },
            ]}
          />
        </Toolbar>
        {!feedback.data ? (
          feedback.error ? <SectionError message="We couldn't load reported issues. Please try again." /> : <SkeletonRows rows={4} label="Loading issues" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Flag className="h-6 w-6" />} title="No issues reported" text={when === 'recent' ? `Nothing in the last ${RECENT_ISSUE_DAYS} days.` : 'Nobody has reported a problem yet.'} />
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {shown.items.map(({ id, kind: k, feedback: f, ride }) => (
                <li key={id} className="flex gap-3 px-5 py-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sun-100 text-amber-900" aria-hidden>
                    {k === 'DRIVER_FLAG' ? <Flag className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-semibold text-rc-navy">
                      {k === 'DRIVER_FLAG' ? `${driverName(f.driverId) ?? 'A driver'} flagged an issue` : `${orgName(f.orgId) ?? 'Staff'} said a ride didn’t go well`}
                    </p>
                    <p className="text-slate-600">
                      {ride ? (
                        <Link to={adminPaths.ride(ride.id)} className="font-medium text-rc-blue hover:underline">
                          Ride to {ride.destinationName}, {formatDayTime(ride.pickupTime)}
                        </Link>
                      ) : (
                        'A ride older than the ones loaded here'
                      )}
                      {' · '}
                      {orgName(f.orgId)}
                    </p>
                    {f.note && <p className="mt-1 whitespace-pre-line break-words text-slate-700">“{f.note}”</p>}
                    <p className="mt-1 text-xs text-slate-500">
                      Reported <DateText at={f.at} withTime />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <Pagination index={shown.index} pages={shown.pages} total={filtered.length} size={PAGE_SIZE} onPage={setPageIndex} noun={['issue', 'issues']} />
          </>
        )}
      </section>
    </div>
  )
}
