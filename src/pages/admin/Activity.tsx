import { History, Info } from 'lucide-react'
import { useState } from 'react'
import { FilterTabs, Pagination, Toolbar } from '../../components/admin/controls'
import { ActivityRow } from '../../components/admin/ActivityRow'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { panel } from '../../components/workspace/styles'
import { useAdmin } from '../../hooks/useAdmin'
import { useNow } from '../../hooks/useNow'
import { page, registrationActivity, type AdminEventKind, type ReviewSubject } from '../../logic/adminSummary'

const PAGE_SIZE = 25

type KindFilter = 'all' | AdminEventKind
type SubjectFilter = 'all' | ReviewSubject

// Registrations and review decisions. Honest about what it is: the latest state of each record, not an audit log.
export function Activity() {
  const { orgs, drivers } = useAdmin()
  const now = useNow()
  const [kind, setKind] = useState<KindFilter>('all')
  const [subject, setSubject] = useState<SubjectFilter>('all')
  const [pageIndex, setPageIndex] = useState(0)

  const ready = orgs.data && drivers.data
  const events = ready ? registrationActivity(orgs.data!, drivers.data!) : []
  const filtered = events.filter((e) => (kind === 'all' || e.kind === kind) && (subject === 'all' || e.subject === subject))
  const shown = page(filtered, pageIndex, PAGE_SIZE)

  return (
    <div className="space-y-4">
      <PageHeader title="Activity" description="When organizations and drivers registered, and the latest review decision on each." />

      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-rest)] p-4 text-sm text-slate-700">
        <p className="flex items-start gap-2 font-semibold text-rc-navy">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-rc-blue" aria-hidden /> This isn’t a full audit log yet
        </p>
        <p className="mt-1 pl-6">
          Organizations and drivers only keep their latest review decision, so an earlier approval that was later changed won’t appear, and
          password resets and account deletions aren’t recorded here. Each ride’s own change history is complete: open a ride under
          Transportation to see it.
        </p>
      </div>

      <section aria-label="Activity" className={panel}>
        <Toolbar>
          <FilterTabs
            label="Event"
            value={kind}
            onChange={(v) => {
              setKind(v)
              setPageIndex(0)
            }}
            options={[
              { id: 'all' as KindFilter, label: 'All events' },
              { id: 'REGISTERED' as KindFilter, label: 'Registrations' },
              { id: 'APPROVED' as KindFilter, label: 'Approvals' },
              { id: 'REJECTED' as KindFilter, label: 'Rejections' },
            ]}
          />
          <FilterTabs
            label="Subject"
            value={subject}
            onChange={(v) => {
              setSubject(v)
              setPageIndex(0)
            }}
            options={[
              { id: 'all' as SubjectFilter, label: 'Everyone' },
              { id: 'ORGANIZATION' as SubjectFilter, label: 'Organizations' },
              { id: 'DRIVER' as SubjectFilter, label: 'Drivers' },
            ]}
          />
        </Toolbar>
        {!ready ? (
          orgs.error || drivers.error ? <SectionError /> : <SkeletonRows rows={6} label="Loading activity" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<History className="h-6 w-6" />} title="No activity recorded" text="Registrations and decisions will appear here as they happen." />
        ) : (
          <>
            <ol className="divide-y divide-slate-100">
              {shown.items.map((e) => (
                <ActivityRow key={e.id} event={e} now={now} />
              ))}
            </ol>
            <Pagination index={shown.index} pages={shown.pages} total={filtered.length} size={PAGE_SIZE} onPage={setPageIndex} noun={['event', 'events']} />
          </>
        )}
      </section>
    </div>
  )
}
