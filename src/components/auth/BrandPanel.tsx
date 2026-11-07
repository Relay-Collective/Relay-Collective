import { Accessibility, CalendarPlus, Check, CircleCheck, Clock, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { LogoMark, wordmark } from '../brand/LogoMark'
import { focusRing } from './styles'

interface Props {
  title: string
  body: string
}

// The left half of the sign-in and sign-up screens, in the public site's language: porcelain, an electric field,
// and one ride seen the way staff see it. The title's last word takes the editorial serif.
export function BrandPanel({ title, body }: Props) {
  const words = title.trim().split(' ')
  const last = words.pop()
  return (
    <div className="relative flex h-full flex-col overflow-hidden border-r border-rc-line bg-rc-canvas px-10 py-9 xl:px-14">
      <span className="pointer-events-none absolute -bottom-52 -right-44 h-[440px] w-[440px] rounded-full bg-brand-500" aria-hidden />

      <Link to="/" className={`relative inline-flex min-h-11 items-center gap-2.5 self-start rounded-lg ${focusRing}`} aria-label="Relay Collective home">
        <LogoMark className="h-9 w-9" />
        <span className={`${wordmark} text-xl`}>Relay Collective</span>
      </Link>

      <div className="relative mt-16 xl:mt-20">
        <p className="max-w-md font-display text-[40px] font-semibold leading-[1.02] tracking-[-0.04em] text-balance text-ink xl:text-[48px]">
          {words.join(' ')} <em className="font-editorial text-[1.1em] font-normal italic tracking-[-0.02em] text-cantaloupe-display">{last}</em>
        </p>
        <p className="mt-5 max-w-sm text-[17px] leading-relaxed text-slate-600">{body}</p>
      </div>

      <RidePreview />

      <p className="relative mt-auto flex max-w-[19rem] items-start gap-2.5 pt-10 text-sm leading-relaxed text-slate-600">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-hidden />
        Transportation coordination is live. Volunteer coordination and resource sharing are planned.
      </p>
    </div>
  )
}

// One illustrative ride, in the app's own status words. Decorative: the copy beside it carries the message.
function RidePreview() {
  const steps = [
    { label: 'Finding a driver', icon: Clock, done: true },
    { label: 'Driver confirmed', icon: Check, done: true },
    { label: 'Completed', icon: CircleCheck, done: false },
  ]
  return (
    <div className="relative ml-auto mt-12 w-[300px] select-none xl:w-[320px]" aria-hidden>
      <span className="absolute -right-5 -top-5 h-14 w-14 rounded-full bg-coral-400" />
      <div className="relative rounded-2xl border border-rc-line bg-white p-5 shadow-[0_1px_2px_rgb(17_24_32/0.05),0_32px_64px_-28px_rgb(17_24_32/0.35)]">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500">Ride request</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 py-0.5 pl-1.5 pr-2.5 text-xs font-semibold text-emerald-800">
            <Check className="h-3.5 w-3.5" strokeWidth={2.75} /> Driver confirmed
          </span>
        </div>
        <p className="mt-3 font-display text-lg font-semibold tracking-[-0.02em] text-ink">Ride to a medical appointment</p>
        <ul className="mt-2 space-y-1 text-[13px] text-slate-600">
          <li className="flex items-center gap-2">
            <CalendarPlus className="h-4 w-4 text-slate-500" /> Today, 2:30 PM
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-500" /> Downtown Health Clinic
          </li>
          <li className="flex items-center gap-2">
            <Accessibility className="h-4 w-4 text-slate-500" /> Wheelchair accessible
          </li>
        </ul>
        <ol className="mt-4 flex items-center gap-1.5 border-t border-rc-line pt-4">
          {steps.map(({ label, icon: Icon, done }, i) => (
            <li key={label} className="flex flex-1 items-center gap-1.5">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  done ? 'bg-brand-600 text-white' : 'border border-slate-300 text-slate-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
              {i < steps.length - 1 && <span className={`h-[2px] flex-1 rounded-full ${done ? 'bg-brand-600' : 'bg-slate-200'}`} />}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
