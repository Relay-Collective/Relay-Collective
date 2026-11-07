import { ArrowUpRight } from 'lucide-react'
import { useRef, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LogoMark } from '../brand/LogoMark'
import type { Availability } from './content'
import { useInView } from './hooks'
import { focusRing } from './styles'

// Fades its children up the first time they scroll into view. Stagger siblings with delay.
export function Reveal({
  children,
  delay = 0,
  className = '',
  as: Tag = 'div',
  ...rest
}: {
  children: ReactNode
  delay?: number
  className?: string
  as?: ElementType
  'aria-labelledby'?: string
  'aria-label'?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const shown = useInView(ref)
  return (
    <Tag
      {...rest}
      ref={ref}
      data-revealed={shown || undefined}
      className={`rcl-reveal ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as CSSProperties}
    >
      {children}
    </Tag>
  )
}

// The editorial voice: one or two words per heading in Instrument Serif italic.
// Cantaloupe by default, in the shade that holds 3:1 at display size on porcelain.
export function Accent({ children, className = 'text-cantaloupe-display' }: { children: ReactNode; className?: string }) {
  return <em className={`font-editorial text-[1.1em] font-normal italic tracking-[-0.02em] ${className}`}>{children}</em>
}

interface SmartLinkProps {
  href: string
  className?: string
  children: ReactNode
  onClick?: () => void
}

// One link for every destination: in-page anchors, app routes, and outside sites (new tab, announced)
export function SmartLink({ href, className, children, onClick }: SmartLinkProps) {
  if (href.startsWith('#')) {
    return (
      <a href={href} className={className} onClick={onClick}>
        {children}
      </a>
    )
  }
  if (/^https?:/.test(href)) {
    return (
      <a href={href} className={className} onClick={onClick} target="_blank" rel="noreferrer">
        {children}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    )
  }
  return (
    <Link to={href} className={className} onClick={onClick}>
      {children}
    </Link>
  )
}

export function ExternalIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <ArrowUpRight className={className} aria-hidden />
}

// Live work and planned work never look the same: a solid dot, a half dot, a dashed ring. The words say it too.
export function StatusTag({ availability, children }: { availability: Availability; children: ReactNode }) {
  const dot =
    availability === 'live'
      ? 'bg-electric'
      : availability === 'partial'
        ? 'bg-[linear-gradient(90deg,var(--color-cantaloupe)_50%,transparent_50%)] ring-1 ring-cantaloupe'
        : 'border border-dashed border-hush'
  const tone = availability === 'planned' ? 'border-dashed border-midnight/25 bg-transparent' : 'border-hairline bg-white'
  return (
    <span className={`inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1 font-dm text-[13px] font-medium text-midnight-soft ${tone}`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
      {children}
    </span>
  )
}

export function Wordmark({ to = '/', onClick }: { to?: string; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className={`inline-flex min-h-11 items-center gap-2.5 rounded-lg ${focusRing}`} aria-label="Relay Collective home">
      <LogoMark className="h-8 w-8" />
      <span className="whitespace-nowrap font-grotesk text-[18px] font-semibold tracking-[-0.03em] text-midnight">Relay Collective</span>
    </Link>
  )
}
