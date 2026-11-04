import type { ReactNode } from 'react'

interface Props {
  eyebrow?: ReactNode // e.g. today's date, or the module a page belongs to. Shown under the title, never above it.
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}

// The top of a workspace page. It sits on the canvas, not in a card, so the panels below read as the content.
// The title leads; context such as the date or a reference follows it as a quiet meta line.

// A greeting with its time of day set as the one warm accent: "Good <em>morning</em>." The words, and so the
// heading's name, are unchanged. Instrument Serif italic, in cantaloupe at display size (3.35:1, large text).
export function Greeting({ greeting, name }: { greeting: string; name?: string }) {
  const [lead, ...rest] = greeting.split(' ')
  const accent = rest.join(' ')
  return (
    <>
      {accent ? `${lead} ` : greeting}
      {accent && <em className="font-editorial text-[1.12em] font-normal italic tracking-[-0.01em] text-cantaloupe-display">{accent}</em>}
      {name ? `, ${name}.` : '.'}
    </>
  )
}
export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-heading text-[30px] font-bold leading-[1.08] tracking-[-0.035em] text-balance text-ink sm:text-[40px]">{title}</h1>
        {eyebrow && <p className="mt-2 text-sm font-semibold text-slate-500">{eyebrow}</p>}
        {description && <div className={`${eyebrow ? 'mt-1' : 'mt-2.5'} max-w-2xl text-base text-slate-600 sm:text-[17px]`}>{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
