import { Info, UserMinus, UsersRound } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import { useLoadable } from '../../hooks/useLoadable'
import { initials } from '../../logic/initials'
import { roleLabel } from '../../logic/membership'
import { dataService } from '../../services'
import type { OrgRole, Organization, OrganizationMember } from '../../types'
import { ConfirmDialog } from '../admin/ConfirmDialog'
import { DataTable, type Column } from '../admin/DataTable'
import { DateText, DetailList, Notice, SearchField, Toolbar } from '../admin/controls'
import { dangerOutlineButton, primaryButton, secondaryButton } from '../ui'
import { EmptyState, SectionError, SkeletonRows } from '../workspace/states'
import { compactButton, focusRing } from '../workspace/styles'
import { MemberRoleSelector, MemberStatusBadge, RoleBadge } from './MemberRoleSelector'
import { ModalDialog } from './ModalDialog'

// The organization's members. Everyone sees names and roles; administrators also see sign-in emails and
// can change roles or remove people. The backend checks every change again.
export function MemberDirectory({ org, isAdmin }: { org: Organization | undefined; isAdmin: boolean }) {
  const { refresh } = useApp()
  const [includeFormer, setIncludeFormer] = useState(false)
  const members = useLoadable(() => dataService.listOrganizationMembers(includeFormer), String(includeFormer))
  const [search, setSearch] = useState('')
  const [managing, setManaging] = useState<OrganizationMember>()
  const [done, setDone] = useState<string>()

  const q = search.trim().toLowerCase()
  const shown = (members.data ?? []).filter((m) => !q || m.name.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))

  const columns: Column<OrganizationMember>[] = [
    { id: 'name', header: 'Name', sortValue: (m) => m.name.toLowerCase(), cell: (m) => <Person member={m} /> },
    ...(isAdmin
      ? [
          {
            id: 'email',
            header: 'Email',
            className: 'hidden lg:table-cell',
            sortValue: (m: OrganizationMember) => m.email,
            cell: (m: OrganizationMember) => <span className="text-slate-600">{m.email ?? '—'}</span>,
          },
        ]
      : []),
    { id: 'role', header: 'Organization role', sortValue: (m) => m.role, cell: (m) => <RoleBadge role={m.role} /> },
    { id: 'status', header: 'Status', sortValue: (m) => m.status, cell: (m) => <MemberStatusBadge status={m.status} /> },
    { id: 'joined', header: 'Date joined', sortValue: (m) => m.joinedAt, cell: (m) => <DateText at={m.joinedAt} /> },
    {
      id: 'actions',
      header: '',
      align: 'right',
      cell: (m) => (
        <button type="button" className={`${secondaryButton} ${compactButton}`} onClick={() => setManaging(m)}>
          {isAdmin && m.status === 'active' && !m.isYou ? 'Manage' : 'View'}
          <span className="sr-only"> {m.name}</span>
        </button>
      ),
    },
  ]

  return (
    <div>
      <Toolbar>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-semibold text-slate-600">
          <input type="checkbox" className="h-5 w-5 accent-rc-blue" checked={includeFormer} onChange={(e) => setIncludeFormer(e.target.checked)} />
          Show former members
        </label>
        <SearchField
          value={search}
          onChange={setSearch}
          label="Search members"
          placeholder={isAdmin ? 'Search by name or email' : 'Search by name'}
        />
      </Toolbar>
      {done && (
        <div className="px-4 pt-4">
          <Notice tone="success" onDismiss={() => setDone(undefined)}>
            {done}
          </Notice>
        </div>
      )}
      {members.error && !members.data ? (
        <SectionError message="We couldn't load your team." />
      ) : !members.data ? (
        <SkeletonRows label="Loading members" />
      ) : shown.length === 0 ? (
        <EmptyState
          icon={<UsersRound className="h-6 w-6" />}
          title={q ? 'No members match your search' : 'No members yet'}
          text={q ? 'Try part of a name instead.' : undefined}
        />
      ) : (
        <DataTable
          caption={`Members of ${org?.name ?? 'your organization'}`}
          columns={columns}
          rows={shown}
          rowKey={(m) => m.id}
          noun={['member', 'members']}
          initialSort={{ id: 'name', direction: 'asc' }}
          resetKey={`${q}-${includeFormer}`}
          card={(m) => (
            <button type="button" onClick={() => setManaging(m)} className={`flex w-full items-start gap-3 px-4 py-4 text-left ${focusRing}`}>
              <div className="min-w-0 flex-1">
                <Person member={m} />
                {m.email && <p className="mt-1 truncate text-sm text-slate-600">{m.email}</p>}
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <RoleBadge role={m.role} />
                  <MemberStatusBadge status={m.status} />
                </p>
              </div>
            </button>
          )}
        />
      )}

      <MemberDialog
        org={org}
        member={managing}
        canManage={isAdmin}
        onClose={() => setManaging(undefined)}
        onChanged={(message) => {
          setManaging(undefined)
          setDone(message)
          refresh()
        }}
      />
    </div>
  )
}

function Person({ member }: { member: OrganizationMember }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rc-navy text-xs font-bold text-white" aria-hidden>
        {initials(member.name)}
      </span>
      <span className="min-w-0 truncate font-semibold text-rc-navy">{member.name}</span>
      {member.isYou && <span className="rounded-full bg-rc-mint px-2 py-0.5 text-xs font-semibold text-rc-teal-ink">You</span>}
    </span>
  )
}

function MemberDialog({
  org,
  member,
  canManage,
  onClose,
  onChanged,
}: {
  org: Organization | undefined
  member: OrganizationMember | undefined
  canManage: boolean
  onClose: () => void
  onChanged: (message: string) => void
}) {
  const [shownId, setShownId] = useState<string>()
  const [role, setRole] = useState<OrgRole>()
  const [confirm, setConfirm] = useState<'promote' | 'remove'>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  if (member && member.id !== shownId) {
    setShownId(member.id)
    setRole(member.role)
    setConfirm(undefined)
    setError(undefined)
  }
  if (!member)
    return (
      <ModalDialog open={false} title="" onClose={onClose}>
        {null}
      </ModalDialog>
    )

  const editable = canManage && member.status === 'active' && !member.isYou
  const changed = role !== member.role

  async function run(action: () => Promise<void>, message: string) {
    setBusy(true)
    setError(undefined)
    try {
      await action()
      onChanged(message)
    } catch (err) {
      setError((err as Error).message)
      setConfirm(undefined)
    } finally {
      setBusy(false)
    }
  }

  const saveRole = () =>
    run(() => dataService.setMemberRole(member.id, role!), `${member.name} is now ${role === 'ADMIN' ? 'an administrator' : 'staff'}.`)

  return (
    <>
      <ModalDialog
        open={!confirm}
        busy={busy}
        onClose={onClose}
        title={member.name}
        description={`${roleLabel(member.role)} at ${org?.name ?? 'your organization'}`}
        footer={
          editable ? (
            <>
              <button
                type="button"
                className={primaryButton}
                disabled={!changed || busy}
                // Giving someone more access asks once more; taking it away doesn't need to
                onClick={() => (role === 'ADMIN' ? setConfirm('promote') : void saveRole())}
              >
                {busy ? 'Saving…' : 'Save role'}
              </button>
              <button type="button" className={dangerOutlineButton} disabled={busy} onClick={() => setConfirm('remove')}>
                <UserMinus className="h-5 w-5" aria-hidden /> Remove from organization
              </button>
            </>
          ) : (
            <button type="button" className={secondaryButton} onClick={onClose}>
              Close
            </button>
          )
        }
      >
        <div className="space-y-5">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <DetailList
              rows={[
                ['Name', member.name],
                ...(member.email ? ([['Email', member.email]] as [string, string][]) : []),
                ['Organization', org?.name ?? '—'],
                ['Role', <RoleBadge role={member.role} />],
                ['Status', <MemberStatusBadge status={member.status} />],
                ['Joined', <DateText at={member.joinedAt} />],
                ...(member.removedAt ? ([['Removed', <DateText at={member.removedAt} />]] as [string, ReactNode][]) : []),
              ]}
            />
          </div>
          {editable && <MemberRoleSelector legend="Organization role" value={role} onChange={setRole} disabled={busy} />}
          {canManage && member.isYou && (
            <p className="flex items-start gap-2 text-sm text-slate-500">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              You can't change your own role or remove yourself. Another administrator can do that for you.
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </p>
          )}
        </div>
      </ModalDialog>

      <ConfirmDialog
        open={confirm === 'promote'}
        title={`Make ${member.name} an administrator?`}
        body={
          <>
            <p>Administrators can approve and decline requests to join, invite people, change anyone's role, and remove members, including you.</p>
            <p>Only give this role to people you trust to manage your team.</p>
          </>
        }
        confirmLabel="Make administrator"
        busy={busy}
        onConfirm={() => void saveRole()}
        onCancel={() => setConfirm(undefined)}
      />
      <ConfirmDialog
        open={confirm === 'remove'}
        title={`Remove ${member.name}?`}
        tone="danger"
        body={
          <>
            <p>They'll lose access to {org?.name ?? 'your organization'}'s workspace straight away.</p>
            <p>Their Relay Collective sign-in isn't deleted, and rides they booked stay in your history. They could ask to join again later.</p>
          </>
        }
        confirmLabel="Remove member"
        busy={busy}
        onConfirm={() => void run(() => dataService.removeMember(member.id), `${member.name} was removed from your organization.`)}
        onCancel={() => setConfirm(undefined)}
      />
    </>
  )
}
