import {
  CalendarCheck,
  CalendarClock,
  CircleHelp,
  HeartHandshake,
  Inbox,
  LayoutDashboard,
  MessagesSquare,
  Settings,
  Truck,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { CareRideMark } from '../modules/careride/brand'
import type { NavEntry, NavGroup } from '../components/shell/SidebarNav'
import { volunteerPaths as paths } from './paths'
import type { VolunteerWorkspace } from './workspace'

// The volunteer sidebar, from what this person actually takes part in. Only working destinations belong here,
// and hiding one is never the protection: the route guards and the database are.
//
// CareRide drivers keep the workspace they've always had. Requests and commitments exist only for approved
// drivers, so a driver still in review sees just the pages that work for them. General volunteers get no
// CareRide destinations at all, whatever their interests: they have no driver profile.

// Pages that belong to CareRide driving. Only DRIVER accounts reach them (App.tsx); everyone else goes home.
export const CARERIDE_PATHS: readonly string[] = [paths.opportunities, paths.commitments, paths.transport, paths.availability, paths.verification]

export function isCareRidePath(pathname: string): boolean {
  return CARERIDE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

const INTERESTS: NavEntry = { to: paths.interests, label: 'My interests', icon: HeartHandshake }
const PROFILE: NavEntry = { to: paths.profile, label: 'My profile', icon: UserRound }
const SETTINGS: NavEntry = { to: paths.settings, label: 'Settings', icon: Settings }

export function volunteerNav(ws: VolunteerWorkspace): NavGroup[] {
  if (ws.experience === 'GENERAL_VOLUNTEER') {
    return [
      { label: 'Workspace', items: [{ to: paths.overview, label: 'Overview', icon: LayoutDashboard, end: true }, INTERESTS] },
      { label: 'Personal', items: [PROFILE, SETTINGS] },
    ]
  }
  return [
    {
      label: 'Workspace',
      items: [
        { to: paths.overview, label: 'Overview', icon: LayoutDashboard, end: true },
        ...(ws.approvedToDrive
          ? [
              { to: paths.opportunities, label: 'Opportunities', icon: Inbox, badge: 'requests' },
              { to: paths.commitments, label: 'My commitments', icon: CalendarCheck },
            ]
          : []),
      ],
    },
    // Driving is part of CareRide, the transportation module. It is not the planned Volunteer coordination module.
    { label: 'Your modules', items: [{ to: paths.transport, label: 'CareRide', icon: CareRideMark }] },
    // Interests are open to drivers too: a driver from before general volunteering can add theirs there
    { label: 'Personal', items: [{ to: paths.availability, label: 'Availability', icon: CalendarClock }, INTERESTS, PROFILE, SETTINGS] },
  ]
}

export const VOLUNTEER_HELP_NAV: NavEntry = { to: paths.help, label: 'Help', icon: CircleHelp }
export const VOLUNTEER_FEEDBACK_NAV: NavEntry = { to: paths.feedback, label: 'My feedback', icon: MessagesSquare, badge: 'feedback' }

// Phones: the few places people go most, always one tap away
export interface TabEntry {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: 'requests'
}

export function volunteerTabs(ws: VolunteerWorkspace): TabEntry[] {
  if (ws.experience === 'GENERAL_VOLUNTEER') {
    return [
      { to: paths.overview, label: 'Overview', icon: LayoutDashboard, end: true },
      { to: paths.interests, label: 'Interests', icon: HeartHandshake },
      { to: paths.profile, label: 'Profile', icon: UserRound },
    ]
  }
  return [
    { to: paths.overview, label: 'Overview', icon: LayoutDashboard, end: true },
    ...(ws.approvedToDrive ? [{ to: paths.opportunities, label: 'Requests', icon: Inbox, badge: 'requests' as const }] : []),
    { to: paths.transport, label: 'Rides', icon: Truck },
    { to: paths.availability, label: 'Availability', icon: CalendarClock },
    { to: paths.profile, label: 'Profile', icon: UserRound },
  ]
}

// The page name shown in the header, from the most specific matching address
const TITLES: [prefix: string, title: string][] = [
  [paths.rides, 'My rides'],
  [paths.transport, 'CareRide'],
  [paths.opportunities, 'Opportunities'],
  [paths.commitments, 'My commitments'],
  [paths.availability, 'Availability'],
  [paths.verification, 'Driver verification'],
  [paths.profile, 'My profile'],
  [paths.interests, 'My interests'],
  [paths.careRideApply, 'Apply to drive'],
  [paths.settings, 'Settings'],
  [paths.help, 'Help'],
  [paths.feedback, 'My feedback'],
  [paths.overview, 'Overview'],
]

export function volunteerTitle(pathname: string): string {
  return TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? 'Volunteer workspace'
}
