import { Pencil } from 'lucide-react'
import type { ReactNode } from 'react'
import { focusRing } from '../auth/styles'

// One section of an application's review step: what was entered, and a way back to change it
export function ReviewCard({ title, icon, onEdit, rows }: { title: string; icon?: ReactNode; onEdit?: () => void; rows: [string, string][] }) {
  return (
    <section className="rounded-xl border border-rc-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-rc-line px-5 py-3">
        <h2 className="flex items-center gap-2 font-heading text-base font-bold text-rc-navy">
          {icon}
          {title}
        </h2>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`}
            aria-label={`Edit ${title.toLowerCase()}`}
          >
            <Pencil className="h-4 w-4" aria-hidden /> Edit
          </button>
        )}
      </div>
      <dl className="grid gap-x-6 gap-y-2.5 px-5 py-4 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium text-rc-navy">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
