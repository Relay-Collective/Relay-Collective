import { ChevronRight, Users as UsersIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { USER_KIND, USER_KIND_ORDER } from '../../admin/labels'
import { adminPaths } from '../../admin/paths'
import { DataTable, type Column } from '../../components/admin/DataTable'
import { FilterTabs, Notice, SearchField, Toolbar } from '../../components/admin/controls'
import { VerificationBadge } from '../../components/admin/VerificationBadge'
import { PageHeader } from '../../components/workspace/PageHeader'
import { EmptyState, SectionError, SkeletonRows } from '../../components/workspace/states'
import { focusRing, panel } from '../../components/workspace/styles'
import { useAdmin } from '../../hooks/useAdmin'
import { useApp } from '../../hooks/useApp'
import { DELETED_NAME } from '../../logic/accountDeletion'
import { matches } from '../../logic/adminSummary'
import type { User, UserRole } from '../../types'

type RoleFilter = 'all' | UserRole

// Everyone who can sign in. Roles are set when an account is created, and can't be changed from here.
export function Users() {
  const { currentUser } = useApp()
  const { accounts, drivers, orgName } = useAdmin()
  const [params, setParams] = useSearchParams()
  const { state } = useLocation() as { state: { deleted?: string } | null }
  const [deleted, setDeleted] = useState(state?.deleted)
  const picked = params.get('role') as UserRole | null
  const role: RoleFilter = picked && USER_KIND_ORDER.includes(picked) ? picked : 'all'
  const [query, setQuery] = useState('')

  const all = accounts.data ?? []
  const filtered = all.filter((u) => (role === 'all' || u.role === role) && matches(query, u.name, u.email, orgName(u.orgId)))
  const driverOf = (u: User) => drivers.data?.find((d) => d.userId === u.id)

  const status = (u: User) => {
    if (u.deletionStatus) {
      const stopped = u.deletionStatus === 'failed' || u.deletionStatus === 'requires_attention'
      return (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${stopped ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-800'}`}>
          {stopped ? 'Deletion needs attention' : 'Being deleted'}
        </span>
      )
    }
    const d = u.role === 'DRIVER' ? driverOf(u) : undefined
    return d ? <VerificationBadge status={d.status} /> : <span className="text-sm text-slate-600">Can sign in</span>
  }

  const columns: Column<User>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (u) => u.name.toLowerCase(),
      cell: (u) => (
        <Link to={adminPaths.user(u.id)} className={`rounded font-semibold text-rc-navy hover:underline ${focusRing}`}>
          {u.name}
          {u.id === currentUser?.id && <span className="ml-1.5 font-normal text-slate-500">(you)</span>}
        </Link>
      ),
    },
    { id: 'email', header: 'Email', className: 'hidden lg:table-cell', sortValue: (u) => u.email, cell: (u) => <span className="block max-w-[15rem] truncate text-slate-700" title={u.email}>{u.email}</span> },
    { id: 'role', header: 'Role', sortValue: (u) => USER_KIND[u.role], cell: (u) => USER_KIND[u.role] },
    { id: 'org', header: 'Organization', className: 'hidden xl:table-cell', sortValue: (u) => orgName(u.orgId), cell: (u) => orgName(u.orgId) ?? <span className="text-slate-500">—</span> },
    { id: 'status', header: 'Status', cell: status },
    {
      id: 'action',
      header: '',
      align: 'right',
      cell: (u) => (
        <Link to={adminPaths.user(u.id)} aria-label={`View ${u.name}`} className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`}>
          View <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      ),
    },
  ]

  const setRole = (r: RoleFilter) => setParams(r === 'all' ? {} : { role: r }, { replace: true })

  return (
    <div className="space-y-4">
      <PageHeader
        title="Users"
        description="Everyone who can sign in to Relay Collective. Platform admins manage the platform; every other account belongs to one organization or is a driver."
      />
      {deleted && (
        <Notice tone="success" onDismiss={() => setDeleted(undefined)}>
          {deleted === DELETED_NAME ? 'Permanently deleted the account.' : `Permanently deleted ${deleted}’s account.`}
        </Notice>
      )}
      <section aria-label="Users" className={panel}>
        <Toolbar>
          <FilterTabs
            label="Role"
            value={role}
            onChange={setRole}
            options={[
              { id: 'all' as RoleFilter, label: 'All', count: accounts.data ? all.length : undefined },
              ...USER_KIND_ORDER.map((r) => ({ id: r as RoleFilter, label: USER_KIND[r], count: accounts.data ? all.filter((u) => u.role === r).length : undefined })),
            ]}
          />
          <SearchField value={query} onChange={setQuery} label="Search users by name, email, or organization" placeholder="Search name, email, organization" />
        </Toolbar>
        {!accounts.data ? (
          accounts.error ? <SectionError message="We couldn't load accounts. Please try again." /> : <SkeletonRows rows={6} label="Loading users" />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<UsersIcon className="h-6 w-6" />} title="No users match" text="Try another role or search." />
        ) : (
          <DataTable
            caption="Users, with email, role, organization, and status"
            columns={columns}
            rows={filtered}
            rowKey={(u) => u.id}
            noun={['user', 'users']}
            resetKey={`${role}|${query}`}
            initialSort={{ id: 'name', direction: 'asc' }}
            card={(u) => (
              <Link to={adminPaths.user(u.id)} className={`flex items-start gap-3 p-4 ${focusRing} focus-visible:ring-inset`}>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-rc-navy">
                    {u.name}
                    {u.id === currentUser?.id && <span className="ml-1.5 font-normal text-slate-500">(you)</span>}
                  </span>
                  <span className="block break-all text-sm text-slate-600">{u.email}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    {USER_KIND[u.role]}
                    {orgName(u.orgId) && ` · ${orgName(u.orgId)}`}
                    {status(u)}
                  </span>
                </span>
                <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-slate-400" aria-hidden />
              </Link>
            )}
          />
        )}
      </section>
      <p className="text-sm text-slate-500">
        Roles are set when an account is created and can’t be changed here. Drivers a transport provider added without a sign-in aren’t listed.
      </p>
    </div>
  )
}
