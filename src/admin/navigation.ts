import { Activity, Blocks, Building2, ClipboardCheck, Flag, LayoutDashboard, MessagesSquare, Settings, Users } from 'lucide-react'
import { CareRideMark } from '../components/brand/CareRideMark'
import type { NavGroup } from '../components/shell/SidebarNav'
import { adminPaths } from './paths'

// The admin sidebar. Every entry is a working page; nothing here is a placeholder.
export const ADMIN_NAV: NavGroup[] = [
  { label: 'Overview', items: [{ to: adminPaths.overview, label: 'Dashboard', icon: LayoutDashboard, end: true }] },
  {
    label: 'Platform management',
    items: [
      { to: adminPaths.organizations, label: 'Organizations', icon: Building2 },
      { to: adminPaths.users, label: 'Users', icon: Users },
      { to: adminPaths.approvals, label: 'Approvals', icon: ClipboardCheck, badge: 'approvals' },
    ],
  },
  {
    label: 'Service management',
    items: [
      { to: adminPaths.services, label: 'Modules', icon: Blocks },
      // Transportation operations: the CareRide module
      { to: adminPaths.transportation, label: 'CareRide', icon: CareRideMark },
    ],
  },
  {
    label: 'Operations',
    items: [
      { to: adminPaths.activity, label: 'Activity', icon: Activity },
      { to: adminPaths.issues, label: 'Issues', icon: Flag, badge: 'issues' },
      { to: adminPaths.feedback, label: 'Feedback', icon: MessagesSquare, badge: 'feedback' },
    ],
  },
  { label: 'Administration', items: [{ to: adminPaths.settings, label: 'Settings', icon: Settings }] },
]

// The section name in the header, from the most specific matching address
const TITLES: [prefix: string, title: string][] = [
  [adminPaths.organizations, 'Organizations'],
  [adminPaths.users, 'Users'],
  [adminPaths.approvals, 'Approvals'],
  [adminPaths.services, 'Modules'],
  [adminPaths.transportation, 'CareRide'],
  [adminPaths.activity, 'Activity'],
  [adminPaths.issues, 'Issues'],
  [adminPaths.feedback, 'Feedback'],
  [adminPaths.settings, 'Settings'],
  [adminPaths.search, 'Search'],
  [adminPaths.overview, 'Dashboard'],
]

export function adminTitle(pathname: string): string {
  return TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? 'Dashboard'
}
