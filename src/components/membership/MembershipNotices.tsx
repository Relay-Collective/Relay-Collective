import { ArrowRight, PartyPopper, UserPlus, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useApp } from '../../hooks/useApp'
import { useWorkspace } from '../../hooks/useWorkspace'
import { dataService } from '../../services'
import type { MyJoinRequest } from '../../types'
import { paths } from '../../workspace/paths'
import { markSeen, readSeen } from '../seenNotices'
import { focusRing } from '../workspace/styles'

// In-app notices about membership, built on what the backend says (there's no email for these yet).
// Each one shows once per request, until dismissed or acted on.

const NEW_REQUESTS = 'join-requests'
const APPROVED = 'join-approved'

// Administrators: someone asked to join. Says who only on the Team page, never in a banner.
export function JoinRequestNotice() {
  const { currentUser } = useApp()
  const { isAdmin, pendingJoinRequestIds } = useWorkspace()
  const { pathname } = useLocation()
  const userId = currentUser?.id ?? ''
  const [seen, setSeen] = useState(() => readSeen(userId, NEW_REQUESTS))
  const unseen = pendingJoinRequestIds.filter((id) => !seen.includes(id))

  if (!isAdmin || !unseen.length || pathname === paths.team) return null

  const dismiss = () => {
    let next = seen
    for (const id of unseen) next = markSeen(userId, NEW_REQUESTS, id)
    setSeen(next)
  }

  return (
    <Banner
      icon={<UserPlus className="h-5 w-5" aria-hidden />}
      title="New team membership request"
      text={
        unseen.length === 1
          ? 'Someone has requested to join your organization’s workspace.'
          : `${unseen.length} people have requested to join your organization’s workspace.`
      }
      action={{ to: paths.teamTab('requests'), label: 'Review requests' }}
      onDismiss={dismiss}
    />
  )
}

// A new member: their request was approved. Looked up once per sign-in.
export function MembershipApprovedNotice() {
  const { currentUser } = useApp()
  const { org } = useWorkspace()
  const userId = currentUser?.id ?? ''
  const [approved, setApproved] = useState<MyJoinRequest>()

  useEffect(() => {
    if (!userId) return
    let active = true
    dataService.listMyJoinRequests().then(
      (list) => {
        const latest = list.find((r) => r.status === 'approved' && r.orgId === currentUser?.orgId)
        if (active && latest && !readSeen(userId, APPROVED).includes(latest.id)) setApproved(latest)
      },
      () => {}, // only a welcome; nothing to show if it can't be checked
    )
    return () => {
      active = false
    }
  }, [userId, currentUser?.orgId])

  if (!approved) return null
  const dismiss = () => {
    markSeen(userId, APPROVED, approved.id)
    setApproved(undefined)
  }

  return (
    <Banner
      tone="success"
      icon={<PartyPopper className="h-5 w-5" aria-hidden />}
      title="Membership approved"
      text={`Your request to join ${org?.name ?? approved.orgName} has been approved. Welcome to the workspace.`}
      action={{ to: paths.overview, label: 'Go to overview' }}
      onDismiss={dismiss}
    />
  )
}

function Banner({
  tone = 'info',
  icon,
  title,
  text,
  action,
  onDismiss,
}: {
  tone?: 'info' | 'success'
  icon: ReactNode
  title: string
  text: string
  action: { to: string; label: string }
  onDismiss: () => void
}) {
  const box = tone === 'success' ? 'border-emerald-200 bg-emerald-50' : 'border-brand-100 bg-brand-50/60'
  return (
    <div role="status" className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${box}`}>
      <span className={tone === 'success' ? 'text-emerald-700' : 'text-rc-blue'}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-rc-navy">{title}</p>
        <p className="mt-0.5 text-sm text-slate-700">{text}</p>
        <Link
          to={action.to}
          onClick={onDismiss}
          className={`mt-2 inline-flex items-center gap-1 rounded text-sm font-semibold text-rc-blue hover:underline ${focusRing}`}
        >
          {action.label} <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Dismiss: ${title}`}
        className={`-m-1 rounded-lg p-2 text-slate-500 hover:bg-black/5 ${focusRing}`}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}
