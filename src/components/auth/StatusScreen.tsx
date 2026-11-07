import type { ReactNode } from 'react'
import { authLead, authTitle } from './styles'

const TONES = {
  brand: 'bg-brand-50 text-rc-blue',
  teal: 'bg-rc-mint text-rc-teal-ink',
  warning: 'bg-sun-100 text-amber-900',
  danger: 'bg-red-50 text-red-700',
}

interface Props {
  icon: ReactNode
  tone?: keyof typeof TONES
  title: string
  children?: ReactNode // the explanation
  actions?: ReactNode
}

// One outcome on its own screen: check your email, link expired, application sent.
export function StatusScreen({ icon, tone = 'brand', title, children, actions }: Props) {
  return (
    <div className="text-center sm:text-left">
      <span className={`mx-auto flex h-14 w-14 animate-pop items-center justify-center rounded-2xl sm:mx-0 ${TONES[tone]}`} aria-hidden>
        {icon}
      </span>
      <h1 tabIndex={-1} className={`${authTitle} mt-6 focus:outline-none`} data-autofocus>
        {title}
      </h1>
      {children && <div className={`${authLead} space-y-3`}>{children}</div>}
      {actions && <div className="mt-8 flex flex-col gap-3">{actions}</div>}
    </div>
  )
}
