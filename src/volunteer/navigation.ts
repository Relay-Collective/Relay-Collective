import { CalendarCheck, CalendarClock, CircleHelp, HeartHandshake, Inbox, LayoutDashboard, MessagesSquare, Settings, Truck, UserRound, type LucideIcon } from 'lucide-react'
import { CareRideMark } from '../modules/careride/brand'
import type { NavEntry, NavGroup } from '../components/shell/SidebarNav'
import { volunteerPaths as paths } from './paths'

// The volunteer sidebar. Only working destinations belong here. Requests and commitments exist only
// for approved drivers, so a driver still in review sees just the pages that work for them.
export function volunteerNav(approved: boolean): NavGroup[] {
  return [
    {
      label: 'Workspace',
      items: [
        { to: paths.overview, label: 'Overview', icon: LayoutDashboard, end: true },
        ...(approved
          ? [
              { to: paths.opportunities, label: 'Opportunities', icon: Inbox, badge: 'requests' },
              { to: paths.commitments, label: 'My commitments', icon: CalendarCheck },
            ]
          : []),
      ],
    },
    // Driving is part of CareRide, the transportation module. It is not the planned Volunteer coordination module.
    { label: 'Your modules', items: [{ to: paths.transport, label: 'CareRide', icon: CareRideMark }] },
    {
      label: 'Personal',
      items: [
        { to: paths.availability, label: 'Availability', icon: CalendarClock },
        { to: paths.profile, label: 'My profile', icon: UserRound },
        { to: paths.settings, label: 'Settings', icon: Settings },
      ],
    },
  ]
}

// A general volunteer's sidebar: no CareRide or driving pages, because the account has no driver profile.
// Planned services aren't listed either: only destinations that work today.
export function generalVolunteerNav(): NavGroup[] {
  return [
    { label: 'Workspace', items: [{ to: paths.overview, label: 'Overview', icon: LayoutDashboard, end: true }] },
    {
      label: 'Personal',
      items: [
        { to: paths.interests, label: 'Volunteering interests', icon: HeartHandshake },
        { to: paths.settings, label: 'Settings', icon: Settings },
      ],
    },
  ]
}

export const VOLUNTEER_HELP_NAV: NavEntry = { to: paths.help, label: 'Help', icon: CircleHelp }
export const VOLUNTEER_FEEDBACK_NAV: NavEntry = { to: paths.feedback, label: 'My feedback', icon: MessagesSquare, badge: 'feedback' }

// Phones: the few places drivers go most, always one tap away
export interface TabEntry {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: 'requests'
}

export function volunteerTabs(approved: boolean): TabEntry[] {
  return [
    { to: paths.overview, label: 'Overview', icon: LayoutDashboard, end: true },
    ...(approved ? [{ to: paths.opportunities, label: 'Requests', icon: Inbox, badge: 'requests' as const }] : []),
    { to: paths.transport, label: 'Rides', icon: Truck },
    { to: paths.availability, label: 'Availability', icon: CalendarClock },
    { to: paths.profile, label: 'Profile', icon: UserRound },
  ]
}

export function generalVolunteerTabs(): TabEntry[] {
  return [
    { to: paths.overview, label: 'Overview', icon: LayoutDashboard, end: true },
    { to: paths.interests, label: 'Interests', icon: HeartHandshake },
    { to: paths.settings, label: 'Settings', icon: Settings },
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
  [paths.interests, 'Volunteering interests'],
  [paths.settings, 'Settings'],
  [paths.help, 'Help'],
  [paths.feedback, 'My feedback'],
  [paths.overview, 'Overview'],
]

export function volunteerTitle(pathname: string): string {
  return TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? 'Volunteer workspace'
}
