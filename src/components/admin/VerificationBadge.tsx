import { BadgeCheck, CircleX, Clock } from 'lucide-react'
import { VERIFICATION_TEXT } from '../../logic/adminSummary'
import type { VerificationStatus } from '../../types'

const LOOK: Record<VerificationStatus, { icon: typeof Clock; className: string }> = {
  PENDING: { icon: Clock, className: 'bg-sun-100 text-amber-900' },
  APPROVED: { icon: BadgeCheck, className: 'bg-emerald-50 text-emerald-800' },
  REJECTED: { icon: CircleX, className: 'bg-slate-100 text-slate-700' },
}

// A review status in words and an icon, never colour alone
export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const { icon: Icon, className } = LOOK[status]
  const text = VERIFICATION_TEXT[status]
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {text}
    </span>
  )
}
