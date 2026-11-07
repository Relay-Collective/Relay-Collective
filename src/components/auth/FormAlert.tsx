import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import type { ReactNode } from 'react'

const TONES = {
  error: { box: 'border-red-200 bg-red-50 text-red-800', icon: AlertCircle, role: 'alert' },
  info: { box: 'border-rc-line bg-rc-canvas text-slate-700', icon: Info, role: 'status' },
  success: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle2, role: 'status' },
} as const

interface Props {
  tone?: keyof typeof TONES
  children: ReactNode
  className?: string
  shake?: boolean // replays a small shake, e.g. on each failed sign-in
}

// A message about the whole form (field messages sit under their fields instead)
export function FormAlert({ tone = 'error', children, className = '', shake }: Props) {
  const t = TONES[tone]
  return (
    <div role={t.role} className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-medium ${t.box} ${shake ? 'animate-shake' : ''} ${className}`}>
      <t.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  )
}
