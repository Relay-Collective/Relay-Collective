import { ArrowRight, Building2, Car, ChevronDown, HeartHandshake, Loader2, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { ROLE_TONE, tones } from '../../components/ui'
import { focusRing } from '../../components/auth/styles'
import { initials } from '../../logic/initials'
import { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_EMAIL_DOMAIN, DEMO_PASSWORD, demoPasswordFor } from '../../services/seed'
import type { User, UserRole } from '../../types'

// Demo accounts, grouped by what each kind of account does. Local mock backend only.
const ROLE_GROUPS: { role: UserRole; title: string; text: string; icon: ReactNode }[] = [
  { role: 'PARTNER', title: 'Partner organizations', text: 'Book rides for clients and track them.', icon: <Building2 className="h-4 w-4" /> },
  { role: 'DRIVER', title: 'Drivers', text: 'Accept ride requests and drive trips.', icon: <Car className="h-4 w-4" /> },
  { role: 'VOLUNTEER', title: 'Volunteers', text: 'Share how you’d like to help. Not a driver.', icon: <HeartHandshake className="h-4 w-4" /> },
  { role: 'PLATFORM_ADMIN', title: 'Relay Collective admin', text: 'Approve organizations and drivers.', icon: <ShieldCheck className="h-4 w-4" /> },
]

interface Props {
  users: User[]
  busyId?: string
  disabled: boolean
  defaultOpen: boolean
  onPick: (user: User, password: string) => void
}

export function DemoAccounts({ users, busyId, disabled, defaultOpen, onPick }: Props) {
  const demoUsers = users.filter((u) => u.email?.endsWith(DEMO_EMAIL_DOMAIN) || u.email === ADMIN_EMAIL)
  const groups = ROLE_GROUPS.map((g) => ({ ...g, users: demoUsers.filter((u) => u.role === g.role) })).filter((g) => g.users.length > 0)
  if (!groups.length) return null

  return (
    <details open={defaultOpen} className="group mt-8 rounded-xl border border-rc-line bg-rc-canvas">
      <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 font-semibold text-rc-navy ${focusRing} [&::-webkit-details-marker]:hidden`}>
        <span>
          Explore with a demo account
          <span className="block text-sm font-normal text-slate-500">Sign in as anyone below. No password needed.</span>
        </span>
        <ChevronDown className="details-chevron h-5 w-5 shrink-0 text-slate-400 transition" aria-hidden />
      </summary>

      <ul className="divide-y divide-rc-line border-t border-rc-line px-4">
        {groups.map((g) => {
          const tone = tones[ROLE_TONE[g.role]]
          return (
            <li key={g.role} className="py-3.5">
              <h2 className="flex items-center gap-2 font-sans text-sm font-bold">
                <span className={tone.text} aria-hidden>
                  {g.icon}
                </span>
                {g.title}
                <span className="font-normal text-slate-500">· {g.text}</span>
              </h2>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {g.users.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(u, demoPasswordFor(u.email!))}
                    aria-label={`Sign in as ${u.name}`}
                    className={`group/chip inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white py-0.5 pl-0.5 pr-3 text-left text-sm font-semibold text-ink transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-60 ${focusRing} ${tone.border}`}
                  >
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${tone.solid}`} aria-hidden>
                      {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : initials(u.name)}
                    </span>
                    {u.name}
                    <ArrowRight className="-ml-2 h-4 w-0 text-slate-400 opacity-0 transition-all group-hover/chip:ml-0 group-hover/chip:w-4 group-hover/chip:opacity-100" aria-hidden />
                  </button>
                ))}
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center justify-between gap-3 border-t border-rc-line px-4 py-3 text-sm text-slate-600">
        <span>
          Password: <code className="rounded bg-white px-1.5 py-0.5 font-semibold text-ink">{DEMO_PASSWORD}</code> (admin:{' '}
          <code className="rounded bg-white px-1.5 py-0.5 font-semibold text-ink">{ADMIN_PASSWORD}</code>)
        </span>
        <CopyButton text={DEMO_PASSWORD} label="demo password" />
      </div>
    </details>
  )
}
