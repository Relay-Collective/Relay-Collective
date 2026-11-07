import {
  Bug,
  CircleCheck,
  CircleDot,
  CircleX,
  Clock,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  Megaphone,
  MessageSquare,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { PRIORITY_LABELS, STATUS_LABELS, TYPE_LABELS } from '../../feedback/rules'
import type { ProductFeedbackPriority, ProductFeedbackStatus, ProductFeedbackType } from '../../types'

const pill = 'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold'

// Words and an icon for every status, never colour alone
const STATUS_LOOK: Record<ProductFeedbackStatus, { icon: LucideIcon; className: string }> = {
  new: { icon: CircleDot, className: 'bg-brand-50 text-rc-blue' },
  under_review: { icon: Search, className: 'bg-sun-100 text-amber-900' },
  planned: { icon: ListChecks, className: 'bg-cyan-50 text-cyan-900' },
  in_progress: { icon: LoaderCircle, className: 'bg-indigo-50 text-indigo-800' },
  resolved: { icon: CircleCheck, className: 'bg-emerald-50 text-emerald-800' },
  closed: { icon: CircleX, className: 'bg-slate-100 text-slate-700' },
}

export function FeedbackStatusBadge({ status }: { status: ProductFeedbackStatus }) {
  const { icon: Icon, className } = STATUS_LOOK[status]
  return (
    <span className={`${pill} ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}

// Restrained: only critical gets a strong colour, so it stands out in a long list
const PRIORITY_LOOK: Record<ProductFeedbackPriority, string> = {
  low: 'border border-slate-200 bg-white text-slate-600',
  medium: 'border border-sky-200 bg-sky-50 text-sky-800',
  high: 'border border-amber-300 bg-sun-50 text-amber-900',
  critical: 'border border-red-300 bg-red-50 text-red-800',
}

export function FeedbackPriorityBadge({ priority }: { priority?: ProductFeedbackPriority }) {
  if (!priority) return <span className="text-xs text-slate-500">Not set</span>
  return (
    <span className={`${pill} ${PRIORITY_LOOK[priority]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${priority === 'critical' ? 'bg-red-600' : priority === 'high' ? 'bg-amber-500' : priority === 'medium' ? 'bg-sky-500' : 'bg-slate-400'}`} aria-hidden />
      {PRIORITY_LABELS[priority]}
    </span>
  )
}

export const TYPE_ICON: Record<ProductFeedbackType, LucideIcon> = {
  bug: Bug,
  feature_request: Lightbulb,
  improvement: Sparkles,
  release_feedback: Megaphone,
  general: MessageSquare,
}

export function FeedbackTypeLabel({ type }: { type: ProductFeedbackType }) {
  const Icon = TYPE_ICON[type]
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-700">
      <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      {TYPE_LABELS[type]}
    </span>
  )
}

// "Updated" beside feedback with a reply or status change the submitter hasn't opened yet
export function UpdatedPill() {
  return (
    <span className={`${pill} bg-sun-400 text-ink`}>
      <Clock className="h-3.5 w-3.5" aria-hidden />
      Updated
    </span>
  )
}
