import { Check, ShieldCheck, UserRound } from 'lucide-react'
import { useId } from 'react'
import { MEMBER_STATUS_LABEL, ORG_ROLES, REQUEST_STATUS_LABEL, roleLabel } from '../../logic/membership'
import type { JoinRequestStatus, MembershipStatus, OrgRole } from '../../types'

interface Props {
  value: OrgRole | undefined
  onChange: (role: OrgRole) => void
  legend: string
  error?: string
  disabled?: boolean
}

// Choose an organization role, with what each one can do. Only organization roles are offered:
// platform administration is never something an organization can grant.
export function MemberRoleSelector({ value, onChange, legend, error, disabled }: Props) {
  const name = useId()
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined} disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold text-rc-navy">{legend}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {ORG_ROLES.map((role) => {
          const on = value === role.value
          const Icon = role.value === 'ADMIN' ? ShieldCheck : UserRound
          return (
            <label
              key={role.value}
              className={`flex cursor-pointer flex-col rounded-xl border p-4 transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rc-blue has-[:focus-visible]:ring-offset-2 ${
                on ? 'border-rc-blue bg-brand-50/40 shadow-[0_0_0_1px_var(--color-rc-blue)]' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input type="radio" name={name} value={role.value} checked={on} onChange={() => onChange(role.value)} className="sr-only" />
              <span className="flex items-center gap-2 font-semibold text-rc-navy">
                <Icon className={`h-4 w-4 ${on ? 'text-rc-blue' : 'text-slate-500'}`} aria-hidden />
                {role.label}
                <span
                  className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    on ? 'border-rc-blue bg-rc-blue text-white' : 'border-slate-300'
                  }`}
                  aria-hidden
                >
                  {on && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
              </span>
              <span className="mt-1 text-sm text-slate-600">{role.description}</span>
              <ul className="mt-2 space-y-1 text-[13px] text-slate-600">
                {role.can.map((c) => (
                  <li key={c} className="flex items-start gap-1.5">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rc-teal-ink" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            </label>
          )
        })}
      </div>
      {error && (
        <p id={`${name}-error`} role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </fieldset>
  )
}

const ROLE_PILL: Record<OrgRole, string> = {
  ADMIN: 'bg-brand-50 text-rc-blue',
  STAFF: 'bg-slate-100 text-slate-700',
}

export function RoleBadge({ role }: { role: OrgRole }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${ROLE_PILL[role]}`}>
      {role === 'ADMIN' && <ShieldCheck className="h-3.5 w-3.5" aria-hidden />}
      {roleLabel(role)}
    </span>
  )
}

const REQUEST_PILL: Record<JoinRequestStatus, string> = {
  pending: 'bg-sun-100 text-amber-900',
  approved: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-800',
  cancelled: 'bg-slate-100 text-slate-600',
}

export function RequestStatusBadge({ status }: { status: JoinRequestStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${REQUEST_PILL[status]}`}>{REQUEST_STATUS_LABEL[status]}</span>
  )
}

const MEMBER_PILL: Record<MembershipStatus, string> = {
  active: 'bg-emerald-50 text-emerald-800',
  removed: 'bg-red-50 text-red-800',
  closed: 'bg-slate-100 text-slate-600',
}

export function MemberStatusBadge({ status }: { status: MembershipStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${MEMBER_PILL[status]}`}>{MEMBER_STATUS_LABEL[status]}</span>
}
