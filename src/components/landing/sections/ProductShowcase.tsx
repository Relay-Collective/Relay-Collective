import {
  CarFront,
  ChevronDown,
  CircleHelp,
  Clock,
  HandHeart,
  Inbox,
  Layers,
  LayoutDashboard,
  Plus,
  TriangleAlert,
  UserPlus,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { LogoMark } from '../../brand/LogoMark'
import { DEMO_ORG, DEMO_PEOPLE, DEMO_STAFF, DEMO_UPCOMING, type DemoRole } from '../demo'
import { Accent, Reveal } from '../primitives'
import { StatusPill } from '../ProductBits'
import { container, h2, lede } from '../styles'

// 04: the organization workspace, drawn for the landing page. A picture of the real screens, built from
// the same labels (nav, metrics, statuses), never the screens themselves, and never real data.
// The foundation (people, requests, attention) frames the page; each module is one entry under Modules.
const NAV: { label: string; icon: LucideIcon; active?: boolean; badge?: number; group?: string; planned?: boolean }[] = [
  { label: 'Overview', icon: LayoutDashboard, active: true },
  { label: 'Requests', icon: Inbox, badge: 1 },
  { label: 'Team', icon: UsersRound },
  { label: 'Volunteers', icon: HandHeart },
  { label: 'CareRide', icon: CarFront, group: 'Modules' },
  { label: 'Resource sharing', icon: Layers, planned: true },
]

const METRICS: { label: string; value: number; hint: string; icon: LucideIcon; tone: 'attention' | 'plain' | 'live' }[] = [
  { label: 'Need attention', value: 1, hint: 'Pickup in 40 min', icon: TriangleAlert, tone: 'attention' },
  { label: 'Open requests', value: 5, hint: 'Across your modules', icon: Inbox, tone: 'plain' },
  { label: 'Under way today', value: 3, hint: 'Confirmed or on the road', icon: Clock, tone: 'live' },
  { label: 'Your people', value: 24, hint: '6 staff, 18 volunteers', icon: UsersRound, tone: 'plain' },
]

// Role colours from the app: staff in electric, volunteers in cantaloupe
const ROLE_TONE: Record<DemoRole, string> = {
  Admin: 'bg-electric-wash text-electric-ink',
  Staff: 'bg-electric-wash text-electric-ink',
  'Volunteer driver': 'bg-cantaloupe-wash text-cantaloupe-ink',
}

// What each numbered marker on the picture points at
const NOTES = [
  { title: 'Nothing goes quiet', text: 'A request no one has picked up is raised right away, with the next step beside it.' },
  { title: 'Every request, one list', text: 'See what is waiting, confirmed, and under way across your organization, whatever module it came from.' },
  { title: 'Your people, one place', text: 'Staff, admins, and volunteers each join from one invitation, with only the access their role needs.' },
]

export function ProductShowcase() {
  return (
    <section id="showcase" aria-labelledby="showcase-heading" className="relative scroll-mt-16 overflow-hidden border-y border-hairline bg-white py-24 sm:py-28 lg:py-36">
      <div className={`${container} relative`}>
        <Reveal className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <h2 id="showcase-heading" className={`${h2} lg:col-span-8`}>
            One platform.
            <br />
            More <Accent>possibilities.</Accent>
          </h2>
          <p className={`${lede} lg:col-span-4`}>
            The workspace every organization shares. Your people, every open request, and what needs attention next, whichever module it came from.
          </p>
        </Reveal>

        <Reveal delay={100} className="relative mt-16 lg:mt-20">
          <figure>
            <div className="relative rounded-[28px] bg-porcelain p-3 sm:p-6 lg:p-10">
              {/* The electric field the workspace sits on */}
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 rounded-b-[28px] bg-electric" aria-hidden />
              <span className="pointer-events-none absolute -right-6 bottom-10 hidden h-28 w-28 rounded-full bg-cantaloupe lg:block" aria-hidden />
              <div className="relative">
                <DashboardMock />
              </div>
            </div>
            <figcaption className="mt-5 flex items-center gap-2 font-dm text-[13px] text-hush">
              <span className="h-px w-5 bg-hush/60" aria-hidden />
              Illustrative demo. The organization, people, and rides shown are not real.
            </figcaption>
          </figure>
        </Reveal>

        <ol className="mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
          {NOTES.map((n, i) => (
            <Reveal as="li" key={n.title} delay={i * 90} className="border-t border-midnight/15 pt-5">
              <h3 className="flex items-center gap-3 font-grotesk text-[20px] font-semibold tracking-[-0.02em] text-midnight">
                <Marker n={i + 1} />
                {n.title}
              </h3>
              <p className="mt-3 max-w-sm font-dm text-[16px] leading-relaxed text-midnight-soft">{n.text}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}

// A numbered dot that ties a spot on the picture to its note below
function Marker({ n, onPicture = false }: { n: number; onPicture?: boolean }) {
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

function Box({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`relative min-w-0 rounded-xl border border-hairline bg-white p-4 ${className}`}>{children}</div>
}

// The overview screen. Hidden from screen readers: the caption and the notes say what it shows.
function DashboardMock() {
  return (
    <div className="rcl-lift-lg select-none overflow-hidden rounded-2xl border border-hairline bg-white" aria-hidden>
      <div className="grid md:grid-cols-[232px_1fr]">
        <aside className="hidden flex-col border-r border-hairline bg-porcelain p-4 md:flex">
          <div className="flex items-center gap-2 px-2 py-1">
            <LogoMark className="h-6 w-6" />
            <span className="font-grotesk text-[15px] font-semibold tracking-[-0.02em] text-midnight">Relay Collective</span>
          </div>
          <div className="mt-5 flex items-center justify-between rounded-lg border border-hairline bg-white px-3 py-2 font-dm text-[12px] text-midnight">
            <span className="truncate">{DEMO_ORG}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-hush" />
          </div>
          <nav className="mt-5 space-y-0.5 font-dm text-[13px]">
            {NAV.map(({ label, icon: Icon, active, badge, group, planned }) => (
              <div key={label}>
                {group && <p className="mb-1 mt-4 px-3 text-[11px] font-medium text-hush">{group}</p>}
                <div
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${
                    active ? 'bg-midnight font-medium text-white' : planned ? 'text-hush' : 'text-midnight-soft'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">
                    {label}
                    {planned && <span className="block text-[11px]">Planned</span>}
                  </span>
                  {badge && <span className="rounded-full bg-cantaloupe px-1.5 text-[10px] font-semibold text-midnight">{badge}</span>}
                </div>
              </div>
            ))}
          </nav>
          <div className="mt-auto space-y-3 pt-10">
            <div className="flex items-center gap-2.5 px-3 font-dm text-[13px] text-midnight-soft">
              <CircleHelp className="h-4 w-4" /> Help and support
            </div>
            <div className="flex items-center gap-2.5 border-t border-hairline px-2 pt-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cantaloupe-wash font-dm text-[11px] font-semibold text-cantaloupe-ink">
                {DEMO_STAFF.initials}
              </span>
              <div className="font-dm text-[12px] leading-tight">
                <p className="text-midnight">
                  {DEMO_STAFF.first} {DEMO_STAFF.last}
                </p>
                <p className="text-hush">{DEMO_STAFF.role}</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-dm text-[12px] font-medium text-hush">Thursday, November 12</p>
              <p className="mt-1 font-grotesk text-[22px] font-semibold tracking-[-0.03em] text-midnight sm:text-[28px]">Good afternoon, {DEMO_STAFF.first}.</p>
              <p className="mt-1 font-dm text-[13px] text-midnight-soft">Here's what's happening at {DEMO_ORG}.</p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-midnight px-4 py-2 font-dm text-[12px] font-semibold text-white">
              <Plus className="h-3.5 w-3.5" /> New request
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {METRICS.map(({ label, value, hint, icon: Icon, tone }) => (
              <div
                key={label}
                className={`rounded-xl border p-4 ${
                  tone === 'live' ? 'border-electric/40 bg-electric-wash' : tone === 'attention' ? 'border-cantaloupe/50 bg-cantaloupe-wash' : 'border-hairline bg-white'
                }`}
              >
                <Icon className={`h-4 w-4 ${tone === 'attention' ? 'text-cantaloupe-ink' : tone === 'live' ? 'text-electric-ink' : 'text-hush'}`} />
                <p className="mt-3 font-dm text-[12px] text-midnight-soft">{label}</p>
                <p className="font-grotesk text-[30px] font-semibold leading-tight tracking-[-0.03em] text-midnight tabular-nums">{value}</p>
                <p className="font-dm text-[11px] text-hush">{hint}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-5">
            <Box className="lg:col-span-3">
              <Marker n={1} onPicture />
              <div className="flex items-center justify-between">
                <p className="font-grotesk text-[15px] font-semibold text-midnight">Needs action</p>
                <span className="font-dm text-[11px] text-hush">View all requests</span>
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-lg bg-cantaloupe-wash p-3">
                <TriangleAlert className="h-4 w-4 shrink-0 text-cantaloupe-ink" />
                <div className="min-w-0 flex-1 font-dm">
                  <p className="text-[13px] font-semibold text-midnight">No driver available</p>
                  <p className="truncate text-[11px] text-midnight-soft">5:10 PM pickup · Pharmacy</p>
                </div>
                <span className="rounded-full bg-midnight px-3 py-1 font-dm text-[11px] font-semibold text-white">Rebook now</span>
              </div>
              <div className="relative mt-5">
                <Marker n={2} onPicture />
                <p className="pl-5 font-grotesk text-[15px] font-semibold text-midnight">Open requests</p>
              </div>
              <ul className="mt-2 divide-y divide-hairline">
                {DEMO_UPCOMING.map((r) => (
                  <li key={r.who} className="flex items-center gap-3 py-2.5 font-dm">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-porcelain text-[10px] font-semibold text-midnight">{r.who}</span>
                    <span className="hidden w-16 shrink-0 text-[12px] tabular-nums text-midnight sm:inline">{r.time}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-midnight-soft">{r.to}</span>
                    <StatusPill status={r.status} size="text-[11px]" />
                  </li>
                ))}
              </ul>
            </Box>

            <Box className="lg:col-span-2">
              <Marker n={3} onPicture />
              <div className="flex items-center justify-between">
                <p className="font-grotesk text-[15px] font-semibold text-midnight">Your people</p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-midnight px-3 py-1 font-dm text-[11px] font-semibold text-white">
                  <UserPlus className="h-3 w-3" /> Invite
                </span>
              </div>
              <ul className="mt-3 divide-y divide-hairline">
                {DEMO_PEOPLE.map((p) => (
                  <li key={p.name} className="flex items-center gap-3 py-2.5 font-dm">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                        p.role ? ROLE_TONE[p.role] : 'border border-dashed border-midnight/30 text-hush'
                      }`}
                    >
                      {p.initials}
                    </span>
                    <span className={`min-w-0 flex-1 truncate text-[12px] ${p.role ? 'text-midnight' : 'text-hush'}`}>{p.name}</span>
                    {p.role ? (
                      <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${ROLE_TONE[p.role]}`}>{p.role}</span>
                    ) : (
                      <span className="whitespace-nowrap text-[11px] text-hush">Invite sent</span>
                    )}
                  </li>
                ))}
              </ul>
            </Box>
          </div>
        </div>
      </div>
    </div>
  )
}
