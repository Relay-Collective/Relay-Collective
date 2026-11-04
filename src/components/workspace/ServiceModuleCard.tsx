import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ActiveModule, ModuleStatus, PlannedModule, ServiceModule } from '../../workspace/modules'
import { inverseButton, primaryButton } from '../ui'
import { compactButton } from './styles'

// The pieces every module is shown with: its icon tile, its status, and a card. Active modules lead with
// a way in; planned ones have no link or button, so they never read as something you can open.

// The module's symbol on its tile. Active modules sit on electric tint; planned ones stay grey.
// onNight: a white tile, so the mark keeps its midnight pickup on the night ground.
export function ModuleIconTile({ module, size = 'md', onNight }: { module: ServiceModule; size?: 'sm' | 'md' | 'lg'; onNight?: boolean }) {
  const active = module.status === 'active'
  const Icon = (active && module.brandIcon) || module.icon
  const box = { sm: 'h-9 w-9 rounded-lg', md: 'h-11 w-11 rounded-xl', lg: 'h-14 w-14 rounded-2xl' }[size]
  const glyph = { sm: 'h-5 w-5', md: 'h-6 w-6', lg: active ? 'h-9 w-9' : 'h-6 w-6' }[size]
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${box} ${
        onNight
          ? 'bg-white shadow-[0_10px_24px_-12px_rgb(2_151_222/0.6)]'
          : active
            ? 'bg-brand-50 shadow-[inset_0_0_0_1px_var(--color-brand-100)]'
            : 'bg-slate-100 text-slate-500'
      }`}
      aria-hidden
    >
      <Icon className={`${glyph} ${active ? 'text-brand-600' : ''}`} />
    </span>
  )
}

// Status in words, with a mark that differs by shape as well as colour: a solid dot, or a dashed ring.
// Same language as the public site.
export function ModuleBadge({ status, onNight }: { status: ModuleStatus; onNight?: boolean }) {
  const active = status === 'active'
  const look = onNight
    ? 'bg-emerald-400/15 text-emerald-200 shadow-[inset_0_0_0_1px_rgb(52_211_153/0.25)]'
    : active
      ? 'bg-emerald-50 text-emerald-800 shadow-[inset_0_0_0_1px_rgb(16_185_129/0.18)]'
      : 'border border-dashed border-slate-300 text-slate-600'
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${look}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? (onNight ? 'bg-emerald-400' : 'bg-emerald-600') : 'border border-slate-400'}`} aria-hidden />
      {active ? 'Active' : 'Planned'}
    </span>
  )
}

// The module's name with its category, as used at the top of every active-module card
function ModuleTitle({ module, id, large }: { module: ServiceModule; id?: string; large?: boolean }) {
  return (
    <div className="min-w-0">
      <h3 id={id} className={`font-heading font-bold leading-tight tracking-[-0.025em] text-rc-navy ${large ? 'text-[22px]' : 'text-lg'}`}>
        {module.name}
      </h3>
      <p className="text-sm font-medium text-slate-500">{module.category}</p>
    </div>
  )
}

// The way into an active module. The arrow steps forward on hover; a press settles the whole pill.
export function OpenModuleLink({ module, className = '', onNight }: { module: ActiveModule; className?: string; onNight?: boolean }) {
  return (
    <Link to={module.route} className={`group/open ${onNight ? inverseButton : primaryButton} ${compactButton} ${className}`}>
      {module.actionLabel}
      <ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out-quart group-hover/open:translate-x-0.5" aria-hidden />
    </Link>
  )
}

// The overview's lead module: who it is, what it does, how it's going (children: a bare MetricGroup), and the way in.
// Console 2.0: the one night surface on the sheet. Its own trip is drawn large across the right, and draws itself
// once as the overview opens; the numbers below stay on white, where they are easiest to read.
export function ActiveModuleFeature({ module, headingId, children }: { module: ActiveModule; headingId: string; children?: ReactNode }) {
  return (
    <article aria-labelledby={headingId} className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-rest)]">
      <div className="rc-night relative isolate flex flex-1 flex-col gap-6 overflow-hidden bg-night p-6 text-slate-300 sm:p-7">
        <RouteArt className="bottom-0 right-0 h-[170px] w-[306px] max-sm:hidden" />
        <div className="flex items-start gap-4">
          <ModuleIconTile module={module} size="lg" onNight />
          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <h3 id={headingId} className="font-heading text-[26px] font-bold leading-tight tracking-[-0.03em] text-white">
                {module.name}
              </h3>
              <p className="text-sm font-medium text-slate-400">{module.category}</p>
            </div>
            <ModuleBadge status="active" onNight />
          </div>
        </div>
        {/* The words keep to the left, clear of the drawn trip */}
        <div className="mt-auto sm:max-w-[min(44ch,calc(100%-17rem))]">
          <p className="text-[15px] leading-relaxed text-slate-300">{module.description}</p>
          <OpenModuleLink module={module} onNight className="mt-5" />
        </div>
      </div>
      {children}
    </article>
  )
}

// One trip, drawn like the CareRide mark at card scale: an open pickup ring, a road that steps up, a cantaloupe
// drop-off. A faint street grid sits behind it. Decoration only, so it is hidden from assistive technology; the
// caller places it clear of the words.
export function RouteArt({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 200" className={`pointer-events-none absolute -z-10 ${className}`} aria-hidden focusable="false">
      <defs>
        <pattern id="rc-streets" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="rgb(255 255 255 / 0.09)" />
        </pattern>
      </defs>
      <rect width="360" height="200" fill="url(#rc-streets)" />
      <path d="M96 150h40a32 32 0 0 0 32-32V92a32 32 0 0 1 32-32h86" fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" />
      <path
        className="rc-route-draw"
        pathLength={1}
        d="M96 150h40a32 32 0 0 0 32-32V92a32 32 0 0 1 32-32h86"
        fill="none"
        stroke="#0297DE"
        strokeWidth="12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="rc-stop-in" cx="62" cy="150" r="15" fill="none" stroke="#fff" strokeWidth="8" />
      <circle className="rc-stop-in" style={{ ['--stop-delay' as string]: '850ms' }} cx="314" cy="60" r="19" fill="#FC734D" />
    </svg>
  )
}

// A working module on the modules page: what it does, how it's going, and the way in.
export function ServiceModuleCard({ module, status }: { module: ActiveModule; status?: ReactNode }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-rest)] p-5">
      <div className="flex items-start gap-3.5">
        <ModuleIconTile module={module} />
        <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2">
          <ModuleTitle module={module} />
          <ModuleBadge status="active" />
        </div>
      </div>
      <p className="mt-4 text-sm text-slate-600">{module.description}</p>
      {status && <div className="mt-3 text-sm text-slate-700">{status}</div>}
      <div className="mt-auto pt-5">
        <OpenModuleLink module={module} />
      </div>
    </article>
  )
}

// A module on the roadmap. Dashed, quieter, and without a link or a hover, so it never reads as something you can open.
export function PlannedModuleCard({ module, short }: { module: PlannedModule; short?: boolean }) {
  return (
    <article className="flex h-full gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 p-4">
      <ModuleIconTile module={module} size="sm" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h3 className="font-sans text-[15px] font-semibold text-rc-navy">{module.name}</h3>
          <ModuleBadge status="planned" />
        </div>
        <p className="mt-1 text-sm text-slate-600">{short ? module.summary : module.description}</p>
        <p className="mt-auto pt-3 text-[13px] font-medium text-slate-500">{module.category} · In development</p>
      </div>
    </article>
  )
}
