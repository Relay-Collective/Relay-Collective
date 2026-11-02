import { Info } from 'lucide-react'
import { useRef, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { JoinRequests } from '../../components/membership/JoinRequests'
import { MemberDirectory } from '../../components/membership/MemberDirectory'
import { PageHeader } from '../../components/workspace/PageHeader'
import { TeamInvitations } from '../../components/workspace/TeamInvitations'
import { focusRing, panel } from '../../components/workspace/styles'
import { useWorkspace } from '../../hooks/useWorkspace'

type Tab = 'members' | 'requests' | 'invitations'

// Organization → Team: who has access to the workspace, who is asking to join, and invitations.
// Administrators manage; staff see the member directory. The backend checks every change again.
export function Team() {
  const { org, isAdmin, pendingJoinRequests } = useWorkspace()
  const [params, setParams] = useSearchParams()
  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'members', label: 'Members' },
    ...(isAdmin
      ? [
          { id: 'requests' as const, label: 'Join requests', count: pendingJoinRequests },
          { id: 'invitations' as const, label: 'Invitations' },
        ]
      : []),
  ]
  const asked = params.get('tab') as Tab | null
  const tab: Tab = tabs.some((t) => t.id === asked) ? asked! : 'members'
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  function select(id: Tab) {
    setParams(id === 'members' ? {} : { tab: id }, { replace: true })
  }

  // Arrow keys move between tabs (the ARIA tabs pattern)
  function onKeyDown(e: KeyboardEvent) {
    const i = tabs.findIndex((t) => t.id === tab)
    const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : -1
    if (next < 0) return
    e.preventDefault()
    select(tabs[next]!.id)
    tabRefs.current[tabs[next]!.id]?.focus()
  }

  return (
    <div>
      <PageHeader title="Team and memberships" description="Manage the people who have access to your organization's Relay Collective workspace." />

      <section className={panel}>
        <div role="tablist" aria-label="Team" className="-mb-px flex gap-1 overflow-x-auto border-b border-slate-200 px-3" onKeyDown={onKeyDown}>
          {tabs.map((t) => {
            const on = t.id === tab
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el
                }}
                id={`team-tab-${t.id}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls={`team-panel-${t.id}`}
                tabIndex={on ? 0 : -1}
                onClick={() => select(t.id)}
                className={`inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors duration-150 ease-out-quart ${focusRing} focus-visible:ring-inset focus-visible:ring-offset-0 ${
                  on ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-rc-navy'
                }`}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="rounded-full bg-sun-400 px-1.5 py-0.5 text-xs font-bold tabular-nums text-ink">
                    {t.count}
                    <span className="sr-only"> pending</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div role="tabpanel" id={`team-panel-${tab}`} aria-labelledby={`team-tab-${tab}`}>
          {tab === 'members' && <MemberDirectory org={org} isAdmin={isAdmin} />}
          {tab === 'requests' && <JoinRequests org={org} />}
          {tab === 'invitations' && <TeamInvitations org={org} isAdmin={isAdmin} />}
        </div>
      </section>

      {!isAdmin && (
        <p className="mt-4 flex items-start gap-2 text-sm text-slate-500">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Your organization's administrators review requests to join, send invitations, and manage roles.
        </p>
      )}
    </div>
  )
}
