import type { ReactNode } from 'react'

interface Props {
  eyebrow?: ReactNode // e.g. today's date, or the module a page belongs to. Shown under the title, never above it.
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

// The top of a workspace page. It sits on the canvas, not in a card, so the panels below read as the content.
// The title leads; context such as the date or a reference follows it as a quiet meta line.
export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-heading text-[28px] font-bold leading-[1.15] tracking-[-0.025em] text-balance text-rc-navy sm:text-[32px]">{title}</h1>
        {eyebrow && <p className="mt-1.5 text-sm font-semibold text-slate-500">{eyebrow}</p>}
        {description && <div className={`${eyebrow ? 'mt-1' : 'mt-2'} max-w-2xl text-base text-slate-600`}>{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
