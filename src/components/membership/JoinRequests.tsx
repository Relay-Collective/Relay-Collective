import { BadgeCheck, CircleAlert, Inbox, Mail, UserCheck, UserX } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useApp } from '../../hooks/useApp'
import { useLoadable } from '../../hooks/useLoadable'
import { initials } from '../../logic/initials'
import { ORG_ROLES, roleLabel } from '../../logic/membership'
import { dataService } from '../../services'
import { MAX_REVIEW_NOTE } from '../../services/dataService'
import type { JoinRequest, OrgRole, Organization } from '../../types'
import { DataTable, type Column } from '../admin/DataTable'
import { DateText, DetailList, FilterTabs, Notice, Toolbar } from '../admin/controls'
import { TextAreaField } from '../form/TextAreaField'
import { dangerButton, primaryButton, secondaryButton } from '../ui'
import { EmptyState, SectionError, SkeletonRows } from '../workspace/states'
import { compactButton, focusRing } from '../workspace/styles'
import { MemberRoleSelector, RequestStatusBadge } from './MemberRoleSelector'
import { ModalDialog } from './ModalDialog'

type Filter = 'pending' | 'all'

// Requests to join the organization, newest first, and the review of one. Approving creates the membership
// with the role chosen here; the applicant never picks their own.
export function JoinRequests({ org }: { org: Organization | undefined }) {
  const { refresh } = useApp()
  const [filter, setFilter] = useState<Filter>('pending')
  const requests = useLoadable(() => dataService.listJoinRequests(filter), filter)
  const [reviewing, setReviewing] = useState<JoinRequest>()
  const [done, setDone] = useState<string>()
  const pendingCount = filter === 'pending' ? requests.data?.length : undefined

  const columns: Column<JoinRequest>[] = [
    {
      id: 'name',
      header: 'Applicant',
      sortValue: (r) => r.applicantName.toLowerCase(),
      cell: (r) => <Applicant request={r} />,
    },
    {
      id: 'email',
      header: 'Email',
      className: 'hidden lg:table-cell',
      sortValue: (r) => r.applicantEmail,
      cell: (r) => <span className="text-slate-600">{r.applicantEmail}</span>,
    },
    { id: 'position', header: 'Requested position', cell: (r) => r.requestedPosition ?? <span className="text-slate-500">Not given</span> },
    { id: 'date', header: 'Submitted', sortValue: (r) => r.createdAt, cell: (r) => <DateText at={r.createdAt} /> },
    { id: 'status', header: 'Status', cell: (r) => <RequestStatusBadge status={r.status} /> },
    {
      id: 'review',
      header: '',
      align: 'right',
      cell: (r) => (
        <button
          type="button"
          className={`${r.status === 'pending' ? primaryButton : secondaryButton} ${compactButton}`}
          onClick={() => setReviewing(r)}
        >
          {r.status === 'pending' ? 'Review' : 'View'}
          <span className="sr-only"> request from {r.applicantName}</span>
        </button>
      ),
    },
  ]

  return (
    <div>
      <Toolbar>
        <FilterTabs<Filter>
          label="Show requests"
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'pending', label: 'Pending', count: pendingCount, alert: true },
            { id: 'all', label: 'All requests' },
          ]}
        />
      </Toolbar>
      {done && (
        <div className="px-4 pt-4">
          <Notice tone="success" onDismiss={() => setDone(undefined)}>
            {done}
          </Notice>
        </div>
      )}
      {requests.error && !requests.data ? (
        <SectionError message="We couldn't load requests to join." />
      ) : !requests.data ? (
        <SkeletonRows label="Loading requests" />
      ) : requests.data.length === 0 ? (
        <EmptyState
          icon={<Inbox className="h-6 w-6" />}
          title={filter === 'pending' ? 'No pending requests' : 'No requests yet'}
          text={
            org?.discoverability === 'discoverable'
              ? 'New membership requests will appear here for review.'
              : 'New membership requests will appear here for review. Your organization is invitation only, so people can’t find it to ask yet.'
          }
        />
      ) : (
        <DataTable
          caption="Requests to join your organization"
          columns={columns}
          rows={requests.data}
          rowKey={(r) => r.id}
          noun={['request', 'requests']}
          initialSort={{ id: 'date', direction: 'desc' }}
          highlight={(r) => r.status === 'pending'}
          resetKey={filter}
          card={(r) => (
            <button type="button" onClick={() => setReviewing(r)} className={`flex w-full items-start gap-3 px-4 py-4 text-left ${focusRing}`}>
              <div className="min-w-0 flex-1">
                <Applicant request={r} />
                <p className="mt-1 truncate text-sm text-slate-600">{r.applicantEmail}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {r.requestedPosition ?? 'No position given'} · <DateText at={r.createdAt} />
                </p>
              </div>
              <RequestStatusBadge status={r.status} />
            </button>
          )}
        />
      )}

      <ReviewDialog
        org={org}
        request={reviewing}
        onClose={() => setReviewing(undefined)}
        onDecided={(message) => {
          setReviewing(undefined)
          setDone(message)
          refresh()
        }}
      />
    </div>
  )
}

function Applicant({ request }: { request: JoinRequest }) {
  return (
    <span className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rc-canvas text-xs font-bold text-rc-navy" aria-hidden>
        {initials(request.applicantName)}
      </span>
      <span className="min-w-0 truncate font-semibold text-rc-navy">{request.applicantName}</span>
    </span>
  )
}

// How a request was decided, for requests that already were
function decision(request: JoinRequest): [string, ReactNode][] {
  const rows: [string, ReactNode][] = []
  if (request.reviewedAt) {
    rows.push([
      'Reviewed',
      <span>
        {request.reviewedByName ? `${request.reviewedByName}, ` : ''}
        <DateText at={request.reviewedAt} withTime />
      </span>,
    ])
  }
  if (request.assignedRole) rows.push(['Role given', roleLabel(request.assignedRole)])
  if (request.reviewNote) rows.push(['Note (administrators only)', request.reviewNote])
  return rows
}

type Stage = 'review' | 'approve' | 'reject'

function ReviewDialog({
  org,
  request,
  onClose,
  onDecided,
}: {
  org: Organization | undefined
  request: JoinRequest | undefined
  onClose: () => void
  onDecided: (message: string) => void
}) {
  const [shownId, setShownId] = useState<string>()
  const [stage, setStage] = useState<Stage>('review')
  // Least privilege by default: an administrator has to choose Administrator on purpose
  const [role, setRole] = useState<OrgRole | undefined>('STAFF')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  // A different request opened: start its review fresh
  if (request && request.id !== shownId) {
    setShownId(request.id)
    setStage('review')
    setRole('STAFF')
    setNote('')
    setError(undefined)
  }

  if (!request)
    return (
      <ModalDialog open={false} title="" onClose={onClose}>
        {null}
      </ModalDialog>
    )
  const pending = request.status === 'pending'
  const chosen = ORG_ROLES.find((r) => r.value === role)

  async function decide(action: () => Promise<void>, message: string) {
    setBusy(true)
    setError(undefined)
    try {
      await action()
      onDecided(message)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const footer = !pending ? (
    <button type="button" className={secondaryButton} onClick={onClose}>
      Close
    </button>
  ) : stage === 'review' ? (
    <>
      <button type="button" className={primaryButton} onClick={() => (role ? setStage('approve') : setError('Choose a role for this member.'))}>
        <UserCheck className="h-5 w-5" aria-hidden /> Approve Request
      </button>
      <button type="button" className={secondaryButton} onClick={() => setStage('reject')}>
        <UserX className="h-5 w-5" aria-hidden /> Reject Request
      </button>
    </>
  ) : stage === 'approve' ? (
    <>
      <button
        type="button"
        className={primaryButton}
        disabled={busy}
        onClick={() =>
          void decide(
            () => dataService.approveJoinRequest(request.id, role!),
            `${request.applicantName} is now a member of ${org?.name ?? 'your organization'}.`,
          )
        }
      >
        {busy ? 'Approving…' : `Approve as ${roleLabel(role!)}`}
      </button>
      <button type="button" className={secondaryButton} disabled={busy} onClick={() => setStage('review')}>
        Go back
      </button>
    </>
  ) : (
    <>
      <button
        type="button"
        className={dangerButton}
        disabled={busy}
        onClick={() => void decide(() => dataService.rejectJoinRequest(request.id, note), `The request from ${request.applicantName} was declined.`)}
      >
        {busy ? 'Declining…' : 'Decline request'}
      </button>
      <button type="button" className={secondaryButton} disabled={busy} onClick={() => setStage('review')}>
        Go back
      </button>
    </>
  )

  return (
    <ModalDialog
      open
      busy={busy}
      onClose={onClose}
      title={stage === 'approve' ? 'Approve this request?' : stage === 'reject' ? 'Decline this request?' : `Request from ${request.applicantName}`}
      description={stage === 'review' && <RequestStatusBadge status={request.status} />}
      footer={footer}
    >
      {stage === 'review' && (
        <div className="space-y-5">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <DetailList
              rows={[
                ['Applicant', request.applicantName],
                [
                  'Email',
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <Mail className="h-4 w-4 text-slate-400" aria-hidden />
                    {request.applicantEmail}
                    {request.emailVerified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Verified
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-amber-800">Not verified</span>
                    )}
                  </span>,
                ],
                ['Requested position', request.requestedPosition ?? 'Not given'],
                ['Submitted', <DateText at={request.createdAt} withTime />],
                ['Organization', org?.name ?? '—'],
                ...decision(request),
              ]}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-rc-navy">Their message</p>
            {request.message ? (
              <blockquote className="mt-1.5 whitespace-pre-line break-words rounded-xl border border-slate-200 bg-rc-canvas p-4 text-sm text-slate-700">
                {request.message}
              </blockquote>
            ) : (
              <p className="mt-1 text-sm text-slate-500">They didn't include a message.</p>
            )}
          </div>
          {pending && (
            <MemberRoleSelector
              legend="Role if approved"
              value={role}
              onChange={(r) => {
                setRole(r)
                setError(undefined)
              }}
            />
          )}
          <p className="flex items-start gap-2 text-sm text-slate-500">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Their requested position is what they told you; it doesn't decide their access. Only approve people you can confirm work or volunteer with
            your organization.
          </p>
        </div>
      )}

      {stage === 'approve' && chosen && (
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            <strong className="text-rc-navy">{request.applicantName}</strong> ({request.applicantEmail}) will join{' '}
            <strong className="text-rc-navy">{org?.name ?? 'your organization'}</strong> as <strong className="text-rc-navy">{chosen.label}</strong>.
          </p>
          <div className="rounded-xl border border-slate-200 bg-rc-canvas p-4">
            <p className="font-semibold text-rc-navy">As {chosen.label.toLowerCase()}, they can:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {chosen.can.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
          {role === 'ADMIN' && (
            <p className="font-medium text-amber-900">Administrators can manage your whole team, including other administrators.</p>
          )}
          <p>You can change their role or remove them later from the Members tab.</p>
        </div>
      )}

      {stage === 'reject' && (
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            <strong className="text-rc-navy">{request.applicantName}</strong> won't get access. They'll see that their request wasn't approved,
            without any reason.
          </p>
          <TextAreaField
            id="reject-note"
            label="Note for your administrators"
            optional
            rows={3}
            maxLength={MAX_REVIEW_NOTE}
            hint="Kept with the request for your organization’s administrators. The applicant never sees it."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </ModalDialog>
  )
}
