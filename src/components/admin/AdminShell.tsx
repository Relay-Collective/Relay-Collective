import { Outlet } from 'react-router-dom'
import { AdminProvider } from '../../context/AdminProvider'
import { SidebarShell } from '../shell/SidebarShell'
import { AppFooter, LoadErrorBanner } from '../ShellNotices'
import { AdminHeader } from './AdminHeader'
import { AdminSidebar } from './AdminSidebar'

// The platform admin console. Only platform admins reach it (RequireRole), and every read and
// change it makes is checked again by the database, which is what actually protects the data.
export function AdminShell() {
  return (
    <AdminProvider>
      <SidebarShell
        storageKey="rc-admin-sidebar-collapsed"
        maxWidth="max-w-7xl"
        sidebar={(props) => <AdminSidebar {...props} />}
        header={(props) => <AdminHeader {...props} />}
        footer={<AppFooter />}
      >
        <LoadErrorBanner />
        <Outlet />
      </SidebarShell>
    </AdminProvider>
  )
}
