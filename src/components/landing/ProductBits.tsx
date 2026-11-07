import { CarFront, Check, CircleCheck, Clock, type LucideIcon } from 'lucide-react'
import type { DemoStatus } from './demo'

// Small pieces of the app, redrawn for the product pictures. Sizes are in em so a picture can scale as one.

// Same words and icons as the app's StatusBadge, so a status never relies on colour alone
const STATUS: Record<DemoStatus, { icon: LucideIcon; tone: string }> = {
  'Finding a driver': { icon: Clock, tone: 'bg-electric-wash text-electric-ink' },
  'Driver confirmed': { icon: Check, tone: 'bg-emerald-50 text-emerald-800' },
  'Picked up': { icon: CarFront, tone: 'bg-midnight text-white' },
  Completed: { icon: CircleCheck, tone: 'bg-slate-100 text-slate-700' },
}

export function StatusPill({ status, size = 'text-[0.6875em]', className = '' }: { status: DemoStatus; size?: string; className?: string }) {
  const { icon: Icon, tone } = STATUS[status]
  return (
    <span className={`inline-flex items-center gap-[0.35em] whitespace-nowrap rounded-full py-[0.3em] pl-[0.55em] pr-[0.75em] font-dm font-semibold ${size} ${tone} ${className}`}>
      <Icon className="h-[1.1em] w-[1.1em] shrink-0" strokeWidth={2.5} />
      {status}
    </span>
  )
}
