import { ArrowRight, BadgeCheck, CalendarClock, Car, CheckCircle2, MapPin, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { DetailList } from '../../components/admin/controls'
import { StatusScreen } from '../../components/auth/StatusScreen'
import { DriverCityFields, DriverRequestFields, DriverVehicleFields } from '../../components/DriverFields'
import { driverAreaErrors, driverRequestErrors, driverVehicleErrors, emptyDriverDraft, type DriverDraft, type FieldErrors } from '../../components/driverDraft'
import { FieldMessage } from '../../components/form/FieldMessage'
import { TextField } from '../../components/form/TextField'
import { OnboardingStep } from '../../components/onboarding/OnboardingStep'
import { OnboardingStepper, type StepItem } from '../../components/onboarding/OnboardingStepper'
import { ReviewCard } from '../../components/onboarding/ReviewCard'
import { primaryButton, secondaryButton } from '../../components/ui'
import { panel } from '../../components/workspace/styles'
import { useApp } from '../../hooks/useApp'
import { CareRideMark } from '../../modules/careride/brand'
import { describeRequestHours } from '../../logic/requestHours'
import { clearDraft, hasDraft, loadDraft, saveDraft } from '../../onboarding/drafts'
import { focusFirstError } from '../../onboarding/focus'
import type { CareRideEnrollmentResult } from '../../services/dataService'
import { dataService } from '../../services'
import type { Identity, User } from '../../types'
import { canApplyToCareRide, emptyCareRideDraft, enrollmentPhoneErrors, needsPhone, toApplication, type CareRideDraft } from '../../volunteer/enrollment'
import { volunteerPaths as paths } from '../../volunteer/paths'

// A general volunteer applies to drive with CareRide, inside their own workspace and on the same account: no new
// sign-up, no email or password again. It reuses driver onboarding's fields and rules (DriverFields, driverDraft).
// Submitting creates a PENDING driver profile only; the Relay Collective team decides who drives.

type StepId = 'intro' | 'about' | 'vehicle' | 'area' | 'availability' | 'review'

interface StepDef extends StepItem {
  id: StepId
  heading: string
  lead: string
  help: ReactNode
}

const STEPS: StepDef[] = [
  {
    id: 'intro',
    title: 'About CareRide',
    description: 'What driving involves',
    heading: 'Drive with CareRide.',
    lead: 'Volunteer drivers help community members reach medical appointments, housing services, and other important places.',
    help: <p>Applying is optional. Your volunteer profile and interests stay exactly as they are, whatever you decide.</p>,
  },
  {
    id: 'about',
    title: 'Your details',
    description: 'From your account',
    heading: 'Confirm your details.',
    lead: 'We use the details already on your Relay Collective account. There’s no new account to create.',
    help: <p>Your first name and phone number are shared only with the organization whose ride you accept, so they can reach you at pickup.</p>,
  },
  {
    id: 'vehicle',
    title: 'Vehicle',
    description: 'What you drive',
    heading: 'Tell us about your vehicle.',
    lead: 'We only send you rides your vehicle can take.',
    help: <p>Accessibility matters: tell us if your vehicle takes a wheelchair, so riders who need it are matched with you.</p>,
  },
  {
    id: 'area',
    title: 'Service area',
    description: 'Where you can drive',
    heading: 'Where can you drive?',
    lead: 'Pick the cities where you’re happy to start rides.',
    help: <p>You can change your cities later from your CareRide availability.</p>,
  },
  {
    id: 'availability',
    title: 'Driving availability',
    description: 'When to send requests',
    heading: 'When should we send you ride requests?',
    lead: 'Pick the times you’re happy to hear about rides. This is only for driving, and you still choose which rides to take.',
    help: <p>Requests are never a commitment. Decline anything that doesn't suit you, no questions asked.</p>,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Check and submit',
    heading: 'Review your application.',
    lead: 'Check everything, then submit it for verification.',
    help: <p>Our team verifies every driver before any ride requests are sent. We may contact you for your licence or other documents.</p>,
  },
]

const STEP_IDS = STEPS.map((s) => s.id)

export function CareRideApplication() {
  const { identity, currentUser } = useApp()
  if (!identity || !currentUser) return null
  return <ApplicationFlow identity={identity} user={currentUser} />
}

function ApplicationFlow({ identity, user }: { identity: Identity; user: User }) {
  const { reloadSession } = useApp()
  const navigate = useNavigate()
  // Decided once, from the account as it was when the application opened, so it can't change under the form
  const [phoneRequired] = useState(() => needsPhone(user))
  const [initial] = useState(() => {
    const saved = loadDraft('careride', identity.id, emptyCareRideDraft)
    return { draft: { ...saved.value, acknowledged: false }, index: Math.max(0, STEP_IDS.indexOf(saved.step as StepId)) }
  })
  const [draft, setDraft] = useState<CareRideDraft>(initial.draft)
  const [index, setIndex] = useState(initial.index)
  const [furthest, setFurthest] = useState(initial.index)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const [result, setResult] = useState<CareRideEnrollmentResult>()
  const step = STEPS[index]
  const eligible = canApplyToCareRide(user)

  // Only while the application can still be sent. Once it has been, or the account is already enrolled, a draft
  // would be stale, so it's removed and never saved again.
  // Reading the introduction isn't starting an application, so nothing is saved until the first real step.
  useEffect(() => {
    if (result || !eligible) clearDraft('careride', identity.id)
    else if (step.id !== 'intro' || hasDraft('careride', identity.id)) saveDraft('careride', identity.id, { ...draft, acknowledged: false }, step.id)
  }, [draft, step.id, identity.id, result, eligible])

  const validate: Record<StepId, (d: CareRideDraft) => FieldErrors> = {
    intro: () => ({}),
    about: (d) => enrollmentPhoneErrors(d, phoneRequired),
    vehicle: driverVehicleErrors,
    area: driverAreaErrors,
    availability: driverRequestErrors,
    review: (d) => (d.acknowledged ? {} : { acknowledged: 'Please confirm to submit.' }),
  }

  function change(patch: Partial<CareRideDraft>) {
    setDraft((d) => ({ ...d, ...patch }))
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
    const found = validate[step.id](draft)
    if (Object.keys(found).length) {
      setErrors(found)
      focusFirstError()
      return
    }
    if (step.id !== 'review') return go(index + 1)
    const invalid = STEPS.findIndex((s) => s.id !== 'review' && Object.keys(validate[s.id](draft)).length > 0)
    if (invalid >= 0) {
      go(invalid)
      setErrors(validate[STEPS[invalid].id](draft))
      return
    }
    setBusy(true)
    setSubmitError(undefined)
    try {
      // Only "submitted" once the backend says so. On any failure the draft stays, so nothing typed is lost.
      const sent = await dataService.applyToCareRide(toApplication(draft, phoneRequired))
      setResult(sent)
      await reloadSession() // the same account, now enrolled: the workspace becomes the CareRide one
    } catch (err) {
      setSubmitError((err as Error).message || 'We couldn’t submit your application. Nothing was sent, so please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (result) return <Submitted result={result} />
  // Already enrolled, or not a general volunteer: there's nothing to apply for here
  if (!eligible) return <Navigate to={paths.overview} replace />

  // The driver fields work on a whole driver draft; only the fields for each step are read back
  const fields: DriverDraft = { ...emptyDriverDraft, ...draft, background: 'INDEPENDENT', name: user.name, phone: draft.phone }
  const phone = phoneRequired ? draft.phone.trim() : user.phone

  return (
    <div className="grid grid-cols-1 gap-6 pb-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-start">
      <aside className="hidden space-y-6 lg:block" aria-label="Application progress">
        <div className={`${panel} p-5`}>
          <p className="mb-5 flex items-center gap-2 font-heading text-base font-bold text-rc-navy">
            <CareRideMark tone="brand" className="h-6 w-6" /> CareRide application
          </p>
          <OnboardingStepper steps={STEPS} current={index} furthest={furthest} onSelect={go} disabled={busy} />
        </div>
        <div className="px-1 text-sm text-slate-600">{step.help}</div>
      </aside>

      <div className={`${panel} px-5 py-8 sm:px-10 sm:py-10`}>
        <OnboardingStep
          stepKey={step.id}
          label={`Step ${index + 1} of ${STEPS.length}`}
          title={step.heading}
          description={step.lead}
          direction={direction}
          onSubmit={next}
          onBack={index > 0 ? () => go(index - 1) : () => navigate(paths.overview)}
          backLabel={index > 0 ? 'Back' : 'Back to overview'}
          submitLabel={step.id === 'intro' ? 'Start application' : step.id === 'review' ? 'Submit application' : STEPS[index + 1]?.id === 'review' ? 'Review' : 'Continue'}
          busy={busy}
          busyLabel="Submitting…"
          error={submitError}
        >
          {step.id === 'intro' && <Introduction />}

          {step.id === 'about' && (
            <div className="space-y-5">
              <section aria-labelledby="account-title" className="rounded-xl border border-rc-line">
                <h2 id="account-title" className="flex items-center gap-2 border-b border-rc-line px-5 py-3 font-heading text-base font-bold text-rc-navy">
                  <UserRound className="h-4 w-4 text-rc-blue" aria-hidden /> Your Relay Collective account
                </h2>
                <DetailList
                  rows={[
                    ['Name', user.name],
                    ['Email', user.email ?? '—'],
                    ...(phoneRequired ? [] : ([['Mobile phone', user.phone]] as [string, string][])),
                  ]}
                />
              </section>
              {phoneRequired && (
                <TextField
                  id="careride-phone"
                  label="Mobile phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="604-555-0123"
                  hint="Drivers need one, so the organization can reach you at pickup. It’s saved to your account."
                  value={draft.phone}
                  error={errors.phone}
                  onChange={(e) => change({ phone: e.target.value })}
                />
              )}
              <p className="text-sm text-slate-500">To change your name{phoneRequired ? '' : ' or phone number'}, contact the Relay Collective team.</p>
            </div>
          )}

          {step.id === 'vehicle' && (
            <DriverVehicleFields
              value={fields}
              onChange={({ vehicle, seats, wheelchairAccessible }) => change({ vehicle, seats, wheelchairAccessible })}
              errors={errors}
              showCities={false}
            />
          )}
          {step.id === 'area' && <DriverCityFields value={fields} onChange={({ serviceCities }) => change({ serviceCities })} errors={errors} />}
          {step.id === 'availability' && <DriverRequestFields value={fields} onChange={({ requestHours }) => change({ requestHours })} errors={errors} />}

          {step.id === 'review' && (
            <div className="space-y-4">
              <ReviewCard
                title="Your details"
                icon={<UserRound className="h-4 w-4 text-rc-blue" aria-hidden />}
                onEdit={phoneRequired ? () => go(1) : undefined}
                rows={[
                  ['Name', user.name],
                  ['Email', user.email ?? ''],
                  ['Phone', phone],
                ]}
              />
              <ReviewCard
                title="Vehicle"
                icon={<Car className="h-4 w-4 text-rc-teal-ink" aria-hidden />}
                onEdit={() => go(2)}
                rows={[
                  ['Vehicle', draft.vehicle.trim()],
                  ['Spaces', `${draft.seats}${draft.wheelchairAccessible ? ', wheelchair accessible' : ''}`],
                ]}
              />
              <ReviewCard
                title="Service area"
                icon={<MapPin className="h-4 w-4 text-rc-teal-ink" aria-hidden />}
                onEdit={() => go(3)}
                rows={[['Cities', draft.serviceCities.join(', ')]]}
              />
              <ReviewCard
                title="Driving availability"
                icon={<CalendarClock className="h-4 w-4 text-rc-teal-ink" aria-hidden />}
                onEdit={() => go(4)}
                rows={[['Send requests', describeRequestHours(draft.requestHours)]]}
              />
              <p className="flex items-start gap-2.5 rounded-xl bg-rc-navy p-4 text-sm text-white/85">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-rc-cyan" aria-hidden />
                Every driver is verified by the Relay Collective team before receiving ride requests. Submitting doesn’t approve you to drive. We may ask for your
                driver's licence.
              </p>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-rc-blue has-[:focus-visible]:ring-offset-2 ${
                  errors.acknowledged ? 'border-red-300 bg-red-50/50' : 'border-rc-line'
                }`}
              >
                <input
                  type="checkbox"
                  checked={draft.acknowledged}
                  onChange={(e) => change({ acknowledged: e.target.checked })}
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
      </div>
    </div>
  )
}

const INTRO_POINTS = [
  { icon: Car, title: 'What drivers do', text: 'Take community members to appointments and services, in your own vehicle, when it suits you. You choose which rides to accept.' },
  {
    icon: ShieldCheck,
    title: 'Verification comes first',
    text: 'The Relay Collective team reviews every application and may ask for your driver’s licence. Submitting doesn’t approve you to drive.',
  },
  {
    icon: BadgeCheck,
    title: 'Your volunteering stays the same',
    text: 'It’s the same account. Your profile and volunteering interests stay as they are, whether or not you’re approved.',
  },
]

function Introduction() {
  return (
    <ul className="space-y-3">
      {INTRO_POINTS.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex items-start gap-4 rounded-xl border border-rc-line p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-rc-blue" aria-hidden>
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold text-rc-navy">{title}</span>
            <span className="mt-0.5 block text-sm text-slate-600">{text}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

// Shown only once the backend confirmed the application. A repeat (a second tab, a double tap) says so honestly.
function Submitted({ result }: { result: CareRideEnrollmentResult }) {
  return (
    <div className={`${panel} mx-auto max-w-2xl px-6 py-10 sm:px-10`}>
      <StatusScreen
        icon={<CheckCircle2 className="h-7 w-7" />}
        tone="teal"
        title={result.created ? 'Your CareRide application has been submitted.' : 'You’ve already applied to drive with CareRide.'}
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to={paths.overview} className={primaryButton}>
              Go to my overview <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <Link to={paths.verification} className={secondaryButton}>
              View application status
            </Link>
          </div>
        }
      >
        <p>Our team will review your driver information. You can continue using Relay Collective while your application is being reviewed.</p>
        <p>You won’t receive any ride requests until you’re approved. Your volunteer profile and interests haven’t changed.</p>
      </StatusScreen>
    </div>
  )
}
