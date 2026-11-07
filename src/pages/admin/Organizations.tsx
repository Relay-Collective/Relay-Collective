import { Building2, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ORG_KIND } from '../../admin/labels'
import { adminPaths } from '../../admin/paths'
import { DataTable, type Column } from '../../components/admin/DataTable'
import { DateText, FilterTabs, SearchField, Toolbar } from '../../components/admin/controls'
import { VerificationBadge } from '../../components/admin/VerificationBadge'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { focusRing, panel } from '../../components/workspace/styles'
import { useAdmin } from '../../hooks/useAdmin'
import { matches } from '../../logic/adminSummary'
import type { Organization, OrgType, VerificationStatus } from '../../types'

const PAGE_SIZE = 20

type StatusFilter = 'all' | VerificationStatus
type TypeFilter = 'all' | OrgType

const STATUS_OPTIONS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'PENDING', label: 'Pending review' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Not approved' },
]

// Every organization on the platform: nonprofits that request services and providers that deliver them
export function Organizations() {
  const { orgs } = useAdmin()
  const [params, setParams] = useSearchParams()
  const status = (STATUS_OPTIONS.find((o) => o.id === params.get('status'))?.id ?? 'all') as StatusFilter
  const type = (['PARTNER_ORG', 'TRANSPORT_PROVIDER'].includes(params.get('type') ?? '') ? params.get('type') : 'all') as TypeFilter
  const [query, setQuery] = useState('')

  const setFilter = (key: 'status' | 'type', value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const all = orgs.data ?? []
  const ofType = all.filter((o) => type === 'all' || o.type === type)
  const filtered = ofType.filter((o) => (status === 'all' || o.status === status) && matches(query, o.name, o.contactName))

  const columns: Column<Organization>[] = [
    {
      id: 'name',
      header: 'Organization',
      sortValue: (o) => o.name.toLowerCase(),
      cell: (o) => (
        <>
          <Link to={adminPaths.organization(o.id)} className={`rounded font-semibold text-rc-navy hover:underline ${focusRing}`}>
            {o.name}
          </Link>
          <span className="block text-xs text-slate-500">{ORG_KIND[o.type].label}</span>
        </>
      ),
    },
    { id: 'status', header: 'Status', sortValue: (o) => o.status, cell: (o) => <VerificationBadge status={o.status} /> },
    { id: 'registered', header: 'Registered', sortValue: (o) => o.createdAt, cell: (o) => <DateText at={o.createdAt} /> },
    { id: 'contact', header: 'Contact', className: 'hidden lg:table-cell', cell: (o) => o.contactName },
    { id: 'services', header: 'Services', className: 'hidden xl:table-cell', cell: (o) => <span className="text-slate-600">{ORG_KIND[o.type].service}</span> },
    {
      id: 'action',
      header: '',
      align: 'right',
      cell: (o) => (
        <Link
          to={o.status === 'PENDING' ? adminPaths.review('organizations', o.id) : adminPaths.organization(o.id)}
          className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`}
          aria-label={`${o.status === 'PENDING' ? 'Review' : 'View'} ${o.name}`}
        >
          {o.status === 'PENDING' ? 'Review' : 'View'} <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Organizations" description="Nonprofits and transport providers registered on Relay Collective." />
      <section aria-label="Organizations" className={panel}>
        <Toolbar>
          <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
            <FilterTabs
              label="Status"
              value={status}
              onChange={(v) => setFilter('status', v)}
              options={STATUS_OPTIONS.map((o) => ({
                ...o,
                count: orgs.data ? ofType.filter((x) => o.id === 'all' || x.status === o.id).length : undefined,
                alert: o.id === 'PENDING',
              }))}
            />
            <label className="sr-only" htmlFor="org-type">
              Type
            </label>
            <select
              id="org-type"
              value={type}
              onChange={(e) => setFilter('type', e.target.value)}
              className={`min-h-11 rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-rc-navy ${focusRing}`}
            >
              <option value="all">All types</option>
              <option value="PARTNER_ORG">Partner organizations</option>
              <option value="TRANSPORT_PROVIDER">Transport providers</option>
            </select>
          </div>
          <SearchField
            value={query}
            onChange={setQuery}
            label="Search organizations by name or contact"
            placeholder="Search name or contact"
          />
        </Toolbar>

        {!orgs.data ? (
          orgs.error ? <SectionError message="We couldn't load organizations. Please try again." /> : <SkeletonRows rows={6} label="Loading organizations" />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title={all.length === 0 ? 'No organizations yet' : 'No organizations match'}
            text={all.length === 0 ? 'Organizations appear here once they register.' : 'Try another filter or search.'}
          />
        ) : (
          <DataTable
              caption="Organizations, with status, registration date, and contact"
              columns={columns}
              rows={filtered}
              pageSize={PAGE_SIZE}
              noun={['organization', 'organizations']}
              resetKey={`${status}|${type}|${query}`}
              rowKey={(o) => o.id}
              initialSort={{ id: 'name', direction: 'asc' }}
              highlight={(o) => o.status === 'PENDING'}
              card={(o) => (
                <Link to={adminPaths.organization(o.id)} className={`flex items-start gap-3 p-4 ${focusRing} focus-visible:ring-inset`}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-rc-navy">{o.name}</span>
                    <span className="block text-sm text-slate-600">
                      {ORG_KIND[o.type].label} · {o.contactName}
                    </span>
                    <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <VerificationBadge status={o.status} />
                      Registered <DateText at={o.createdAt} />
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
