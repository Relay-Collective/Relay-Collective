import { MessageSquarePlus } from 'lucide-react'
import { useFeedback } from '../../hooks/useFeedback'
import { useNow } from '../../hooks/useNow'
import { useWorkspace } from '../../hooks/useWorkspace'
import { initials } from '../../logic/initials'
import { requestMetrics } from '../../modules/careride/domain'
import { HELP_NAV, MY_FEEDBACK_NAV, WORKSPACE_NAV } from '../../workspace/navigation'
import { paths } from '../../workspace/paths'
import { SidebarNav } from '../shell/SidebarNav'
import type { SidebarSlotProps } from '../shell/SidebarShell'

// The workspace's navigation. One account belongs to one organization, so there is nothing to switch to.
export function WorkspaceSidebar(props: SidebarSlotProps) {
  const { org, rides, pendingJoinRequests } = useWorkspace()
  const { openFeedback, unseenCount } = useFeedback()
  const now = useNow()
  const attention = rides.data ? requestMetrics(rides.data, new Date(now)).attention : 0

  return (
    <SidebarNav
      {...props}
      home={{ to: paths.overview, label: 'Relay Collective workspace home' }}
      context={{
        initials: org ? initials(org.name) : '',
        title: org?.name ?? 'Your organization',
        subtitle: 'Nonprofit workspace',
        className: 'bg-brand-600 text-white', // the partner tone: electric
      }}
      groups={WORKSPACE_NAV}
      footer={[HELP_NAV, MY_FEEDBACK_NAV]}
      actions={[{ label: 'Send feedback', icon: MessageSquarePlus, onClick: () => openFeedback() }]}
      badges={{
        attention: { count: attention, label: 'need attention' },
        feedback: { count: unseenCount, label: 'with new updates', tone: 'waiting' },
        joinRequests: { count: pendingJoinRequests ?? 0, label: 'waiting to join', tone: 'waiting' },
      }}
    />
  )
}
