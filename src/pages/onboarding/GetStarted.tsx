import { Building2, Car, Check, HeartHandshake, ShieldCheck, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout'
import { OnboardingStep } from '../../components/onboarding/OnboardingStep'
import { FieldMessage } from '../../components/form/FieldMessage'
import { useApp } from '../../hooks/useApp'
import { useLoadable } from '../../hooks/useLoadable'
import { onboardingPaths } from '../../onboarding/routing'
import { dataService } from '../../services'
import { FullPageLoader } from '../auth/FullPageLoader'

type Path = 'organization' | 'join' | 'volunteer' | 'provider'

const PATHS: { value: Path; title: string; description: string; detail: string; icon: ReactNode }[] = [
  {
    value: 'organization',
    title: 'Register an organization',
    description: 'Bring your nonprofit or community organization onto Relay Collective.',
    detail: 'About 5 minutes. Our team reviews every organization before it goes live.',
    icon: <Building2 className="h-6 w-6" />,
  },
  {
    value: 'join',
    title: 'Join an existing organization',
    description: 'You work or volunteer with an organization that already uses Relay Collective.',
    detail: 'Search for your organization and request access, or use an invitation link.',
    icon: <Users className="h-6 w-6" />,
  },
  {
    value: 'volunteer',
    title: 'Join as a volunteer',
    description: 'Share your interests and discover ways to contribute to your community.',
    detail: 'No vehicle needed. Choose the kinds of help you’d like to give.',
    icon: <HeartHandshake className="h-6 w-6" />,
  },
  {
    value: 'provider',
    title: 'Drive with CareRide',
    description: 'Offer your time and vehicle as a volunteer driver for partner organizations.',
    detail: 'Drivers are verified by our team before receiving any ride requests.',
    icon: <Car className="h-6 w-6" />,
  },
]

// "How would you like to get started?" A choice of path, not of permissions: every path ends in
// a review by Relay Collective or an invitation the backend checks.
export function GetStarted() {
  const { identity, currentUser } = useApp()
  const navigate = useNavigate()
  const [path, setPath] = useState<Path>()
  const [error, setError] = useState<string>()
  // Someone waiting on a request to join goes back to where it stands
  const requests = useLoadable(() => (currentUser ? Promise.resolve([]) : dataService.listMyJoinRequests()), identity?.id)

  if (currentUser) return <Navigate to="/home" replace />
  if (!requests.data && !requests.error) return <FullPageLoader />
  if (requests.data?.some((r) => r.status === 'pending')) return <Navigate to={onboardingPaths.joinStatus} replace />

  function next() {
    if (!path) {
      setError('Choose how you’d like to get started.')
      return
    }
    if (path === 'organization') return navigate(onboardingPaths.organization)
    if (path === 'provider') return navigate(onboardingPaths.provider)
    if (path === 'volunteer') return navigate(onboardingPaths.volunteer)
    navigate(onboardingPaths.join)
  }

  const firstName = identity?.name.split(' ')[0]

  return (
    <OnboardingLayout
      sidebarIntro={
        <div>
          <p className="font-heading text-2xl font-bold tracking-[-0.02em] text-rc-navy">Welcome{firstName ? `, ${firstName}` : ''}.</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Your account is ready. Relay Collective connects nonprofits, their staff, and the people who help them. Pick the path that fits you.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-600">
            {['One account, wherever you take part', 'Every organization and driver is reviewed', 'Your details are shared only as needed'].map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rc-mint text-rc-teal-ink">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      }
      help={<p>Not sure? Choose the closest fit. Nothing is shared or approved until you submit, and you can go back from any step.</p>}
    >
      <OnboardingStep
        stepKey="start"
        title="How would you like to get started?"
        description="Choose the one that fits you best. You can go back before you submit anything."
        onSubmit={next}
        submitLabel="Continue"
      >
        <fieldset aria-describedby="path-message">
          <legend className="sr-only">How would you like to get started?</legend>
          <div className="space-y-3">
            {PATHS.map((p) => {
              const on = path === p.value
              return (
                <label
                  key={p.value}
                  className={`group flex cursor-pointer items-start gap-4 rounded-2xl border bg-white p-5 transition duration-150 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rc-blue has-[:focus-visible]:ring-offset-2 sm:p-6 ${
                    on ? 'border-rc-blue shadow-[0_0_0_1px_var(--color-rc-blue)]' : 'border-rc-line hover:border-slate-300 hover:bg-rc-canvas/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="path"
                    value={p.value}
                    checked={on}
                    onChange={() => {
                      setPath(p.value)
                      setError(undefined)
                    }}
                    className="sr-only"
                  />
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition ${on ? 'bg-rc-blue text-white' : 'bg-rc-canvas text-rc-navy'}`}
                    aria-hidden
                  >
                    {p.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-lg font-bold text-rc-navy">{p.title}</span>
                    <span className="mt-1 block text-slate-600">{p.description}</span>
                    <span className="mt-2 block text-sm text-slate-500">{p.detail}</span>
                  </span>
                  <span
                    className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${on ? 'border-rc-blue bg-rc-blue text-white' : 'border-slate-300'}`}
                    aria-hidden
                  >
                    {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                </label>
              )
            })}
          </div>
          <FieldMessage id="path-message" error={error} />
        </fieldset>

        <p className="mt-8 flex items-start gap-2 text-sm text-slate-500">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Relay Collective administrator accounts are created by our team and can't be requested here.
        </p>
      </OnboardingStep>
    </OnboardingLayout>
  )
}
