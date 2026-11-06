import { Building2, Car, ChevronRight, ClipboardCheck } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ORG_KIND } from '../../admin/labels'
import { adminPaths } from '../../admin/paths'
import { DataTable, type Column } from '../../components/admin/DataTable'
import { DateText, FilterTabs, Toolbar } from '../../components/admin/controls'
import { VerificationBadge } from '../../components/admin/VerificationBadge'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { focusRing, panel } from '../../components/workspace/styles'
import { BACKGROUND_LABELS } from '../../constants'
import { useAdmin } from '../../hooks/useAdmin'
import { approvalQueue, recentDecisions, type ApprovalItem } from '../../logic/adminSummary'

type View = 'pending' | 'organizations' | 'drivers' | 'decided'

interface Row {
  item: ApprovalItem
  name: string
  type: string
  detail: string
  to: string
}

// Every application waiting for a platform admin, oldest first, plus the decisions already made
export function Approvals() {
  const { orgs, drivers, personName, orgName } = useAdmin()
  const [params, setParams] = useSearchParams()
  const view = (['pending', 'organizations', 'drivers', 'decided'].includes(params.get('view') ?? '') ? params.get('view') : 'pending') as View

  const ready = orgs.data && drivers.data
  const pending = ready ? approvalQueue(orgs.data!, drivers.data!) : []
  const decided = ready ? recentDecisions(orgs.data!, drivers.data!) : []

  const toRow = (item: ApprovalItem): Row => {
    if (item.subject === 'ORGANIZATION') {
      const o = orgs.data!.find((x) => x.id === item.id)!
      return { item, name: o.name, type: 'Organization registration', detail: `${ORG_KIND[o.type].label} · ${o.contactName}`, to: adminPaths.review('organizations', o.id) }
    }
    const d = drivers.data!.find((x) => x.id === item.id)!
    const affiliation = orgName(d.orgId)
    return {
      item,
      name: personName(d.userId) ?? 'Unnamed driver',
      type: d.appliedAsVolunteer ? 'Driver verification · existing volunteer' : 'Driver verification',
      detail: [BACKGROUND_LABELS[d.background], `${d.seats} ${d.seats === 1 ? 'seat' : 'seats'}`, d.wheelchairAccessible && 'Wheelchair accessible', affiliation].filter(Boolean).join(' · '),
      to: adminPaths.review('drivers', d.id),
    }
  }

  const source = view === 'decided' ? decided : pending.filter((i) => view === 'pending' || (view === 'organizations' ? i.subject === 'ORGANIZATION' : i.subject === 'DRIVER'))
  const rows = ready ? source.map(toRow) : []

  const columns: Column<Row>[] = [
    {
      id: 'name',
      header: 'Applicant',
      sortValue: (r) => r.name.toLowerCase(),
      cell: (r) => (
        <span className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600" aria-hidden>
            {r.item.subject === 'ORGANIZATION' ? <Building2 className="h-4 w-4" /> : <Car className="h-4 w-4" />}
          </span>
          <span className="min-w-0">
            <Link to={r.to} className={`rounded font-semibold text-rc-navy hover:underline ${focusRing}`}>
              {r.name}
            </Link>
            <span className="block text-xs text-slate-500">{r.type}</span>
          </span>
        </span>
      ),
    },
    { id: 'submitted', header: 'Submitted', sortValue: (r) => r.item.submittedAt, cell: (r) => <DateText at={r.item.submittedAt} /> },
    { id: 'detail', header: 'Details', className: 'hidden lg:table-cell', cell: (r) => <span className="text-slate-600">{r.detail}</span> },
    { id: 'status', header: 'Status', cell: (r) => <VerificationBadge status={r.item.status} /> },
    {
      id: 'action',
      header: '',
      align: 'right',
      cell: (r) => (
        <Link to={r.to} aria-label={`${r.item.status === 'PENDING' ? 'Review' : 'View'} ${r.name}`} className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`}>
          {r.item.status === 'PENDING' ? 'Review' : 'View'} <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ),
    },
  ]

  const count = (v: View) =>
    !ready ? undefined : v === 'decided' ? decided.length : v === 'pending' ? pending.length : pending.filter((i) => i.subject === (v === 'organizations' ? 'ORGANIZATION' : 'DRIVER')).length

  return (
    <div>
      <PageHeader title="Approvals" description="Review new organizations and drivers before they take part. Nothing is approved automatically." />
      <section aria-label="Applications" className={panel}>
        <Toolbar>
          <FilterTabs
            label="Show"
            value={view}
            onChange={(v) => setParams(v === 'pending' ? {} : { view: v }, { replace: true })}
            options={[
              { id: 'pending' as View, label: 'All pending', count: count('pending'), alert: true },
              { id: 'organizations' as View, label: 'Organizations', count: count('organizations'), alert: true },
              { id: 'drivers' as View, label: 'Drivers', count: count('drivers'), alert: true },
              { id: 'decided' as View, label: 'Decided', count: count('decided') },
            ]}
          />
        </Toolbar>
        {!ready ? (
          orgs.error || drivers.error ? <SectionError message="We couldn't load applications. Please try again." /> : <SkeletonRows rows={4} label="Loading applications" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-6 w-6" />}
            title={view === 'decided' ? 'No decisions recorded yet' : 'All caught up'}
            text={view === 'decided' ? 'Approved and rejected applications will be listed here.' : 'No applications are waiting for review.'}
          />
        ) : (
          <DataTable
            caption="Applications, with submission date, details, and status"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.item.id}
            noun={['application', 'applications']}
            resetKey={view}
            card={(r) => (
              <Link to={r.to} className={`flex items-start gap-3 p-4 ${focusRing} focus-visible:ring-inset`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium text-slate-500">{r.type}</span>
                  <span className="block font-semibold text-rc-navy">{r.name}</span>
                  <span className="block text-sm text-slate-600">{r.detail}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <VerificationBadge status={r.item.status} />
                    Submitted <DateText at={r.item.submittedAt} />
                  </span>
                </span>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              </Link>
            )}
          />
        )}
      </section>
    </div>
  )
}
