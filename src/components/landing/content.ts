import { CarFront, HandHeart, Layers, Waypoints, type LucideIcon } from 'lucide-react'

// Everything the public website says lives here, so copy can change without touching layout.
// Rule for this file: say what exists today as fact, and label everything else as planned.
// No invented numbers, endorsements, or legal status.

export const LINKS = {
  github: 'https://github.com/Relay-Collective',
  repo: 'https://github.com/Relay-Collective/Relay-Collective',
  license: 'https://github.com/Relay-Collective/Relay-Collective/blob/main/LICENSE',
  signIn: '/signin',
  register: '/register',
  registerOrg: '/register?role=partner',
  registerDriver: '/register?role=driver',
  // The pitch walkthrough shows the real transportation screens, step by step
  transportTour: '/demo',
} as const

export const TAGLINE = 'Stronger communities. Built together.'

export const MISSION =
  'Relay Collective is building shared digital infrastructure that connects nonprofit organizations, volunteers, and community resources, making it easier to coordinate services, collaborate across organizations, and reach the people who need support.'

export interface NavItem {
  id: string
  label: string
}

// Each item jumps to a section on this page. Resources is the footer's resources column.
export const NAV: NavItem[] = [
  { id: 'platform', label: 'Platform' },
  { id: 'solutions', label: 'Modules' },
  { id: 'impact', label: 'Impact' },
  { id: 'resources', label: 'Resources' },
]

export const PARTNER = {
  name: 'The Salvation Army',
  program: 'Belkin Communities of Hope',
  place: 'Vancouver, BC',
}

/* ---------- Trust strip: facts, not figures ---------- */

export const TRUST: { label: string; value: string }[] = [
  { label: 'Pilot partner', value: `${PARTNER.name} – ${PARTNER.program}` },
  { label: 'Where it began', value: 'FaithTech HACKVAN 2026' },
  { label: 'Built in', value: 'Vancouver, British Columbia' },
  { label: 'Open source', value: 'MIT licensed, on GitHub' },
]

/* ---------- Capabilities ---------- */

// 'live' works in the app today. 'partial' has a real first step. 'planned' is direction, not product.
export type Availability = 'live' | 'partial' | 'planned'

export interface Capability {
  id: string
  area: string
  title: string
  text: string
  status: string
  availability: Availability
  icon: LucideIcon
  accent: 'electric' | 'cantaloupe'
}

// The foundation comes first: it is the product. Transportation is the first module built on it.
export const CAPABILITIES: Capability[] = [
  {
    id: 'organizations',
    area: 'Shared foundation',
    title: 'Build on common ground.',
    text: 'Every organization gets the same base: a workspace for its team, invitations, role-based access, and one place for requests. It is built once, shared by everyone, and every module runs on it.',
    status: 'Working today',
    availability: 'live',
    icon: Waypoints,
    accent: 'electric',
  },
  {
    id: 'transport',
    area: 'CareRide · Transportation',
    title: 'Move people.',
    text: 'CareRide is the first module on the foundation. Staff request a ride, a verified driver accepts it, and it stays in view until drop-off.',
    status: 'Working today',
    availability: 'live',
    icon: CarFront,
    accent: 'electric',
  },
  {
    id: 'volunteers',
    area: 'Volunteer coordination',
    title: 'Mobilize communities.',
    text: 'Connect volunteers with the organizations that need them. Volunteer drivers can sign up today.',
    status: 'Drivers today, more roles planned',
    availability: 'partial',
    icon: HandHeart,
    accent: 'cantaloupe',
  },
  {
    id: 'grow',
    area: 'Next modules',
    title: 'Built to grow.',
    text: 'Resource sharing and cross-organization services are planned next. Each new module starts from what the others already proved, so no organization builds it alone.',
    status: 'Planned',
    availability: 'planned',
    icon: Layers,
    accent: 'cantaloupe',
  },
]

// What sits in the shared foundation, whatever module an organization runs. All of these work today.
export const FOUNDATION: string[] = ['Organization workspaces', 'Invitations and teams', 'Role-based access', 'Requests and status']

/* ---------- How it works ---------- */

export const STEPS: { n: string; title: string; text: string }[] = [
  { n: '01', title: 'Join the foundation', text: 'Set up your organization’s workspace and invite your team. Every organization is reviewed before it goes live.' },
  { n: '02', title: 'Turn on what you need', text: 'Start with transportation today. Each module uses the same accounts, roles, and requests, so there is nothing new to learn.' },
  { n: '03', title: 'Grow with the network', text: 'What one organization helps build, every other one can use. Resource sharing and cross-organization services are planned.' },
]

/* ---------- Impact: what is true today, in words ---------- */

export const IMPACT_POINTS: { title: string; text: string }[] = [
  {
    title: 'Shared before bespoke',
    text: 'One foundation, maintained together. A small organization gets the same tools as a large one, without building its own.',
  },
  {
    title: 'Open by default',
    text: 'Open source under the MIT license. Anyone can see how it works, use it, and help build the next module.',
  },
  {
    title: 'Dignity first',
    text: 'Every module asks only for what the job needs. The people being supported need no account, and are never treated as a case.',
  },
]

export const TEAM = [
  { name: 'Noah Hamm', handle: 'maxiomattic' },
  { name: 'Aditya Padmarajan', handle: 'adi-padmarajan' },
  { name: 'Gilbert Fung', handle: 'gilbertfung' },
]
