import { Boxes, HeartHandshake, Users, type LucideIcon } from 'lucide-react'
import type { ComponentType, SVGProps } from 'react'
import { CareRideBrandMark, CareRideMark } from '../modules/careride/brand'
import { paths } from './paths'

// The service modules Relay Collective offers. Each one runs on the shared platform (organization, team,
// accounts and access); a module adds one kind of work on top. This is frontend configuration only:
// nothing here is stored, and modules aren't switched on per organization yet.
//
// A module gets a route, and a place in the navigation, only once it is built. Until then it is planned
// and never looks like something you can open. The public site describes modules in components/landing/content.ts.
export type ModuleStatus = 'active' | 'planned'
export type ModuleId = 'careride' | 'volunteer-coordination' | 'resource-sharing' | 'collaboration'

// Lucide icons and the CareRide mark both fit
export type ModuleIcon = LucideIcon | ComponentType<SVGProps<SVGSVGElement>>

interface ModuleBase {
  id: ModuleId
  name: string
  category: string
  description: string // the full sentence, for the modules page
  summary: string // one short line, for compact cards
  icon: ModuleIcon // one colour (currentColor), for navigation
  brandIcon?: ModuleIcon // the module's own colours, for its tile
  accent: 'electric' | 'slate'
}

export interface ActiveModule extends ModuleBase {
  status: 'active'
  route: string // the module's home in the workspace
  tagline: string // under the module's name inside it
  actionLabel: string
}

export interface PlannedModule extends ModuleBase {
  status: 'planned'
}

export type ServiceModule = ActiveModule | PlannedModule

export const CARERIDE: ActiveModule = {
  id: 'careride',
  name: 'CareRide',
  category: 'Transportation',
  description: 'Coordinate reliable transportation to essential services through connected organizations and volunteer drivers.',
  summary: 'Rides to essential services, with volunteer drivers.',
  icon: CareRideMark,
  brandIcon: CareRideBrandMark,
  accent: 'electric',
  status: 'active',
  route: paths.transport,
  tagline: 'Transportation coordination',
  actionLabel: 'Open CareRide',
}

export const SERVICE_MODULES: ServiceModule[] = [
  CARERIDE,
  {
    id: 'volunteer-coordination',
    name: 'Volunteer coordination',
    category: 'Volunteering',
    description: 'Organize volunteer opportunities, schedules, and participation across community programs.',
    summary: 'Coordinate volunteer opportunities, scheduling, and participation.',
    icon: Users,
    accent: 'slate',
    status: 'planned',
  },
  {
    id: 'resource-sharing',
    name: 'Resource sharing',
    category: 'Resources',
    description: 'Help organizations coordinate and share supplies, equipment, and community resources.',
    summary: 'Connect organizations with resources and supplies that support their communities.',
    icon: Boxes,
    accent: 'slate',
    status: 'planned',
  },
  {
    id: 'collaboration',
    name: 'Cross-organization collaboration',
    category: 'Collaboration',
    description: 'Coordinate services and share capacity with other nonprofits, with hand-offs that stay visible.',
    summary: 'Share capacity with other nonprofits, with hand-offs that stay visible.',
    icon: HeartHandshake,
    accent: 'slate',
    status: 'planned',
  },
]

export const ACTIVE_MODULES = SERVICE_MODULES.filter((m): m is ActiveModule => m.status === 'active')
export const PLANNED_MODULES = SERVICE_MODULES.filter((m): m is PlannedModule => m.status === 'planned')

// The planned modules an organization's overview previews. The full list lives on the modules page.
export const FEATURED_PLANNED: PlannedModule[] = PLANNED_MODULES.filter((m) => m.id === 'volunteer-coordination' || m.id === 'resource-sharing')
