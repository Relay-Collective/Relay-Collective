import { ArrowDown, Building2, CarFront, CircleCheck, HandHeart, Inbox, Layers, LayoutDashboard, UsersRound, type LucideIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type RefObject } from 'react'
import { LogoMark } from '../brand/LogoMark'
import { DEMO_ACTIVITY, DEMO_ORG, DEMO_STAFF, type DemoArea } from './demo'
import { usePrefersReducedMotion } from './hooks'

const at = (ms: number) => ({ '--enter-delay': `${ms}ms` } as CSSProperties)

// When each part lands, in ms after load: the track draws, the workspace settles inside it, the stations take their places.
// Everything is in place by about 1.8s; the relay point then runs one lap (LAP, below) and nothing moves after it.
const T = {
  board: 220,
  orgs: 640,
  volunteers: 780,
  transport: 920,
  impact: 1060,
  services: 1200,
}

type PartKey = 'organizations' | 'volunteers' | 'transport' | 'services' | 'impact'
type Tone = 'electric' | 'cantaloupe' | 'emerald'

// 'arrived' is Community impact once the relay point reaches it: the check fills in
const TONE: Record<Tone | 'arrived', string> = {
  electric: 'bg-electric-wash text-electric-ink',
  cantaloupe: 'bg-cantaloupe-wash text-cantaloupe-ink',
  emerald: 'bg-emerald-50 text-emerald-700',
  arrived: 'bg-emerald-600 text-white',
}

// What the platform brings together, each linking to where the page explains it.
// Status follows CAPABILITIES in content.ts: volunteers are drivers today, resource sharing is planned.
const PARTS: Record<PartKey, { title: string; text: string; icon: LucideIcon; tone: Tone; href: string; status?: 'drivers' | 'planned' }> = {
  organizations: { title: 'Organizations', text: 'One shared workspace for every team.', icon: Building2, tone: 'electric', href: '#cap-orgs' },
  volunteers: {
    title: 'Volunteers',
    text: 'People ready to support community needs.',
    icon: HandHeart,
    tone: 'cantaloupe',
    href: '#cap-volunteers',
    status: 'drivers',
  },
  transport: { title: 'CareRide', text: 'The first module. Rides to appointments.', icon: CarFront, tone: 'electric', href: '#cap-transport' },
  services: {
    title: 'Resource sharing',
    text: 'The next module.',
    icon: Layers,
    tone: 'cantaloupe',
    href: '#cap-grow',
    status: 'planned',
  },
  impact: { title: 'Community impact', text: 'People connected. Services delivered.', icon: CircleCheck, tone: 'emerald', href: '#impact' },
}

// The hero picture: the Relay Loop. One workspace at the centre, the parts of the platform as stations on a track around it.
// The workspace is illustrative and hidden from screen readers; the cards are links to the sections that explain each part.
export function HeroProductEcosystem() {
  const [active, setActive] = useState<PartKey | null>(null)
  return (
    <figure className="relative">
      <figcaption className="sr-only">
        An illustrative Relay Collective workspace, connected to organizations, volunteers, transportation, resource sharing (planned), and
        community impact.
      </figcaption>
      <Loop active={active} onActive={setActive} />
      <p
        className="rcl-enter mt-6 flex items-center gap-2 font-dm text-[13px] text-hush md:justify-center xl:mt-4 xl:justify-start"
        style={at(T.impact + 200)}
        aria-hidden
      >
        <span className="h-px w-5 bg-hush/60" />
        Illustrative example. The organization, people and numbers are not real.
      </p>
    </figure>
  )
}

interface Linked {
  active: PartKey | null
  onActive: (part: PartKey | null) => void
}

/* ---------- The Relay Loop ---------- */

// The logo, scaled up until it holds the product: its two hooks become one track, and each part of the platform is a
// station on it. Volunteers sit in the open top-right handoff; the planned module sits on the open bottom-left corner,
// drawn as sleepers with no rails yet.
//
// The cards and the workspace are laid out in a grid, so nothing can overlap; the track is then measured from that grid
// and drawn behind it, through the middle of the top row and of Community impact. One layout for every screen:
// - phones: Organizations and Volunteers on the top track, the workspace, Transportation and Community services inside
//   the loop, Community impact on the bottom track
// - tablet and desktop: the same, with Community services, Community impact and Transportation sharing the bottom track
// Sizes are in em. From md, 1em is a fortieth of the picture's width, so the whole piece scales as one.
function Loop({ active, onActive }: Linked) {
  const root = useRef<HTMLDivElement>(null)
  const organizations = useRef<HTMLDivElement>(null)
  const volunteers = useRef<HTMLDivElement>(null)
  const transport = useRef<HTMLDivElement>(null)
  const impact = useRef<HTMLDivElement>(null)
  const services = useRef<HTMLDivElement>(null)
  const stations: Stations = { organizations, volunteers, transport, impact, services }
  const relay = useRef<SVGPathElement>(null)
  const dot = useRef<SVGGElement>(null)
  const geo = useLoopGeometry(root, stations)
  const arrived = useRelay(root, stations, relay, dot, geo !== null)
  const parallax = useParallax()
  const linked = { active, onActive }

  return (
    <div className="[container-type:inline-size]">
      <div
        ref={root}
        className="relative select-none text-[16px] [--gap:0.75em] [--tw:14px] md:text-[2.5cqw] md:[--gap:2.6em] md:[--tw:2.2em]"
        {...parallax}
      >
        {geo && (
          <div className="rcl-depth absolute inset-0" style={depth(-0.5)}>
            <Track geo={geo} relay={relay} dot={dot} />
          </div>
        )}

        {/* On the top track. Keyboard order follows the lap: organizations, volunteers, transportation, impact, then planned. */}
        <div className="relative mx-[0.4em] grid grid-cols-2 gap-[0.6em] md:mx-0 md:flex md:items-center md:justify-between">
          <Station ref={organizations} className="md:ml-[6.5em] md:w-[14.5em]">
            <PartCard part="organizations" stack="mobile" delay={T.orgs} {...linked} />
          </Station>
          <Station ref={volunteers} className="md:w-[14.5em]">
            <PartCard part="volunteers" stack="mobile" delay={T.volunteers} {...linked} />
          </Station>
        </div>

        {/* Inside the loop, clear of its sides */}
        <div className="rcl-depth relative mx-[calc(var(--tw)+var(--gap))] my-[0.9em] md:my-[1.6em]" style={depth(0.35)}>
          <div className="rcl-card" style={at(T.board)} aria-hidden>
            <div className="md:hidden">
              <Workspace compact active={active} />
            </div>
            <div className="hidden md:block">
              <Workspace active={active} />
            </div>
          </div>
        </div>

        {/* Phones: two stations inside the loop, impact on the bottom track. From md: all three on the bottom track. */}
        <div className="relative mx-[calc(var(--tw)+var(--gap))] grid grid-cols-2 gap-[0.6em] md:ml-0 md:mr-[2em] md:grid-cols-[11.6fr_13fr_11.6fr] md:gap-[0.9em]">
          <Station ref={transport} className="order-1 md:order-3">
            <PartCard part="transport" stack="always" delay={T.transport} {...linked} />
          </Station>
          <Station ref={impact} className="order-3 col-span-2 mt-[0.3em] md:order-2 md:col-span-1 md:mt-0">
            <PartCard part="impact" stack="mobile-row" outcome arrived={arrived} delay={T.impact} {...linked} />
          </Station>
          <Station ref={services} className="order-2 md:order-1">
            <PartCard part="services" stack="always" delay={T.services} {...linked} />
          </Station>
        </div>
      </div>
    </div>
  )
}

// How far a layer drifts with the pointer, in em: the track sits behind, the stations float in front
const depth = (d: number) => ({ '--depth': d }) as CSSProperties

function Station({ className = '', children, ref }: { className?: string; children: ReactNode; ref: RefObject<HTMLDivElement | null> }) {
  return (
    <div ref={ref} className={`rcl-depth relative ${className}`} style={depth(1)}>
      {children}
    </div>
  )
}

type Stations = Record<PartKey, RefObject<HTMLDivElement | null>>

interface Geo {
  w: number
  h: number
  tw: number
  electric: string
  midnight: string
  planned: string
  relay: string
}

// A layout box relative to the loop. Cards settle in with a transform, so read layout boxes (offset*), never the animated ones.
function box(el: HTMLElement | null | undefined, root: HTMLElement) {
  if (!el) return null
  let left = 0
  let top = 0
  for (let at: HTMLElement | null = el; at && at !== root; at = at.offsetParent as HTMLElement | null) {
    left += at.offsetLeft
    top += at.offsetTop
  }
  return { left, top, width: el.offsetWidth, height: el.offsetHeight }
}

// The logo's two hooks, stretched to the loop. On the logo's 30-unit square each hook runs 22 units up its side and
// 19 across, with a 10-unit corner; here those become shares of the loop's width and height, and the corner a third
// of its shorter side.
function loopPaths(w: number, h: number, tw: number, top: number, bottom: number, impactX: number): Geo {
  const n = (v: number) => Math.round(v * 10) / 10
  const L = tw / 2
  const R = w - tw / 2
  const W = R - L
  const H = bottom - top
  const r = n(0.33 * Math.min(W, H))
  const arc = (x: number, y: number) => `A${r} ${r} 0 0 1 ${n(x)} ${n(y)}`
  const eStart = n(top + 0.73 * H)
  const eEnd = n(L + 0.633 * W)
  const mStart = n(top + 0.267 * H)
  const mEnd = n(L + 0.367 * W)
  return {
    w,
    h,
    tw,
    electric: `M${n(L)} ${eStart}V${n(top + r)}${arc(L + r, top)}H${eEnd}`,
    midnight: `M${n(R)} ${mStart}V${n(bottom - r)}${arc(R - r, bottom)}H${mEnd}`,
    planned: `M${mEnd} ${n(bottom)}H${n(L + r)}${arc(L, bottom - r)}V${eStart}`,
    // Up the electric hook, across the open handoff, down the midnight hook, into impact
    relay: `M${n(L)} ${eStart}V${n(top + r)}${arc(L + r, top)}H${n(R - r)}${arc(R, top + r)}V${n(bottom - r)}${arc(R - r, bottom)}H${n(impactX)}`,
  }
}

// Measures the grid and fits the track to it, again whenever the picture resizes or the fonts arrive
function useLoopGeometry(root: RefObject<HTMLDivElement | null>, stations: Stations) {
  const [geo, setGeo] = useState<Geo | null>(null)
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const measure = () => {
      const top = box(stations.organizations.current, el)
      const impact = box(stations.impact.current, el)
      if (!top || !impact || el.offsetWidth === 0) return
      const md = window.matchMedia('(min-width: 768px)').matches
      const tw = md ? parseFloat(getComputedStyle(el).fontSize) * 2.2 : 14
      setGeo(loopPaths(el.offsetWidth, el.offsetHeight, tw, top.top + top.height / 2, impact.top + impact.height / 2, impact.left + impact.width / 2))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    document.fonts?.ready.then(measure)
    return () => observer.disconnect()
  }, [root, stations.organizations, stations.impact])
  return geo
}

// The track: an electric hook and a midnight hook, each with a white road lane down its middle, sleepers where the
// planned module will be laid, and the relay point (moved by useRelay).
function Track({ geo, relay, dot }: { geo: Geo; relay: RefObject<SVGPathElement | null>; dot: RefObject<SVGGElement | null> }) {
  const { w, h, tw } = geo
  const lane = { stroke: '#fff', strokeOpacity: 0.75, strokeWidth: Math.max(1.25, tw * 0.075), strokeDasharray: `${tw * 0.32} ${tw * 0.42}`, strokeLinecap: 'round' as const }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="absolute inset-0 overflow-visible" fill="none" aria-hidden>
      <path className="rcl-fade" style={at(T.services)} d={geo.planned} stroke="#111820" strokeOpacity="0.26" strokeWidth={tw} strokeDasharray={`${tw * 0.12} ${tw * 0.36}`} />
      <path className="rcl-route" pathLength={1} style={at(60)} d={geo.electric} stroke="#0297DE" strokeWidth={tw} strokeLinecap="round" />
      <path className="rcl-route" pathLength={1} style={at(360)} d={geo.midnight} stroke="#111820" strokeWidth={tw} strokeLinecap="round" />
      <g className="rcl-fade" style={at(T.board + 600)}>
        <path d={geo.electric} {...lane} />
        <path d={geo.midnight} {...lane} />
      </g>
      <path ref={relay} d={geo.relay} stroke="none" />
      {/* The person at the logo's centre, relayed from hand to hand */}
      <g ref={dot} opacity="0">
        <circle r={tw * 0.42} fill="#FC734D" stroke="#fff" strokeWidth={tw * 0.17} />
      </g>
    </svg>
  )
}

// One lap, once, when the picture is in view and has settled: the relay point runs the track, each station lifts and
// lights as the point passes it, and the lap ends in Community impact. Returns true once it has arrived (at once with
// reduced motion, which skips the lap).
const LAP = { after: 1900, ms: 3200 }

function useRelay(
  root: RefObject<HTMLDivElement | null>,
  stations: Stations,
  relay: RefObject<SVGPathElement | null>,
  dot: RefObject<SVGGElement | null>,
  ready: boolean,
) {
  const reduced = usePrefersReducedMotion()
  const [done, setDone] = useState(false)
  const ran = useRef(false)

  useEffect(() => {
    const el = root.current
    if (reduced || !ready || ran.current || !el) return
    const mounted = performance.now()
    let timer = 0
    let frame = 0

    const run = () => {
      const path = relay.current
      const point = dot.current
      if (!path || !point) return
      ran.current = true
      const length = path.getTotalLength()
      const reach = Number(path.ownerSVGElement?.querySelector('circle')?.getAttribute('r') ?? 8) * 3
      const waiting = [stations.organizations, stations.volunteers, stations.transport, stations.impact, stations.services].map(({ current: s }) => ({
        s,
        b: box(s, el),
      }))
      const start = performance.now()
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / LAP.ms)
        const eased = 0.5 - Math.cos(Math.PI * t) / 2
        const p = path.getPointAtLength(eased * length)
        point.setAttribute('transform', `translate(${p.x} ${p.y})`)
        point.setAttribute('opacity', String(t < 0.04 ? t / 0.04 : t > 0.93 ? (1 - t) / 0.07 : 1))
        for (const w of waiting) {
          const { b, s } = w
          if (!b || !s || s.dataset.passed) continue
          if (p.x > b.left - reach && p.x < b.left + b.width + reach && p.y > b.top - reach && p.y < b.top + b.height + reach) {
            s.dataset.passed = 'true'
            s.querySelector('[data-surface]')?.classList.add('rcl-pass')
          }
        }
        if (t < 1) frame = requestAnimationFrame(step)
        else setDone(true)
      }
      frame = requestAnimationFrame(step)
    }

    // Wait until most of the picture is on screen (phones scroll to it), and never start before the stations have landed
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        timer = window.setTimeout(run, Math.max(0, LAP.after - (performance.now() - mounted)))
      },
      { threshold: 0.5 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [reduced, ready, root, relay, dot, stations.organizations, stations.volunteers, stations.transport, stations.impact, stations.services])

  return reduced || done
}

// Each layer drifts a little with the pointer, by its depth, so the stations float over the workspace and the track.
// Flat translation only, so text stays crisp. Mouse only, never with reduced motion. The offsets are custom properties
// on the pointer's target, which .rcl-depth inherits.
function useParallax() {
  const reduced = usePrefersReducedMotion()
  const set = (el: HTMLElement, x: number, y: number) => {
    el.style.setProperty('--px', x.toFixed(3))
    el.style.setProperty('--py', y.toFixed(3))
  }
  return {
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (reduced || e.pointerType !== 'mouse') return
      const r = e.currentTarget.getBoundingClientRect()
      set(e.currentTarget, (e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5)
    },
    onPointerLeave: (e: PointerEvent<HTMLDivElement>) => set(e.currentTarget, 0, 0),
  }
}

/* ---------- Parts ---------- */

function Icon({ icon: I, tone, size }: { icon: LucideIcon; tone: Tone | 'arrived'; size: string }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-[28%] transition-colors duration-500 ${TONE[tone]}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <I className="h-[48%] w-[48%]" strokeWidth={2} />
    </span>
  )
}

// Live work and planned work never look the same: a half dot for a first step, a dashed ring for planned. Words too.
function Status({ status }: { status: 'drivers' | 'planned' }) {
  const planned = status === 'planned'
  return (
    <span
      className={`inline-flex items-center gap-[0.4em] whitespace-nowrap rounded-full border px-[0.6em] py-[0.15em] font-dm text-[0.6875em] font-semibold text-midnight-soft ${
        planned ? 'border-dashed border-midnight/30' : 'border-hairline bg-porcelain'
      }`}
    >
      <span
        className={`h-[0.6em] w-[0.6em] rounded-full ${
          planned
            ? 'border border-dashed border-hush'
            : 'bg-[linear-gradient(90deg,var(--color-cantaloupe)_50%,transparent_50%)] ring-1 ring-cantaloupe'
        }`}
        aria-hidden
      />
      {planned ? 'Planned' : 'Drivers today'}
    </span>
  )
}

// One clear name per link, so the title, status and text are not read as one run-on word
const label = (part: PartKey) => {
  const { title, text, status } = PARTS[part]
  return `${title}${status ? ` (${status === 'planned' ? 'planned' : 'drivers today'})` : ''}. ${text}`
}

const card = 'group block h-full rounded-[0.9em] focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-electric-ink'
const surface =
  'rcl-card-lift relative h-full rounded-[0.9em] border bg-white transition-[translate,border-color,box-shadow] duration-300 ease-out group-hover:-translate-y-[0.15em] group-hover:border-electric/40 group-focus-visible:border-electric/40 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0'

// stack: where the icon sits above the words: 'always', only on phones ('mobile'), or only from md ('mobile-row').
// When stacked, the icon shares its row with the status (or the way-in arrow), so every stacked card has the same rhythm.
// outcome: Community impact, a little larger; arrived fills its check in once the relay point gets there.
type Stack = 'always' | 'mobile' | 'mobile-row'

const STACK: Record<Stack, { card: string; head: string; inline: string; stacked: string }> = {
  always: { card: 'flex-col', head: 'flex', inline: 'hidden', stacked: 'flex' },
  mobile: { card: 'flex-col md:flex-row md:items-start', head: 'flex md:contents', inline: 'hidden md:inline-flex', stacked: 'flex md:hidden' },
  'mobile-row': { card: 'items-center md:flex-col md:items-stretch', head: 'contents md:flex', inline: 'inline-flex md:hidden', stacked: 'hidden md:flex' },
}

function PartCard({
  part,
  stack,
  outcome = false,
  arrived = false,
  delay,
  active,
  onActive,
}: {
  part: PartKey
  stack: Stack
  outcome?: boolean
  arrived?: boolean
  delay: number
} & Linked) {
  const { title, text, icon, tone, href, status } = PARTS[part]
  const v = STACK[stack]
  // The way in: shown on phones, revealed on hover or focus where a pointer can find the card
  const arrow = (
    <ArrowDown
      className="h-[0.9em] w-[0.9em] shrink-0 text-electric-ink opacity-60 transition-[opacity,translate] duration-300 group-hover:translate-y-[0.1em] group-hover:opacity-100 group-focus-visible:opacity-100 md:opacity-0"
      strokeWidth={2.25}
      aria-hidden
    />
  )
  return (
    <a
      href={href}
      aria-label={label(part)}
      className={`rcl-card ${card}`}
      style={at(delay)}
      onMouseEnter={() => onActive(part)}
      onMouseLeave={() => onActive(null)}
      onFocus={() => onActive(part)}
      onBlur={() => onActive(null)}
    >
      <span data-surface className={`${surface} flex ${v.card} gap-[0.7em] p-[0.85em] ${active === part ? 'border-electric/40' : 'border-hairline'}`}>
        <span className={`${v.head} items-start justify-between gap-[0.5em]`}>
          <Icon icon={icon} tone={arrived ? 'arrived' : tone} size={outcome ? '2.4em' : '2.1em'} />
          <span className={`${v.stacked} items-center`}>{status ? <Status status={status} /> : arrow}</span>
        </span>
        <span className="block min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-[0.5em] gap-y-[0.3em]">
            <span className={`font-grotesk font-semibold leading-tight tracking-[-0.02em] text-midnight ${outcome ? 'text-[1.05em]' : 'text-[0.95em]'}`}>
              {title}
            </span>
            {status && (
              <span className={v.inline}>
                <Status status={status} />
              </span>
            )}
          </span>
          <span className="mt-[0.3em] block font-dm text-[0.8125em] leading-[1.4] text-midnight-soft">{text}</span>
        </span>
        {!status && <span className={`${v.inline} absolute right-[0.85em] top-[0.9em]`}>{arrow}</span>}
      </span>
    </a>
  )
}

/* ---------- The workspace ---------- */

const NAV: { label: string; icon: LucideIcon; part?: PartKey; current?: boolean; badge?: number }[] = [
  { label: 'Overview', icon: LayoutDashboard, current: true },
  { label: 'Requests', icon: Inbox, badge: 2 },
  { label: 'Transportation', icon: CarFront, part: 'transport' },
  { label: 'Volunteers', icon: HandHeart, part: 'volunteers' },
  { label: 'Team', icon: UsersRound, part: 'organizations' },
]

const METRICS: { label: string; value: number; icon: LucideIcon; tone: Tone; part: PartKey }[] = [
  { label: 'Team members', value: 24, icon: UsersRound, tone: 'electric', part: 'organizations' },
  { label: 'Active volunteers', value: 18, icon: HandHeart, tone: 'cantaloupe', part: 'volunteers' },
  { label: 'Completed this week', value: 12, icon: CircleCheck, tone: 'emerald', part: 'impact' },
]

const AREA: Record<DemoArea, { icon: LucideIcon; tone: Tone; part: PartKey }> = {
  organizations: { icon: Building2, tone: 'electric', part: 'organizations' },
  volunteers: { icon: HandHeart, tone: 'cantaloupe', part: 'volunteers' },
  transport: { icon: CarFront, tone: 'electric', part: 'transport' },
  impact: { icon: CircleCheck, tone: 'emerald', part: 'impact' },
}

// What a hovered or focused card lights up inside the workspace
const lit = (on: boolean) => (on ? 'bg-electric-wash ring-1 ring-electric/35' : 'ring-0 ring-transparent')

// The organization's overview, simplified: one place where every working part of the platform shows up
function Workspace({ active, compact = false }: { active: PartKey | null; compact?: boolean }) {
  const activity = compact ? DEMO_ACTIVITY.slice(0, 2) : DEMO_ACTIVITY
  const main = (
    <div className={`min-w-0 ${compact ? 'px-4 pb-4 pt-4' : 'px-[1.5em] pb-[1.4em] pt-[1.4em]'}`}>
      {!compact && <p className="mb-[0.35em] truncate font-dm text-[0.68em] font-medium text-hush">{DEMO_ORG}</p>}
      <p className={`font-grotesk font-semibold leading-tight tracking-[-0.03em] text-midnight ${compact ? 'text-[19px]' : 'text-[1.35em]'}`}>
        Good afternoon, {DEMO_STAFF.first}.
      </p>
      <span className={`mt-[0.2em] block truncate font-dm text-hush ${compact ? 'text-[13px]' : 'text-[0.75em]'}`}>
        Here's what's happening across your organization.
      </span>

      <div className={`grid grid-cols-3 ${compact ? 'mt-4 gap-2' : 'mt-[1.1em] gap-[0.6em]'}`}>
        {METRICS.map((m) => (
          <div
            key={m.label}
            className={`rounded-[0.75em] border border-hairline transition-[background-color,box-shadow] duration-300 ${
              compact ? 'p-2.5' : 'p-[0.8em]'
            } ${lit(active === m.part)}`}
          >
            <div className="flex items-start justify-between gap-1">
              <p
                className={`font-grotesk font-semibold leading-none tracking-[-0.03em] text-midnight tabular-nums ${
                  compact ? 'text-[24px]' : 'text-[1.7em]'
                }`}
              >
                {m.value}
              </p>
              <Icon icon={m.icon} tone={m.tone} size={compact ? '22px' : '1.6em'} />
            </div>
            <p className={`mt-[0.5em] font-dm leading-tight text-midnight-soft ${compact ? 'text-[12px]' : 'text-[0.75em]'}`}>{m.label}</p>
          </div>
        ))}
      </div>

      <p className={`font-grotesk font-semibold text-midnight ${compact ? 'mt-4 text-[14px]' : 'mt-[1.2em] text-[0.85em]'}`}>Recent activity</p>
      <ul className="mt-[0.3em]">
        {activity.map((a) => {
          const { icon, tone, part } = AREA[a.area]
          return (
            <li
              key={a.text}
              className={`mx-[-0.5em] flex items-center gap-[0.65em] rounded-[0.6em] px-[0.5em] py-[0.5em] font-dm transition-[background-color,box-shadow] duration-300 [&+&]:mt-[0.1em] ${lit(
                active === part,
              )}`}
            >
              <Icon icon={icon} tone={tone} size={compact ? '26px' : '1.65em'} />
              <span className={`min-w-0 flex-1 truncate text-midnight ${compact ? 'text-[13px]' : 'text-[0.75em]'}`}>{a.text}</span>
              <span className={`shrink-0 tabular-nums text-hush ${compact ? 'text-[12px]' : 'text-[0.72em]'}`}>{a.when}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )

  if (compact) {
    return (
      <div className="rcl-lift-lg overflow-hidden rounded-2xl border border-hairline bg-white">
        <div className="flex items-center gap-2 border-b border-hairline bg-porcelain px-4 py-2.5">
          <LogoMark className="h-5 w-5" />
          <span className="truncate font-dm text-[13px] font-medium text-midnight-soft">{DEMO_ORG}</span>
        </div>
        {main}
      </div>
    )
  }

  // On the stage: a slim icon rail, so the overview gets the room
  return (
    <div className="rcl-lift-lg overflow-hidden rounded-[1.1em] border border-hairline bg-white">
      <div className="grid grid-cols-[3.6em_1fr]">
        <aside className="flex flex-col items-center gap-[0.35em] border-r border-hairline bg-porcelain pb-[1.4em] pt-[1.2em]">
          <LogoMark className="mb-[0.9em] h-[1.5em] w-[1.5em]" />
          {NAV.map(({ label, icon: I, current, badge, part }) => (
            <span
              key={label}
              className={`relative flex h-[2.2em] w-[2.2em] items-center justify-center rounded-[0.6em] transition-[background-color,box-shadow,color] duration-300 ${
                current ? 'bg-midnight text-white' : `text-midnight-soft ${lit(!!part && active === part)}`
              }`}
            >
              <I className="h-[1em] w-[1em]" />
              {badge && <span className="absolute right-[0.3em] top-[0.3em] h-[0.45em] w-[0.45em] rounded-full bg-cantaloupe ring-[0.12em] ring-porcelain" />}
            </span>
          ))}
        </aside>
        {main}
      </div>
    </div>
  )
}
