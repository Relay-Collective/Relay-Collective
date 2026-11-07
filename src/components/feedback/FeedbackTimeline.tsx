import { CircleDot } from 'lucide-react'
import { STATUS_LABELS } from '../../feedback/rules'
import type { FeedbackStatusChange } from '../../types'
import { DateText } from '../admin/controls'

// A piece of feedback's status changes, oldest first. Admins also see which admin made each one.
export function FeedbackTimeline({ history, showWho }: { history: FeedbackStatusChange[]; showWho?: boolean }) {
  return (
    <ol className="relative ml-2.5 space-y-4 border-l border-slate-200 pl-5">
      {history.map((change) => (
        <li key={change.id} className="relative">
          <span className="absolute -left-[1.95rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500" aria-hidden>
            <CircleDot className="h-3 w-3" />
          </span>
          <p className="text-sm font-semibold text-rc-navy">
            {change.previousStatus ? `${STATUS_LABELS[change.previousStatus]} → ${STATUS_LABELS[change.newStatus]}` : 'Feedback sent'}
          </p>
          <p className="text-xs text-slate-500">
            <DateText at={change.changedAt} withTime />
            {showWho && change.changedByName ? ` · ${change.changedByName}` : ''}
          </p>
        </li>
      ))}
    </ol>
  )
}
