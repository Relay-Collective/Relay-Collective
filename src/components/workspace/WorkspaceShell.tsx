import { Outlet } from 'react-router-dom'
import { onboardingPaths } from '../../onboarding/routing'
import { WorkspaceProvider } from '../../context/WorkspaceProvider'
import { JoinRequestNotice, MembershipApprovedNotice } from '../membership/MembershipNotices'
import { useWorkspace } from '../../hooks/useWorkspace'
import { SidebarShell } from '../shell/SidebarShell'
import { AppFooter, LoadErrorBanner, PendingApprovalNotice, RideNotices } from '../ShellNotices'
import { WorkspaceHeader } from './WorkspaceHeader'
import { WorkspaceSidebar } from './WorkspaceSidebar'

// A partner organization's signed-in app.
export function WorkspaceShell() {
  return (
    <WorkspaceProvider>
      <ShellFrame />
    </WorkspaceProvider>
  )
}

function ShellFrame() {
  const { org } = useWorkspace()
  return (
    <SidebarShell
      storageKey="rc-workspace-sidebar-collapsed"
      sidebar={(props) => <WorkspaceSidebar {...props} />}
      header={(props) => <WorkspaceHeader {...props} />}
      banner={
        org?.status === 'PENDING' && (
          <div className="no-print border-b border-amber-200 bg-sun-50">
            <PendingApprovalNotice isDriver={false} statusLink={onboardingPaths.application} className="px-4 py-3 sm:px-6 lg:px-8" />
          </div>
        )
      }
      footer={<AppFooter />}
    >
      <RideNotices />
      <LoadErrorBanner />
      <MembershipApprovedNotice />
      <JoinRequestNotice />
      <Outlet />
    </SidebarShell>
  )
}
