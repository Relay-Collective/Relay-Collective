import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { ActiveModule, ModuleStatus, PlannedModule, ServiceModule } from '../../workspace/modules'
import { primaryButton } from '../ui'
import { compactButton } from './styles'

// The pieces every module is shown with: its icon tile, its status, and a card. Active modules lead with
// a way in; planned ones have no link or button, so they never read as something you can open.

// The module's symbol on its tile. Active modules sit on electric tint; planned ones stay grey.
export function ModuleIconTile({ module, size = 'md' }: { module: ServiceModule; size?: 'sm' | 'md' | 'lg' }) {
  const active = module.status === 'active'
  const Icon = (active && module.brandIcon) || module.icon
  const box = { sm: 'h-9 w-9 rounded-lg', md: 'h-11 w-11 rounded-xl', lg: 'h-12 w-12 rounded-xl' }[size]
  const glyph = { sm: 'h-5 w-5', md: 'h-6 w-6', lg: active ? 'h-8 w-8' : 'h-6 w-6' }[size]
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${box} ${
        active ? 'bg-brand-50 shadow-[inset_0_0_0_1px_var(--color-brand-100)]' : 'bg-slate-100 text-slate-500'
      }`}
      aria-hidden
    >
      <Icon className={`${glyph} ${active ? 'text-brand-600' : ''}`} />
    </span>
  )
}

// Status in words, with a mark that differs by shape as well as colour: a solid dot, or a dashed ring.
// Same language as the public site.
export function ModuleBadge({ status }: { status: ModuleStatus }) {
  const active = status === 'active'
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        active ? 'bg-emerald-50 text-emerald-800' : 'border border-dashed border-slate-300 text-slate-600'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-600' : 'border border-slate-400'}`} aria-hidden />
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
export function OpenModuleLink({ module, className = '' }: { module: ActiveModule; className?: string }) {
  return (
    <Link to={module.route} className={`group/open ${primaryButton} ${compactButton} ${className}`}>
      {module.actionLabel}
      <ArrowRight className="h-4 w-4 transition-transform duration-150 ease-out-quart group-hover/open:translate-x-0.5" aria-hidden />
    </Link>
  )
}

// The overview's lead module: who it is, what it does, how it's going (children: a bare MetricGroup), and the way in.
export function ActiveModuleFeature({ module, headingId, children }: { module: ActiveModule; headingId: string; children?: ReactNode }) {
  return (
    <article aria-labelledby={headingId} className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-1 flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <ModuleIconTile module={module} size="lg" />
          <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <ModuleTitle module={module} id={headingId} large />
            <ModuleBadge status="active" />
          </div>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="max-w-[52ch] text-[15px] leading-relaxed text-slate-600">{module.description}</p>
          <OpenModuleLink module={module} className="self-start sm:self-auto" />
        </div>
      </div>
      {children}
    </article>
  )
}

// A working module on the modules page: what it does, how it's going, and the way in.
export function ServiceModuleCard({ module, status }: { module: ActiveModule; status?: ReactNode }) {
  return (
    <article className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-5">
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
