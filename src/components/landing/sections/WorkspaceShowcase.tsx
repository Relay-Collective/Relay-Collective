import { ArrowRight, Building2, HandHeart, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
import { ConsoleMock, Marker, type ShowcaseRole } from '../ConsoleMock'
import { LINKS } from '../content'
import { Accent, Reveal, SmartLink } from '../primitives'
import { container, h2, lede, textLink } from '../styles'

// 03: inside the workspaces. One platform, a workspace for each role that uses it: partner staff, volunteers
// and the people who run the platform. The volunteer tab is a general volunteer's, not a driver's: CareRide driving
// is one service a volunteer can join, and the CareRide section below shows it. Each tab is a picture of that role's real overview (ConsoleMock) with three
// numbered notes that say what the picture shows, so the picture itself can stay hidden from screen readers.

interface Role {
  id: ShowcaseRole
  tab: string
  short: string
  workspace: string
  icon: LucideIcon
  who: string
  notes: { title: string; text: string }[]
  cta?: { label: string; href: string }
}

const ROLES: Role[] = [
  {
    id: 'organization',
    tab: 'Organizations',
    short: 'Staff',
    workspace: 'organization workspace',
    icon: Building2,
    who: 'For partner staff, booking support for the people they serve.',
    notes: [
      {
        title: 'Nothing goes quiet',
        text: 'A ride no driver has taken yet is raised at the top, with how long is left and the next step beside it.',
      },
      {
        title: 'Every module, one overview',
        text: 'CareRide sits on the overview with its own numbers: what needs you, what is waiting, what a driver has, what is done.',
      },
      { title: 'Your team, your roles', text: 'Invite staff from the Team page. Each person gets only the access their role needs.' },
    ],
    cta: { label: 'Register your organization', href: LINKS.registerOrg },
  },
  {
    id: 'volunteer',
    tab: 'Volunteers',
    short: 'Volunteers',
    workspace: 'volunteer workspace',
    icon: HandHeart,
    who: 'For volunteers, choosing how they help and which services to join.',
    notes: [
      {
        title: 'Start with what matters to you',
        text: 'Choose the ways you’d like to help, from transportation to community outreach. Saving an interest doesn’t sign you up for anything.',
      },
      {
        title: 'Your volunteering, in one place',
        text: 'Your profile and interests live in your own workspace. Add or change them whenever you like.',
      },
      {
        title: 'Join a service when you’re ready',
        text: 'CareRide is the first service open to volunteers. Apply to drive from the same account, and the team verifies you before any ride is sent.',
      },
    ],
    cta: { label: 'Become a volunteer', href: LINKS.registerVolunteer },
  },
  {
    id: 'admin',
    tab: 'Platform admins',
    short: 'Admins',
    workspace: 'platform admin console',
    icon: ShieldCheck,
    who: 'For the people who keep the network safe and running.',
    notes: [
      { title: 'The whole network at a glance', text: 'Organizations, people, verified drivers and rides across every module, on one page.' },
      { title: 'Everyone is reviewed first', text: 'Every organization and every driver is approved by a person before their first ride.' },
      { title: 'A clear record', text: 'Registrations and review decisions are kept in order, so anyone can see what changed and when.' },
    ],
  },
]

export function WorkspaceShowcase() {
  const [active, setActive] = useState<ShowcaseRole>('organization')
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const role = ROLES.find((r) => r.id === active)!

  // Arrow keys move between tabs and select them; Home and End jump to either end (the ARIA tabs pattern)
  const onKey = (e: KeyboardEvent, i: number) => {
    const last = ROLES.length - 1
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[e.key]
    if (next === undefined) return
    e.preventDefault()
    setActive(ROLES[next].id)
    tabs.current[next]?.focus()
  }

  return (
    <section
      id="showcase"
      aria-labelledby="showcase-heading"
      className="relative scroll-mt-16 overflow-hidden border-y border-hairline bg-white py-24 sm:py-28 lg:py-36"
    >
      <div className={`${container} relative`}>
        <Reveal className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <h2 id="showcase-heading" className={`${h2} lg:col-span-8`}>
            One platform.
            <br />
            Built for <Accent>every role.</Accent>
          </h2>
          <p className={`${lede} lg:col-span-4`}>
            Partner staff, volunteers and the people who run the platform each get a workspace built for how they take part, on the same accounts.
          </p>
        </Reveal>

        <Reveal delay={80} className="mt-12 flex flex-col gap-4 sm:mt-14 md:flex-row md:items-center md:justify-between">
          {/* The same segmented bar as CareRide's tabs in the app: a quiet track, the current tab a raised white pill */}
          <div role="tablist" aria-label="Workspaces" className="grid grid-cols-3 gap-1 rounded-full bg-midnight/[0.06] p-1 sm:inline-flex">
            {ROLES.map((r, i) => {
              const on = r.id === active
              const Icon = r.icon
              return (
                <button
                  key={r.id}
                  ref={(el) => {
                    tabs.current[i] = el
                  }}
                  type="button"
                  role="tab"
                  id={`showcase-tab-${r.id}`}
                  aria-selected={on}
                  aria-controls={`showcase-panel-${r.id}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setActive(r.id)}
                  onKeyDown={(e) => onKey(e, i)}
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-3 font-dm text-[14px] font-semibold transition-[background-color,color,box-shadow] duration-300 ease-out focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-electric-ink sm:px-5 sm:text-[15px] ${
                    on
                      ? 'bg-white text-midnight shadow-[0_1px_2px_rgb(17_24_32/0.06),0_6px_16px_-8px_rgb(17_24_32/0.25)]'
                      : 'text-midnight-soft hover:text-midnight'
                  }`}
                >
                  <Icon className={`hidden h-4 w-4 sm:block ${on ? 'text-electric-ink' : ''}`} aria-hidden />
                  <span className="sm:hidden" aria-hidden>
                    {r.short}
                  </span>
                  <span className="max-sm:sr-only">{r.tab}</span>
                </button>
              )
            })}
          </div>
          <p className="font-dm text-[16px] text-midnight-soft" aria-live="polite">
            {role.who}
          </p>
        </Reveal>

        <Reveal delay={120}>
          {/* Only the chosen workspace is drawn, so switching replays its arrival (and CareRide's route) */}
          <div
            key={role.id}
            role="tabpanel"
            id={`showcase-panel-${role.id}`}
            aria-labelledby={`showcase-tab-${role.id}`}
            tabIndex={0}
            className="rcl-swap mt-8 rounded-[28px] focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-electric-ink"
          >
            <figure>
              <div className="relative rounded-[28px] bg-porcelain p-3 sm:p-6 lg:p-10">
                {/* The electric field the workspace sits on, and the logo's centre */}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 rounded-b-[28px] bg-electric" aria-hidden />
                <span className="pointer-events-none absolute -right-6 bottom-10 hidden h-28 w-28 rounded-full bg-cantaloupe lg:block" aria-hidden />
                <div className="relative">
                  <ConsoleMock role={role.id} />
                </div>
              </div>
              <figcaption className="mt-5 flex items-center gap-2 font-dm text-[13px] text-hush">
                <span className="h-px w-5 bg-hush/60" aria-hidden />
                Illustrative demo of the {role.workspace}. The organizations, people, and activity shown are not real.
              </figcaption>
            </figure>

            <ol className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
              {role.notes.map((n, i) => (
                <li key={n.title} className="border-t border-midnight/15 pt-5">
                  <h3 className="flex items-center gap-3 font-grotesk text-[20px] font-semibold tracking-[-0.02em] text-midnight">
                    <Marker n={i + 1} />
                    {n.title}
                  </h3>
                  <p className="mt-3 max-w-sm font-dm text-[16px] leading-relaxed text-midnight-soft">{n.text}</p>
                </li>
              ))}
            </ol>

            {role.cta && (
              <div className="mt-10">
                <SmartLink href={role.cta.href} className={textLink}>
                  {role.cta.label} <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
                </SmartLink>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
