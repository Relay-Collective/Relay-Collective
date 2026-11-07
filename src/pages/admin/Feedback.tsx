import { ChevronRight, CircleDot, FilterX, ImageIcon, Inbox, LoaderCircle, MessagesSquare, Search, CircleCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { adminPaths } from '../../admin/paths'
import { RELEASES } from '../../changelog'
import { DateText, FilterTabs, Pagination, SearchField, Toolbar, type FilterOption } from '../../components/admin/controls'
import { FeedbackPriorityBadge, FeedbackStatusBadge, FeedbackTypeLabel } from '../../components/feedback/FeedbackBadges'
import { input, secondaryButton } from '../../components/ui'
import { MetricCard, MetricGroup } from '../../components/workspace/MetricCard'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { compactButton, focusRing, panel } from '../../components/workspace/styles'
import { FEEDBACK_TYPES, formatReference, PRIORITY_LABELS, PRIORITY_ORDER, STATUS_LABELS, STATUS_ORDER, WORKSPACE_LABELS } from '../../feedback/rules'
import { useAdmin } from '../../hooks/useAdmin'
import { useLoadable } from '../../hooks/useLoadable'
import { dataService } from '../../services'
import type { FeedbackQuery } from '../../services/dataService'
import type { AdminFeedbackRow, FeedbackWorkspace, ProductFeedbackPriority, ProductFeedbackStatus, ProductFeedbackType } from '../../types'

const PAGE_SIZE = 20
const SEARCH_DELAY_MS = 300

// Filters live in the address, so a filtered view can be shared and Back from a detail page returns to it
const FILTER_KEYS = ['q', 'type', 'status', 'priority', 'workspace', 'org', 'release', 'from', 'to'] as const
type FilterKey = (typeof FILTER_KEYS)[number]

const selectClass = `${input} min-h-11 text-sm`

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </label>
  )
}

// Feedback & Suggestions from every workspace: review it, prioritize it, and keep submitters informed.
// Filtering, search and paging happen in the database; only one page of rows reaches the browser.
export function Feedback() {
  const { feedbackSummary: summary, orgs } = useAdmin()
  const [params, setParams] = useSearchParams()
  const get = (key: FilterKey) => params.get(key) ?? ''
  const pageIndex = Math.max(0, Number(params.get('page') ?? '1') - 1 || 0)

  // Search applies a moment after typing stops
  const [search, setSearch] = useState(get('q'))
  const [lastQ, setLastQ] = useState(get('q'))
  if (lastQ !== get('q')) {
    setLastQ(get('q'))
    setSearch(get('q')) // e.g. Back to an earlier search
  }

  function update(changes: Partial<Record<FilterKey | 'page', string>>) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        if (!('page' in changes)) next.delete('page') // a new filter starts on the first page
        return next
      },
      { replace: true },
    )
  }

  useEffect(() => {
    if (search.trim() === get('q')) return
    const timer = window.setTimeout(() => update({ q: search.trim() }), SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new search term restarts the wait
  }, [search])

  const query: FeedbackQuery = {
    search: get('q') || undefined,
    type: (get('type') || undefined) as ProductFeedbackType | undefined,
    status: (get('status') || undefined) as ProductFeedbackStatus | undefined,
    priority: (get('priority') || undefined) as ProductFeedbackPriority | 'none' | undefined,
    workspace: (get('workspace') || undefined) as FeedbackWorkspace | undefined,
    organizationId: get('org') || undefined,
    release: get('release') || undefined,
    from: get('from') || undefined,
    to: get('to') || undefined,
    limit: PAGE_SIZE,
    offset: pageIndex * PAGE_SIZE,
  }
  const key = JSON.stringify(query)
  const results = useLoadable(() => dataService.listProductFeedback(query), key)
  const filtered = FILTER_KEYS.some((k) => get(k))
  const counts = summary.data
  const statusCount: Record<ProductFeedbackStatus, number | undefined> = {
    new: counts?.new,
    under_review: counts?.underReview,
    planned: counts?.planned,
    in_progress: counts?.inProgress,
    resolved: counts?.resolved,
    closed: counts?.closed,
  }
  const organizations = [...(orgs.data ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Feedback & Product Improvements"
        description="Review feedback, identify recurring issues, and manage improvements across Relay Collective."
      />

      {summary.error && !counts ? (
        <section className={panel}>
          <SectionError message="We couldn't load the feedback totals. Please try again." />
        </section>
      ) : (
        <MetricGroup className="grid-cols-2 lg:grid-cols-5">
          <MetricCard label="Total submissions" value={counts?.total} hint="Across every workspace" icon={MessagesSquare} to={adminPaths.feedback} />
          <MetricCard label="New" value={counts?.new} hint="Not reviewed yet" icon={CircleDot} to={`${adminPaths.feedback}?status=new`} alert="amber" />
          <MetricCard label="Under review" value={counts?.underReview} hint="Being looked into" icon={Search} to={`${adminPaths.feedback}?status=under_review`} />
          <MetricCard label="In progress" value={counts?.inProgress} hint="Being worked on" icon={LoaderCircle} to={`${adminPaths.feedback}?status=in_progress`} />
          <MetricCard label="Resolved" value={counts?.resolved} hint="Addressed" icon={CircleCheck} to={`${adminPaths.feedback}?status=resolved`} />
        </MetricGroup>
      )}

      <section aria-label="Feedback" className={panel}>
        <Toolbar>
          <FilterTabs
            label="Status"
            value={(get('status') || 'all') as ProductFeedbackStatus | 'all'}
            onChange={(v) => update({ status: v === 'all' ? '' : v })}
            options={[
              { id: 'all', label: 'All', count: counts?.total },
              ...STATUS_ORDER.map((s): FilterOption<ProductFeedbackStatus> => ({ id: s, label: STATUS_LABELS[s], count: statusCount[s], alert: s === 'new' })),
            ]}
          />
          <SearchField value={search} onChange={setSearch} label="Search feedback" placeholder="Search title, description, or FB-1042" />
        </Toolbar>

        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-3 sm:grid-cols-3 sm:p-4 lg:grid-cols-4 xl:grid-cols-7">
          <Select label="Type" value={get('type')} onChange={(v) => update({ type: v })}>
            <option value="">All types</option>
            {FEEDBACK_TYPES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </Select>
          <Select label="Priority" value={get('priority')} onChange={(v) => update({ priority: v })}>
            <option value="">Any priority</option>
            <option value="none">Not set</option>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
          <Select label="Workspace" value={get('workspace')} onChange={(v) => update({ workspace: v })}>
            <option value="">All workspaces</option>
            {(Object.keys(WORKSPACE_LABELS) as FeedbackWorkspace[]).map((w) => (
              <option key={w} value={w}>
                {WORKSPACE_LABELS[w]}
              </option>
            ))}
          </Select>
          <Select label="Organization" value={get('org')} onChange={(v) => update({ org: v })}>
            <option value="">All organizations</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </Select>
          <Select label="Update" value={get('release')} onChange={(v) => update({ release: v })}>
            <option value="">Any update</option>
            {RELEASES.map((r) => (
              <option key={r.version} value={r.version}>
                Version {r.version}
              </option>
            ))}
          </Select>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Sent from</span>
            <input type="date" className={selectClass} value={get('from')} max={get('to') || undefined} onChange={(e) => update({ from: e.target.value })} />
          </label>
          <label className="block min-w-0">
            <span className="mb-1 block text-xs font-semibold text-slate-500">Sent to</span>
            <input type="date" className={selectClass} value={get('to')} min={get('from') || undefined} onChange={(e) => update({ to: e.target.value })} />
          </label>
          {filtered && (
            <div className="col-span-full flex justify-end">
              <button
                type="button"
                className={`${secondaryButton} ${compactButton}`}
                onClick={() => {
                  setSearch('')
                  setParams(new URLSearchParams(), { replace: true })
                }}
              >
                <FilterX className="h-4 w-4" aria-hidden /> Clear filters
              </button>
            </div>
          )}
        </div>

        {!results.data ? (
          results.error ? <SectionError message="We couldn't load feedback. Please try again." /> : <SkeletonRows rows={5} label="Loading feedback" />
        ) : results.data.rows.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title={filtered ? 'No feedback matches these filters' : 'No feedback yet'}
            text={filtered ? 'Try a different search, or clear the filters.' : 'Feedback sent from any workspace will appear here.'}
          />
        ) : (
          <>
            <FeedbackTable rows={results.data.rows} />
            <Pagination
              index={pageIndex}
              pages={Math.max(1, Math.ceil(results.data.total / PAGE_SIZE))}
              total={results.data.total}
              size={PAGE_SIZE}
              onPage={(i) => update({ page: i ? String(i + 1) : '' })}
              noun={['submission', 'submissions']}
            />
          </>
        )}
      </section>
    </div>
  )
}

function Submitter({ row }: { row: AdminFeedbackRow }) {
  return (
    <span className="block min-w-0">
      <span className="block truncate text-rc-navy">{row.submittedBy.name}</span>
      {!row.submittedBy.active && <span className="text-xs text-slate-500">Account closed</span>}
    </span>
  )
}

// A table from the tablet breakpoint up, stacked cards below it, so nothing scrolls sideways on a phone
function FeedbackTable({ rows }: { rows: AdminFeedbackRow[] }) {
  const th = 'px-4 py-2.5 font-semibold first:pl-5 last:pr-5'
  const td = 'px-4 py-3 align-middle first:pl-5 last:pr-5'
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Feedback, newest first</caption>
          <thead className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className={th}>Title</th>
              <th scope="col" className={`${th} hidden xl:table-cell`}>Type</th>
              <th scope="col" className={`${th} hidden lg:table-cell`}>Workspace</th>
              <th scope="col" className={th}>Submitted by</th>
              <th scope="col" className={`${th} hidden xl:table-cell`}>Organization</th>
              <th scope="col" className={th}>Priority</th>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={`${th} hidden lg:table-cell`}>Created</th>
              <th scope="col" className={`${th} text-right`}>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className={row.status === 'new' ? 'bg-brand-50/30 hover:bg-slate-50/70' : 'hover:bg-slate-50/70'}>
                <td className={`${td} max-w-xs`}>
                  <Link to={adminPaths.feedbackItem(row.id)} className={`block rounded font-semibold text-rc-navy hover:text-rc-blue hover:underline ${focusRing}`}>
                    <span className="line-clamp-2 break-words">{row.title}</span>
                  </Link>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    {formatReference(row.reference)}
                    {row.hasAttachment && (
                      <>
                        <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                        <span className="sr-only">Has a screenshot</span>
                      </>
                    )}
                    {row.assignedTo && <span>· {row.assignedTo.name}</span>}
                  </span>
                </td>
                <td className={`${td} hidden xl:table-cell`}>
                  <FeedbackTypeLabel type={row.feedbackType} />
                </td>
                <td className={`${td} hidden text-slate-700 lg:table-cell`}>{WORKSPACE_LABELS[row.sourceWorkspace]}</td>
                <td className={`${td} max-w-40`}>
                  <Submitter row={row} />
                </td>
                <td className={`${td} hidden max-w-40 truncate text-slate-700 xl:table-cell`}>{row.organization?.name ?? <span className="text-slate-500">None</span>}</td>
                <td className={td}>
                  <FeedbackPriorityBadge priority={row.priority} />
                </td>
                <td className={td}>
                  <FeedbackStatusBadge status={row.status} />
                </td>
                <td className={`${td} hidden whitespace-nowrap text-slate-600 lg:table-cell`}>
                  <DateText at={row.createdAt} />
                </td>
                <td className={`${td} text-right`}>
                  <Link
                    to={adminPaths.feedbackItem(row.id)}
                    aria-label={`View ${formatReference(row.reference)}: ${row.title}`}
                    className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`}
                  >
                    View <ChevronRight className="h-4 w-4" aria-hidden />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link to={adminPaths.feedbackItem(row.id)} className={`block space-y-2 px-4 py-4 hover:bg-slate-50 ${focusRing} focus-visible:ring-inset`}>
              <span className="flex flex-wrap items-center gap-2">
                <FeedbackStatusBadge status={row.status} />
                <FeedbackPriorityBadge priority={row.priority} />
                <span className="text-xs text-slate-500">{formatReference(row.reference)}</span>
              </span>
              <span className="block break-words font-semibold text-rc-navy">{row.title}</span>
              <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                <FeedbackTypeLabel type={row.feedbackType} />
                <span>{row.submittedBy.name}</span>
                {row.organization && <span>{row.organization.name}</span>}
                <DateText at={row.createdAt} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}
