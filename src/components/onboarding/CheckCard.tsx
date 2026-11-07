import { Check } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  checked: boolean
  onChange: () => void
  title: string
  description?: string
  icon?: ReactNode
  badge?: ReactNode
}

// A card-sized checkbox, for picking several options. A real checkbox inside, so Space and screen readers work.
export function CheckCard({ checked, onChange, title, description, icon, badge }: Props) {
  return (
    <label
      className={`group relative flex cursor-pointer items-start gap-3.5 rounded-xl border bg-white p-4 transition duration-150 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rc-blue has-[:focus-visible]:ring-offset-2 ${
        checked ? 'border-rc-blue bg-brand-50/50 shadow-[0_0_0_1px_var(--color-rc-blue)]' : 'border-rc-line hover:border-slate-300'
      }`}
    >
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
      {icon && (
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition ${checked ? 'bg-rc-blue text-white' : 'bg-rc-canvas text-rc-navy'}`}
          aria-hidden
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-rc-navy">{title}</span>
          {badge}
        </span>
        {description && <span className="mt-0.5 block text-sm text-slate-600">{description}</span>}
      </span>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
          checked ? 'border-rc-blue bg-rc-blue text-white' : 'border-slate-300 bg-white'
        }`}
        aria-hidden
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
    </label>
  )
}
