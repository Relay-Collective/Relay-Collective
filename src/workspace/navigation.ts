import { Blocks, Building2, CircleHelp, LayoutDashboard, MessagesSquare, UsersRound } from 'lucide-react'
import type { NavEntry, NavGroup } from '../components/shell/SidebarNav'
import { ACTIVE_MODULES } from './modules'
import { paths } from './paths'

// The workspace sidebar: the shared platform first, then the modules the organization works in.
// Only working destinations belong here. Planned modules are shown on the overview and the modules page, never as links.
export const WORKSPACE_NAV: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { to: paths.overview, label: 'Overview', icon: LayoutDashboard, end: true },
      { to: paths.organization, label: 'Organization', icon: Building2 },
      { to: paths.team, label: 'Team', icon: UsersRound, badge: 'joinRequests' },
    ],
  },
  {
    label: 'Your modules',
    items: [
      // CareRide's requests list lives at /workspace/requests (kept for old links), so it counts as inside CareRide
      ...ACTIVE_MODULES.map((m) => ({ to: m.route, label: m.name, icon: m.icon, badge: 'attention', match: [paths.requests] })),
      { to: paths.services, label: 'All modules', icon: Blocks, end: true },
    ],
  },
]

export const HELP_NAV: NavEntry = { to: paths.help, label: 'Help and support', icon: CircleHelp }
export const MY_FEEDBACK_NAV: NavEntry = { to: paths.feedback, label: 'My feedback', icon: MessagesSquare, badge: 'feedback' }

// The pages inside CareRide. The workspace header names the module; each page's h1 names the page.
const CARERIDE_PAGES = [paths.transport, paths.requests]

// The section name in the workspace header, from the most specific matching address
const TITLES: [prefix: string, title: string][] = [
  ...CARERIDE_PAGES.map((p): [string, string] => [p, 'CareRide']),
  [paths.services, 'Modules'],
  [paths.organization, 'Organization profile'],
  [paths.team, 'Team'],
  [paths.help, 'Help and support'],
  [paths.feedback, 'My feedback'],
  [paths.overview, 'Overview'],
]

export function workspaceTitle(pathname: string): string {
  return TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? 'Workspace'
}

export function inCareRide(pathname: string): boolean {
  return CARERIDE_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
