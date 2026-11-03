import { Building2, ChevronRight, Search, Truck, User as UserIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ORG_KIND, USER_KIND } from '../../admin/labels'
import { adminPaths } from '../../admin/paths'
import { SearchField } from '../../components/admin/controls'
import { PageHeader } from '../../components/workspace/PageHeader'
import { SkeletonRows } from '../../components/workspace/states'
import { focusRing, panel, panelHead, panelTitle } from '../../components/workspace/styles'
import { useAdmin } from '../../hooks/useAdmin'
import { matches } from '../../logic/adminSummary'
import { formatDayTime } from '../../logic/formatTime'
import { requestReference } from '../../modules/careride/domain'

const LIMIT = 10

interface Hit {
  id: string
  to: string
  title: string
  detail: string
}

// One search across organizations, people, and ride references
export function AdminSearch() {
  const { orgs, accounts, rides, orgName } = useAdmin()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const ready = orgs.data && accounts.data

  const orgHits: Hit[] = q.trim()
    ? (orgs.data ?? []).filter((o) => matches(q, o.name, o.contactName)).map((o) => ({ id: o.id, to: adminPaths.organization(o.id), title: o.name, detail: ORG_KIND[o.type].label }))
    : []
  const userHits: Hit[] = q.trim()
    ? (accounts.data ?? [])
        .filter((u) => matches(q, u.name, u.email))
        .map((u) => ({ id: u.id, to: adminPaths.user(u.id), title: u.name, detail: [USER_KIND[u.role], u.email].filter(Boolean).join(' · ') }))
    : []
  const ref = q.trim().replace(/^#/, '').toUpperCase()
  const rideHits: Hit[] =
    ref.length >= 4
      ? (rides.data ?? [])
          .filter((r) => requestReference(r.id).includes(ref))
          .map((r) => ({ id: r.id, to: adminPaths.ride(r.id), title: `Ride #${requestReference(r.id)}`, detail: `${orgName(r.orgId) ?? ''} · ${formatDayTime(r.pickupTime)}` }))
      : []

  return (
    <div className="space-y-6">
      <PageHeader title="Search" description="Find organizations, people, and rides by reference." />
      <SearchField value={q} onChange={(v) => setParams(v ? { q: v } : {}, { replace: true })} label="Search organizations, people, and ride references" placeholder="Name, email, or ride reference" />
      {!q.trim() ? (
        <p className="text-sm text-slate-600">Type a name, an email, or a ride reference like #F90AE7.</p>
      ) : !ready ? (
        <div className={panel}>
          <SkeletonRows rows={3} label="Searching" />
        </div>
      ) : orgHits.length + userHits.length + rideHits.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Search className="h-4 w-4" aria-hidden /> Nothing matches “{q.trim()}”.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          <Results title="Organizations" icon={<Building2 className="h-4 w-4" />} hits={orgHits} />
          <Results title="People" icon={<UserIcon className="h-4 w-4" />} hits={userHits} />
          {rideHits.length > 0 && <Results title="Rides" icon={<Truck className="h-4 w-4" />} hits={rideHits} />}
        </div>
      )}
    </div>
  )
}

function Results({ title, icon, hits }: { title: string; icon: ReactNode; hits: Hit[] }) {
  return (
    <section aria-label={title} className={panel}>
      <div className={panelHead}>
        <h2 className={`${panelTitle} flex items-center gap-2`}>
          <span className="text-slate-500" aria-hidden>
            {icon}
          </span>
          {title}
        </h2>
        <span className="text-sm text-slate-500">{hits.length}</span>
      </div>
      {hits.length === 0 ? (
        <p className="px-5 py-4 text-sm text-slate-600">No matches.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {hits.slice(0, LIMIT).map((h) => (
            <li key={h.id}>
              <Link to={h.to} className={`flex items-center gap-3 px-5 py-3 hover:bg-slate-50 ${focusRing} focus-visible:ring-inset`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-rc-navy">{h.title}</span>
                  <span className="block truncate text-sm text-slate-600">{h.detail}</span>
                </span>
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {hits.length > LIMIT && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Showing the first {LIMIT}. Add more to your search to narrow it.</p>}
    </section>
  )
}
