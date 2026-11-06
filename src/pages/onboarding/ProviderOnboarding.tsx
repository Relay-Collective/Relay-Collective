import { ArrowRight, Car, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { StatusScreen } from '../../components/auth/StatusScreen'
import { softPanel } from '../../components/auth/styles'
import { DriverAboutFields, DriverRequestFields, DriverVehicleFields } from '../../components/DriverFields'
import {
  driverAboutErrors,
  driverAreaErrors,
  driverRequestErrors,
  driverVehicleErrors,
  emptyDriverDraft,
  splitDriverDraft,
  type DriverDraft,
  type FieldErrors,
} from '../../components/driverDraft'
import { FieldMessage } from '../../components/form/FieldMessage'
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout'
import { OnboardingStep } from '../../components/onboarding/OnboardingStep'
import { ReviewCard } from '../../components/onboarding/ReviewCard'
import type { StepItem } from '../../components/onboarding/OnboardingStepper'
import { label as labelClass, primaryButton } from '../../components/ui'
import { BACKGROUND_LABELS } from '../../constants'
import { useApp } from '../../hooks/useApp'
import { describeRequestHours } from '../../logic/requestHours'
import { clearDraft, loadDraft, saveDraft } from '../../onboarding/drafts'
import { focusFirstError } from '../../onboarding/focus'
import { onboardingPaths } from '../../onboarding/routing'
import { dataService } from '../../services'
import type { DriverBackground, Identity } from '../../types'

type StepId = 'about' | 'vehicle' | 'requests' | 'review'

interface ProviderDraft {
  driver: DriverDraft
  acknowledged: boolean
}

// Who can sign up as a driver themselves. Organization drivers are added by their transport provider.
const BACKGROUNDS: DriverBackground[] = ['TAXI', 'RIDESHARE', 'INDEPENDENT']

// Same rules as the driver sign-up has always had, shared with CareRide enrollment; the backend checks them again.
const VALIDATE: Record<StepId, (d: ProviderDraft) => FieldErrors> = {
  about: ({ driver: d }) => driverAboutErrors(d),
  vehicle: ({ driver: d }) => ({ ...driverVehicleErrors(d), ...driverAreaErrors(d) }),
  requests: ({ driver: d }) => driverRequestErrors(d),
  review: (d) => (d.acknowledged ? {} : { acknowledged: 'Please confirm to submit.' }),
}

interface StepDef extends StepItem {
  id: StepId
  heading: string
  lead: string
  help: ReactNode
}

const STEPS: StepDef[] = [
  {
    id: 'about',
    title: 'About you',
    description: 'How we reach you',
    heading: 'Tell us about yourself.',
    lead: 'Partner organizations see your first name and vehicle when you accept a ride.',
    help: <p>Your phone number is shared only with the organization whose ride you accept, so they can reach you at pickup.</p>,
  },
  {
    id: 'vehicle',
    title: 'Vehicle and area',
    description: 'What you drive, and where',
    heading: 'Your vehicle and service area.',
    lead: 'We only send you rides your vehicle can take, in the cities you choose.',
    help: <p>Accessibility matters: tell us if your vehicle takes a wheelchair, so riders who need it are matched with you.</p>,
  },
  {
    id: 'requests',
    title: 'Availability',
    description: 'When to send requests',
    heading: 'When should we send you requests?',
    lead: 'Pick the times you’re happy to hear about rides. You still decide which ones to take, and can change this anytime.',
    help: <p>Requests are never a commitment. Decline anything that doesn't suit you, no questions asked.</p>,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Check and submit',
    heading: 'Review your details.',
    lead: 'Check everything, then submit for verification.',
    help: <p>Our team verifies every driver before any ride requests are sent. We may contact you for your licence or other documents.</p>,
  },
]

const STEP_IDS = STEPS.map((s) => s.id)

export function ProviderOnboarding() {
  const { identity } = useApp()
  if (!identity) return null
  return <ProviderFlow identity={identity} />
}

function ProviderFlow({ identity }: { identity: Identity }) {
  const { currentUser, reloadSession } = useApp()
  const navigate = useNavigate()
  const [initial] = useState(() => {
    const fallback: ProviderDraft = { driver: { ...emptyDriverDraft, background: 'INDEPENDENT', name: identity.name }, acknowledged: false }
    const saved = loadDraft('provider', identity.id, fallback)
    return { draft: { ...saved.value, acknowledged: false }, index: Math.max(0, STEP_IDS.indexOf(saved.step as StepId)) }
  })
  const [draft, setDraft] = useState<ProviderDraft>(initial.draft)
  const [index, setIndex] = useState(initial.index)
  const [furthest, setFurthest] = useState(initial.index)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const [submitted, setSubmitted] = useState(false)
  const step = STEPS[index]

  useEffect(() => {
    if (!submitted) saveDraft('provider', identity.id, { ...draft, acknowledged: false }, step.id)
  }, [draft, step.id, identity.id, submitted])

  function setDriver(driver: DriverDraft) {
    setDraft((d) => ({ ...d, driver }))
    if (Object.keys(errors).length) setErrors({})
    setSubmitError(undefined)
  }

  function go(to: number) {
    if (to < 0 || to >= STEPS.length || busy) return
    setDirection(to < index ? 'back' : 'forward')
    setErrors({})
    setIndex(to)
    setFurthest((f) => Math.max(f, to))
  }

  async function next() {
    const found = VALIDATE[step.id](draft)
    if (Object.keys(found).length) {
      setErrors(found)
      focusFirstError()
      return
    }
    if (step.id !== 'review') return go(index + 1)
    const invalid = STEPS.findIndex((s) => s.id !== 'review' && Object.keys(VALIDATE[s.id](draft)).length > 0)
    if (invalid >= 0) {
      go(invalid)
      setErrors(VALIDATE[STEPS[invalid].id](draft))
      return
    }
    setBusy(true)
    setSubmitError(undefined)
    try {
      const [user, driver] = splitDriverDraft({ ...draft.driver, name: draft.driver.name.trim(), phone: draft.driver.phone.trim() })
      await dataService.registerDriverProfile(user, driver)
      clearDraft('provider', identity.id)
      setSubmitted(true)
      await reloadSession()
    } catch (err) {
      setSubmitError((err as Error).message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (currentUser && !submitted) return <Navigate to="/home" replace />
  if (submitted) {
    return (
      <OnboardingLayout sidebarIntro={<p className="text-sm text-slate-600">Thank you for offering your time.</p>}>
        <StatusScreen
          icon={<CheckCircle2 className="h-7 w-7" />}
          tone="teal"
          title="Thanks for signing up to drive."
          actions={
            <Link to="/home" className={`${primaryButton} sm:self-start`}>
              Go to my dashboard <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          }
        >
          <p>The Relay Collective team will verify your details. You won't receive any ride requests until you're approved.</p>
          <p>Once approved, we'll send requests during the hours you picked. Change them anytime in Settings.</p>
        </StatusScreen>
      </OnboardingLayout>
    )
  }

  const d = draft.driver
  return (
    <OnboardingLayout progress={{ steps: STEPS, current: index, furthest, onSelect: go, disabled: busy }} help={step.help}>
      <OnboardingStep
        stepKey={step.id}
        label={`Step ${index + 1} of ${STEPS.length}`}
        title={step.heading}
        description={step.lead}
        direction={direction}
        onSubmit={next}
        onBack={index > 0 ? () => go(index - 1) : () => navigate(onboardingPaths.start)}
        backLabel={index > 0 ? 'Back' : 'Change path'}
        submitLabel={step.id === 'review' ? 'Submit for verification' : STEPS[index + 1]?.id === 'review' ? 'Review' : 'Continue'}
        busy={busy}
        busyLabel="Submitting…"
        error={submitError}
      >
        {step.id === 'about' && (
          <div className="space-y-6">
            <DriverAboutFields value={d} onChange={setDriver} errors={errors} />
            <fieldset>
              <legend className={labelClass}>How do you drive today?</legend>
              <div className="grid gap-2.5 sm:grid-cols-3">
                {BACKGROUNDS.map((b) => (
                  <label
                    key={b}
                    className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-semibold text-rc-navy transition has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rc-blue has-[:focus-visible]:ring-offset-2 ${
                      d.background === b ? 'border-rc-blue shadow-[0_0_0_1px_var(--color-rc-blue)]' : 'border-rc-line hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="background"
                      checked={d.background === b}
                      onChange={() => setDriver({ ...d, background: b })}
                      className="h-4 w-4 accent-[var(--color-rc-blue)]"
                    />
                    {BACKGROUND_LABELS[b]}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className={`${softPanel} text-sm text-slate-600`}>
              Representing a transportation company or a fleet? Contact Relay Collective and we'll set your organization up with you.
            </p>
          </div>
        )}
        {step.id === 'vehicle' && <DriverVehicleFields value={d} onChange={setDriver} errors={errors} />}
        {step.id === 'requests' && <DriverRequestFields value={d} onChange={setDriver} errors={errors} />}
        {step.id === 'review' && (
          <div className="space-y-4">
            <ReviewCard
              title="About you"
              onEdit={() => go(0)}
              rows={[
                ['Name', d.name],
                ['Phone', d.phone],
                ['Driving', BACKGROUND_LABELS[d.background]],
              ]}
            />
            <ReviewCard
              title="Vehicle and area"
              icon={<Car className="h-4 w-4 text-rc-teal-ink" aria-hidden />}
              onEdit={() => go(1)}
              rows={[
                ['Vehicle', d.vehicle],
                ['Spaces', `${d.seats}${d.wheelchairAccessible ? ', wheelchair accessible' : ''}`],
                ['Cities', d.serviceCities.join(', ')],
              ]}
            />
            <ReviewCard title="Availability" onEdit={() => go(2)} rows={[['Send requests', describeRequestHours(d.requestHours)]]} />
            <p className="flex items-start gap-2.5 rounded-xl bg-rc-navy p-4 text-sm text-white/85">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rc-cyan" aria-hidden />
              Every driver is verified by the Relay Collective team before receiving ride requests. We may ask for your driver's licence and, for taxi
              and rideshare drivers, your permit.
            </p>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rc-blue has-[:focus-visible]:ring-offset-2 ${
                errors.acknowledged ? 'border-red-300 bg-red-50/50' : 'border-rc-line'
              }`}
            >
              <input
                type="checkbox"
                checked={draft.acknowledged}
                onChange={(e) => {
                  setDraft((x) => ({ ...x, acknowledged: e.target.checked }))
                  setErrors({})
                }}
                aria-invalid={errors.acknowledged ? true : undefined}
                aria-describedby="ack-message"
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-rc-blue)]"
              />
              <span className="text-sm text-slate-700">I hold a valid driver's licence, and these details are accurate.</span>
            </label>
            <FieldMessage id="ack-message" error={errors.acknowledged} />
          </div>
        )}
      </OnboardingStep>
    </OnboardingLayout>
  )
}
