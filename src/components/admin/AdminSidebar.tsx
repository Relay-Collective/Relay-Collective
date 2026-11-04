import { MessageSquarePlus, ShieldCheck } from 'lucide-react'
import { ADMIN_NAV } from '../../admin/navigation'
import { adminPaths } from '../../admin/paths'
import { useAdmin } from '../../hooks/useAdmin'
import { useFeedback } from '../../hooks/useFeedback'
import { useNow } from '../../hooks/useNow'
import { approvalQueue, recentIssues, reportedIssues } from '../../logic/adminSummary'
import { SidebarNav } from '../shell/SidebarNav'
import type { SidebarSlotProps } from '../shell/SidebarShell'

// Platform administration, clearly not an organization's workspace: its own mark and name.
export function AdminSidebar(props: SidebarSlotProps) {
  const { orgs, drivers, feedback, rides, feedbackSummary } = useAdmin()
  const { openFeedback } = useFeedback()
  const now = useNow()
  const waiting = orgs.data && drivers.data ? approvalQueue(orgs.data, drivers.data).length : 0
  const issues = feedback.data ? recentIssues(reportedIssues(feedback.data, rides.data ?? []), new Date(now)).length : 0

  return (
    <SidebarNav
      {...props}
      home={{ to: adminPaths.overview, label: 'Relay Collective admin home' }}
      context={{
        initials: '',
        title: 'Platform administration',
        subtitle: 'Relay Collective',
        className: 'bg-ink text-white', // the admin tone: midnight
      }}
      contextIcon={<ShieldCheck className="h-5 w-5" />}
      groups={ADMIN_NAV}
      footer={[]}
      actions={[{ label: 'Send feedback', icon: MessageSquarePlus, onClick: () => openFeedback() }]}
      badges={{
        feedback: { count: feedbackSummary.data?.new ?? 0, label: 'new', tone: 'waiting' },
        approvals: { count: waiting, label: 'waiting for review', tone: 'waiting' },
        issues: { count: issues, label: 'reported in the last 14 days', tone: 'waiting' },
      }}
    />
  )
}
