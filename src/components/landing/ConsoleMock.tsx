import {
  Activity,
  Blocks,
  Building2,
  CalendarPlus,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  ClipboardCheck,
  Clock,
  Flag,
  HandHeart,
  HeartHandshake,
  Layers,
  LayoutDashboard,
  MessagesSquare,
  Route,
  Search,
  Settings,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { ComponentType, ReactNode } from 'react'
import { RouteField } from '../workspace/ServiceModuleCard'
import { CareRideMark } from '../../modules/careride/brand'
import { LogoMark } from '../brand/LogoMark'
import { InterestIcon } from '../volunteer/InterestPicker'
import { interestDefinition } from '../../volunteer/interests'
import { DEMO_ORG, DEMO_PLATFORM_ACTIVITY, DEMO_REVIEWS, DEMO_STAFF, DEMO_VOLUNTEER } from './demo'

// The three workspaces, drawn for the landing page: the organization's, a general volunteer's and the platform
// admin's. Each is a picture of the real screen (the same sidebar groups, labels, metrics and statuses, the route rail,
// the greeting, CareRide's electric field), with made-up data, never the screens themselves. Hidden from screen
// readers: the notes beside each picture say what it shows.

export type ShowcaseRole = 'organization' | 'volunteer' | 'admin'

type NavIcon = LucideIcon | ComponentType<{ className?: string }>
interface NavItem {
  label: string
  icon: NavIcon
  current?: boolean
  badge?: number
}
interface NavGroup {
  label: string
  items: NavItem[]
}

// The sidebars, in the app's own groups and order (workspace/, volunteer/ and admin/navigation.ts)
const NAV: Record<ShowcaseRole, NavGroup[]> = {
  organization: [
    {
      label: 'Workspace',
      items: [
        { label: 'Overview', icon: LayoutDashboard, current: true },
        { label: 'Organization', icon: Building2 },
        { label: 'Team', icon: UsersRound },
      ],
    },
    {
      label: 'Your modules',
      items: [
        { label: 'CareRide', icon: CareRideMark },
        { label: 'All modules', icon: Blocks },
      ],
    },
  ],
  // A general volunteer's sidebar (volunteer/navigation.ts): no CareRide pages, because they don't drive
  volunteer: [
    {
      label: 'Workspace',
      items: [
        { label: 'Overview', icon: LayoutDashboard, current: true },
        { label: 'My interests', icon: HeartHandshake },
      ],
    },
    {
      label: 'Personal',
      items: [
        { label: 'My profile', icon: UserRound },
        { label: 'Settings', icon: Settings },
      ],
    },
  ],
  admin: [
    { label: 'Overview', items: [{ label: 'Dashboard', icon: LayoutDashboard, current: true }] },
    {
      label: 'Platform management',
      items: [
        { label: 'Organizations', icon: Building2 },
        { label: 'Users', icon: Users },
        { label: 'Approvals', icon: ClipboardCheck, badge: 2 },
      ],
    },
    {
      label: 'Operations',
      items: [
        { label: 'Activity', icon: Activity },
        { label: 'Issues', icon: Flag },
        { label: 'Feedback', icon: MessagesSquare },
      ],
    },
  ],
}

// Who is signed in: the sidebar's context card. Organizations are electric, volunteers cantaloupe, admins midnight.
const CONTEXT: Record<ShowcaseRole, { tile: string; initials: ReactNode; name: string; detail: string; crumb: string; page: string }> = {
  organization: {
    tile: 'bg-electric-ink text-white',
    initials: 'NC',
    name: DEMO_ORG,
    detail: 'Nonprofit workspace',
    crumb: DEMO_ORG,
    page: 'Overview',
  },
  volunteer: {
    tile: 'bg-cantaloupe text-midnight',
    initials: DEMO_VOLUNTEER.initials,
    name: `${DEMO_VOLUNTEER.first} ${DEMO_VOLUNTEER.last}`,
    detail: DEMO_VOLUNTEER.detail,
    crumb: 'Volunteer workspace',
    page: 'Overview',
  },
  admin: {
    tile: 'bg-midnight text-white',
    initials: <ShieldCheck className="h-4 w-4" />,
    name: 'Platform administration',
    detail: 'Relay Collective',
    crumb: 'Platform administration',
    page: 'Dashboard',
  },
}

export function ConsoleMock({ role }: { role: ShowcaseRole }) {
  return (
    <div className="rcl-lift-lg select-none overflow-hidden rounded-2xl border border-hairline bg-white" aria-hidden>
      <div className="grid lg:grid-cols-[216px_minmax(0,1fr)]">
        <Sidebar role={role} />
        <div className="relative min-w-0 bg-porcelain">
          {/* The landing's hairline grid behind the top of every page, fading out before the work gets dense */}
          <span className="rc-grid pointer-events-none absolute inset-x-0 top-0 h-[300px]" />
          <TopBar role={role} />
          <div className="relative px-4 pb-6 pt-5 sm:px-7 sm:pb-8 sm:pt-6">
            {role === 'organization' && <OrganizationOverview />}
            {role === 'volunteer' && <VolunteerOverview />}
            {role === 'admin' && <AdminOverview />}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ---------- The frame ---------- */

// The route rail: the links are stations on one electric route, and the relay point rests on the current page
function Sidebar({ role }: { role: ShowcaseRole }) {
  const ctx = CONTEXT[role]
  return (
    <aside className="hidden flex-col border-r border-hairline bg-white px-3 pb-4 pt-4 lg:flex">
      <div className="flex items-center gap-2 px-1.5">
        <LogoMark className="h-6 w-6" />
        <span className="font-grotesk text-[15px] font-semibold tracking-[-0.03em] text-midnight">Relay Collective</span>
      </div>
      <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-hairline bg-white p-2 shadow-[var(--shadow-rest)]">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-dm text-[11px] font-bold ${ctx.tile}`}>
          {ctx.initials}
        </span>
        <span className="min-w-0 font-dm leading-tight">
          <span className="block truncate text-[12px] font-semibold text-midnight">{ctx.name}</span>
          <span className="block truncate text-[11px] text-hush">{ctx.detail}</span>
        </span>
      </div>

      <div className="relative mt-3 pl-4">
        {/* The route itself, through every station */}
        <span className="absolute bottom-[18px] left-[3px] top-[44px] w-[2px] rounded-full bg-brand-300" />
        {NAV[role].map((group) => (
          <div key={group.label}>
            <p className="px-2.5 pb-1 pt-3 font-dm text-[11px] font-medium text-hush">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ label, icon: Icon, current, badge }) => (
                <li key={label} className="relative">
                  {current ? (
                    <span className="absolute -left-[17px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-cantaloupe shadow-[0_0_0_2.5px_#fff,0_3px_6px_-1px_rgb(252_115_77/0.55)]" />
                  ) : (
                    <span className="absolute -left-[16px] top-1/2 h-[9px] w-[9px] -translate-y-1/2 rounded-full border-2 border-brand-300 bg-white" />
                  )}
                  <span
                    className={`flex items-center gap-2.5 rounded-xl px-2.5 py-[7px] font-dm text-[13px] ${
                      current ? 'bg-midnight font-semibold text-white shadow-[var(--shadow-press)]' : 'font-medium text-midnight-soft'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${current ? 'text-brand-300' : 'text-hush'}`} />
                    <span className="flex-1 truncate">{label}</span>
                    {badge && <span className="rounded-full bg-sun-400 px-1.5 text-[10px] font-bold tabular-nums text-midnight">{badge}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-2.5 border-t border-hairline px-2.5 pt-3 font-dm text-[12px] font-medium text-midnight-soft">
        <CircleHelp className="h-4 w-4 text-hush" /> Help and support
      </div>
    </aside>
  )
}

function TopBar({ role }: { role: ShowcaseRole }) {
  const ctx = CONTEXT[role]
  const who =
    role === 'organization'
      ? { initials: 'AL', name: DEMO_STAFF.first + ' ' + DEMO_STAFF.last, tone: 'bg-electric-ink text-white' }
      : role === 'volunteer'
      ? { initials: DEMO_VOLUNTEER.initials, name: DEMO_VOLUNTEER.first, tone: 'bg-cantaloupe text-midnight' }
      : { initials: 'RC', name: 'Admin', tone: 'bg-midnight text-white' }
  return (
    <div className="relative flex h-12 items-center justify-between gap-3 border-b border-midnight/[0.06] px-4 sm:px-7">
      <p className="flex min-w-0 items-center gap-1.5 font-dm text-[12px]">
        <span className="hidden truncate text-hush sm:inline">{ctx.crumb}</span>
        <ChevronRight className="hidden h-3 w-3 shrink-0 text-hush sm:block" />
        <span className="font-semibold text-midnight">{ctx.page}</span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {role === 'organization' && (
          <span className="hidden items-center gap-1.5 rounded-full bg-midnight px-3 py-1.5 font-dm text-[11px] font-semibold text-white shadow-[var(--shadow-press)] sm:inline-flex">
            <CalendarPlus className="h-3.5 w-3.5" /> Request a ride
          </span>
        )}
        {role === 'admin' && (
          <span className="hidden items-center gap-1.5 rounded-full border border-hairline bg-white px-3 py-1.5 font-dm text-[11px] text-hush md:inline-flex">
            <Search className="h-3.5 w-3.5" /> Search organizations and people
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white py-1 pl-1 pr-2 font-dm text-[11px] font-semibold text-midnight">
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${who.tone}`}>{who.initials}</span>
          <span className="hidden sm:inline">{who.name}</span>
          <ChevronDown className="h-3 w-3 text-hush" />
        </span>
      </div>
    </div>
  )
}

/* ---------- Shared pieces ---------- */

// The greeting, as the app sets it: the time of day in Instrument Serif, in cantaloupe
function Greeting({ name }: { name?: string }) {
  return (
    <p className="font-grotesk text-[26px] font-semibold leading-[1.05] tracking-[-0.035em] text-midnight sm:text-[34px]">
      Good <em className="font-editorial text-[1.1em] font-normal italic tracking-[-0.02em] text-cantaloupe-display">afternoon</em>
      {name ? `, ${name}.` : '.'}
    </p>
  )
}

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`relative min-w-0 rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-rest)] ${className}`}>{children}</div>
}

// A numbered dot that ties a spot on the picture to its note (ShowcaseNotes)
export function Marker({ n, onPicture = false }: { n: number; onPicture?: boolean }) {
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cantaloupe font-dm text-[13px] font-bold tabular-nums text-midnight ${
        onPicture ? 'absolute -left-3 -top-3 z-10 shadow-[0_0_0_4px_#fff]' : ''
      }`}
      aria-hidden
    >
      {n}
    </span>
  )
}

// The metric strip: one panel split by hairlines, label with icon, number, hint. A raised cell is tinted sun.
interface Metric {
  label: string
  value: string
  hint: string
  icon: LucideIcon
  raised?: boolean
}
function MetricStrip({ metrics, className = '' }: { metrics: Metric[]; className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-px overflow-hidden bg-hairline ${className}`}>
      {metrics.map(({ label, value, hint, icon: Icon, raised }) => (
        <div key={label} className={`min-w-0 p-3.5 sm:p-4 ${raised ? 'bg-sun-50' : 'bg-white'}`}>
          <p
            className={`flex items-center gap-1.5 font-dm text-[11px] font-semibold leading-tight ${
              raised ? 'text-amber-900' : 'text-midnight-soft'
            }`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0 self-start" /> <span>{label}</span>
          </p>
          <p className="mt-2 font-grotesk text-[28px] font-semibold leading-none tracking-[-0.03em] text-midnight tabular-nums sm:text-[32px]">
            {value}
          </p>
          <p className={`mt-2 font-dm text-[11px] leading-snug ${raised ? 'font-semibold text-amber-900' : 'text-hush'}`}>{hint}</p>
        </div>
      ))}
    </div>
  )
}

function ActiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-emerald-50 px-2 py-0.5 font-dm text-[10px] font-semibold text-emerald-800 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.18)]">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Active
    </span>
  )
}

function CareRideTile() {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 shadow-[inset_0_0_0_1px_var(--color-brand-100)]">
      <CareRideMark tone="brand" className="h-6 w-6" />
    </span>
  )
}

/* ---------- Organization: what needs attention, then the modules ---------- */

function OrganizationOverview() {
  return (
    <>
      <Greeting name={DEMO_STAFF.first} />
      <p className="mt-1.5 font-dm text-[11px] font-medium text-hush">Thursday, November 12</p>
      <p className="mt-1 font-dm text-[13px] text-midnight-soft">Here's what's happening across your organization.</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-white px-2.5 py-1 font-dm text-[11px] font-semibold text-midnight">
          <Building2 className="h-3 w-3 text-hush" /> {DEMO_ORG}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-electric-wash px-2.5 py-1 font-dm text-[11px] font-semibold text-electric-ink">
          <ShieldCheck className="h-3 w-3" /> Administrator
        </span>
      </div>

      <Panel className="mt-5 overflow-visible">
        <Marker n={1} onPicture />
        <div className="flex items-center gap-2 rounded-t-2xl border-b border-hairline bg-red-50/70 px-4 py-2.5">
          <TriangleAlert className="h-4 w-4 text-care-red" />
          <p className="font-grotesk text-[14px] font-semibold text-midnight">Needs your attention</p>
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-care-red px-1 font-dm text-[10px] font-bold text-white">
            1
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 font-dm">
            <span className="inline-flex items-center gap-1 rounded-md bg-sun-400 px-1.5 py-0.5 text-[10px] font-bold text-midnight">
              <Clock className="h-3 w-3" /> Pickup soon
            </span>
            <p className="mt-1.5 truncate text-[13px] text-midnight">
              <span className="font-semibold">Still waiting for a driver</span>
              <span className="text-midnight-soft"> · Ride to the pharmacy</span>
            </p>
            <p className="mt-0.5 truncate text-[11px] text-hush">Pickup in 40 min. We're still asking drivers.</p>
          </div>
          <span className="hidden items-center gap-0.5 font-dm text-[12px] font-semibold text-electric-ink sm:inline-flex">
            Review <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </Panel>

      <p className="mt-6 font-grotesk text-[16px] font-semibold tracking-[-0.02em] text-midnight">Your modules</p>
      <div className="mt-2.5 grid gap-3 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <Panel className="overflow-visible">
          <Marker n={2} onPicture />
          <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="p-1.5">
              <div className="flex items-start gap-2.5">
                <CareRideTile />
                <div className="min-w-0 flex-1">
                  <p className="font-grotesk text-[18px] font-semibold leading-tight tracking-[-0.025em] text-midnight">CareRide</p>
                  <p className="font-dm text-[11px] text-hush">Transportation</p>
                </div>
                <ActiveBadge />
              </div>
              <p className="mt-3 font-dm text-[12px] leading-relaxed text-midnight-soft">
                Coordinate reliable transportation to essential services through connected organizations and volunteer drivers.
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-midnight px-3.5 py-1.5 font-dm text-[11px] font-semibold text-white shadow-[var(--shadow-press)]">
                Open CareRide <ChevronRight className="h-3 w-3" />
              </span>
            </div>
            <RouteField className="hidden min-h-[130px] sm:block" />
          </div>
          <MetricStrip
            className="rounded-b-2xl border-t border-hairline sm:grid-cols-4"
            metrics={[
              { label: 'Need attention', value: '1', hint: 'Pickup in 40 min', icon: TriangleAlert, raised: true },
              { label: 'Awaiting a driver', value: '1', hint: 'Drivers are being asked', icon: Clock },
              { label: 'Confirmed or under way', value: '3', hint: 'A driver has it', icon: Route },
              { label: 'Completed', value: '12', hint: 'In the last 30 days', icon: CircleCheck },
            ]}
          />
        </Panel>

        <div className="hidden gap-3 xl:grid xl:grid-rows-2">
          <PlannedModule icon={HandHeart} name="Volunteer coordination" text="Coordinate volunteer opportunities, scheduling, and participation." />
          <PlannedModule icon={Layers} name="Resource sharing" text="Connect organizations with resources and supplies." />
        </div>
      </div>
    </>
  )
}

function PlannedModule({ icon: Icon, name, text }: { icon: LucideIcon; name: string; text: string }) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-dashed border-slate-300 bg-white/60 p-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 font-dm">
        <p className="flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-midnight">
          {name}
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-1.5 text-[10px] font-semibold text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full border border-slate-400" /> Planned
          </span>
        </p>
        <p className="mt-1 text-[11px] leading-snug text-midnight-soft">{text}</p>
      </div>
    </div>
  )
}

/* ---------- General volunteer: their interests, their profile, and CareRide as a service they could join ---------- */

// The general volunteer's real Overview (pages/volunteer/Overview.tsx), in its words: interests first, then the
// one service open to them. Nothing here is a ride, a request or an assignment, because they aren't a driver.
function VolunteerOverview() {
  return (
    <>
      <Greeting name={DEMO_VOLUNTEER.first} />
      <p className="mt-1.5 font-dm text-[11px] font-medium text-hush">Thursday, November 12</p>
      <p className="mt-1 font-dm text-[13px] text-midnight-soft">Your willingness to help makes a difference. Here's your volunteering space.</p>

      <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel className="overflow-visible">
          <Marker n={1} onPicture />
          <div className="flex items-start justify-between gap-3 border-b border-hairline px-4 py-3">
            <div className="min-w-0">
              <p className="font-grotesk text-[14px] font-semibold text-midnight">Your volunteering interests</p>
              <p className="font-dm text-[11px] text-hush">The ways you've chosen to contribute.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-0.5 font-dm text-[12px] font-semibold text-electric-ink">
              Manage interests <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
          <ul className="divide-y divide-hairline">
            {DEMO_VOLUNTEER.interests.map((id) => (
              <li key={id} className="flex items-start gap-3 px-4 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cantaloupe-wash text-cantaloupe-ink">
                  <InterestIcon interest={id} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 font-dm">
                  <p className="text-[13px] font-semibold text-midnight">{interestDefinition(id).label}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-hush">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="truncate">{id === 'TRANSPORTATION' ? 'CareRide is running. Driving is a separate enrollment.' : "Not on Relay Collective yet. We've saved your interest."}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="rounded-b-2xl border-t border-hairline px-4 py-2.5 font-dm text-[10px] text-hush">
            Interests tell us how you'd like to contribute. They don't sign you up for anything.
          </p>
        </Panel>

        <Panel className="overflow-visible">
          <Marker n={2} onPicture />
          <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
            <p className="font-grotesk text-[14px] font-semibold text-midnight">Volunteer profile</p>
            <span className="font-dm text-[12px] font-semibold text-electric-ink">View</span>
          </div>
          <dl className="divide-y divide-hairline font-dm">
            {[
              ['Name', `${DEMO_VOLUNTEER.first} ${DEMO_VOLUNTEER.last}`],
              ['Taking part as', 'General volunteer'],
              ['Volunteer since', DEMO_VOLUNTEER.since],
            ].map(([label, value]) => (
              <div key={label} className="px-4 py-2.5">
                <dt className="text-[10px] font-semibold text-hush">{label}</dt>
                <dd className="mt-0.5 truncate text-[12px] font-medium text-midnight">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <p className="mt-6 font-grotesk text-[16px] font-semibold tracking-[-0.02em] text-midnight">Available services</p>
      <Panel className="mt-2.5 overflow-visible">
        <Marker n={3} onPicture />
        <div className="grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]">
          <div className="flex items-start gap-2.5 p-1.5">
            <CareRideTile />
            <div className="min-w-0 flex-1 font-dm">
              <p className="font-grotesk text-[16px] font-semibold leading-tight tracking-[-0.02em] text-midnight">Drive with CareRide</p>
              <p className="mt-0.5 text-[12px] font-semibold text-midnight">Help people reach essential services.</p>
              <p className="mt-1.5 text-[11px] leading-snug text-midnight-soft">
                Use the account you already have. The Relay Collective team verifies every driver before any ride is sent.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-midnight px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-[var(--shadow-press)]">
                  Apply to drive <ChevronRight className="h-3 w-3" />
                </span>
                <span className="text-[11px] font-semibold text-electric-ink">Learn about CareRide</span>
              </div>
            </div>
          </div>
          <RouteField className="hidden min-h-[110px] sm:block" />
        </div>
      </Panel>
    </>
  )
}

/* ---------- Platform admin: the numbers, then what's waiting for review ---------- */

function AdminOverview() {
  return (
    <>
      <p className="font-grotesk text-[26px] font-semibold leading-[1.05] tracking-[-0.035em] text-midnight sm:text-[34px]">Platform overview</p>
      <p className="mt-1.5 font-dm text-[13px] text-midnight-soft">Monitor the organizations, services, and activity across Relay Collective.</p>

      <Panel className="mt-5 overflow-visible">
        <Marker n={1} onPicture />
        <MetricStrip
          className="rounded-2xl sm:grid-cols-3 xl:grid-cols-6"
          metrics={[
            { label: 'Organizations', value: '6', hint: '5 partners · 1 provider', icon: Building2 },
            { label: 'Pending approvals', value: '2', hint: '1 organization · 1 driver', icon: ClipboardCheck, raised: true },
            { label: 'Registered users', value: '31', hint: 'People who can sign in', icon: Users },
            { label: 'Verified drivers', value: '9', hint: 'Can get ride requests', icon: CircleCheck },
            { label: 'Active ride requests', value: '4', hint: 'Not yet finished', icon: Route },
            { label: 'Completed rides', value: '58', hint: 'Transportation, all time', icon: Check },
          ]}
        />
      </Panel>

      <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel className="overflow-visible">
          <Marker n={2} onPicture />
          <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
            <p className="font-grotesk text-[14px] font-semibold text-midnight">Requires attention</p>
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-sun-400 px-1 font-dm text-[10px] font-bold text-midnight">
              2
            </span>
            <span className="ml-auto font-dm text-[11px] font-semibold text-electric-ink">Approvals</span>
          </div>
          <ul className="divide-y divide-hairline">
            {DEMO_REVIEWS.map((r) => (
              <li key={r.name} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  {r.kind.startsWith('Driver') ? <UserRound className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1 font-dm">
                  <p className="text-[10px] text-hush">{r.kind}</p>
                  <p className="truncate text-[13px] font-semibold text-midnight">{r.name}</p>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-sun-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                    <Clock className="h-3 w-3" /> Pending review
                  </span>
                </div>
                <span className="inline-flex items-center gap-0.5 font-dm text-[12px] font-semibold text-electric-ink">
                  Review <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel className="overflow-visible">
          <Marker n={3} onPicture />
          <div className="border-b border-hairline px-4 py-3">
            <p className="font-grotesk text-[14px] font-semibold text-midnight">Recent platform activity</p>
            <p className="font-dm text-[11px] text-hush">Registrations and review decisions</p>
          </div>
          <ul className="px-4 py-2">
            {DEMO_PLATFORM_ACTIVITY.map((a) => (
              <li key={a.text} className="flex items-center gap-2.5 py-2 font-dm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-midnight">{a.text}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-hush">{a.when}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  )
}
