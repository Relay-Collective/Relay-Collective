import { Blocks, Building2, CircleHelp, Inbox, LayoutDashboard, MessagesSquare, UsersRound } from 'lucide-react'
import type { NavEntry, NavGroup } from '../components/shell/SidebarNav'
import { LIVE_MODULES } from './modules'
import { paths } from './paths'


// The workspace sidebar. Only working destinations belong here: planned modules stay off it.
export const WORKSPACE_NAV: NavGroup[] = [
  {
    items: [
      { to: paths.overview, label: 'Overview', icon: LayoutDashboard, end: true },
      { to: paths.requests, label: 'Requests', icon: Inbox, badge: 'attention' },
    ],
  },
  {
    // The working modules first, then the page that lists every module, planned ones included
    label: 'Services',
    items: [
      ...LIVE_MODULES.map((m) => ({ to: m.to, label: m.name, icon: m.icon })),
      { to: paths.services, label: 'All services', icon: Blocks, end: true },
    ],
  },
  {
    label: 'Organization',
    items: [
      { to: paths.organization, label: 'Organization profile', icon: Building2 },
      { to: paths.team, label: 'Team', icon: UsersRound, badge: 'joinRequests' },
    ],
  },
]

export const HELP_NAV: NavEntry = { to: paths.help, label: 'Help and support', icon: CircleHelp }
export const MY_FEEDBACK_NAV: NavEntry = { to: paths.feedback, label: 'My feedback', icon: MessagesSquare, badge: 'feedback' }

// The page name shown in the workspace header, from the most specific matching address
const TITLES: [prefix: string, title: string][] = [
  [paths.newRide, 'Transportation'],
  [paths.destinations, 'Transportation'],
  [paths.transport, 'Transportation'],
  [paths.requests, 'Requests'],
  [paths.services, 'Services'],
  [paths.organization, 'Organization profile'],
  [paths.team, 'Team'],
  [paths.help, 'Help and support'],
  [paths.feedback, 'My feedback'],
  [paths.overview, 'Overview'],
]

export function workspaceTitle(pathname: string): string {
  return TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? 'Workspace'
}
