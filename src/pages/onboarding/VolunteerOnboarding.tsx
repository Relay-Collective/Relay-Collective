import { ArrowRight, CheckCircle2, Info, Pencil } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { StatusScreen } from '../../components/auth/StatusScreen'
import { focusRing } from '../../components/auth/styles'
import type { FieldErrors } from '../../components/driverDraft'
import { TextField } from '../../components/form/TextField'
import { OnboardingLayout } from '../../components/onboarding/OnboardingLayout'
import { OnboardingStep } from '../../components/onboarding/OnboardingStep'
import type { StepItem } from '../../components/onboarding/OnboardingStepper'
import { InterestIcon, InterestPicker } from '../../components/volunteer/InterestPicker'
import { primaryButton } from '../../components/ui'
import { useApp } from '../../hooks/useApp'
import { MAX_NAME, isPhone, tooLong } from '../../logic/validate'
import { clearDraft, loadDraft, saveDraft } from '../../onboarding/drafts'
import { focusFirstError } from '../../onboarding/focus'
import { onboardingPaths } from '../../onboarding/routing'
import { dataService } from '../../services'
import type { Identity, VolunteerInterest } from '../../types'
import { interestLabel, interestsError, normalizeInterests } from '../../volunteer/interests'

// Joining Relay Collective as a general volunteer: who you are, how you'd like to help, and a review.
// No vehicle, licence or verification: those belong to CareRide driving, which is a separate sign-up.
// The interests chosen here are descriptive only. They never open a service or make anyone a driver.

type StepId = 'about' | 'interests' | 'review'

interface VolunteerDraft {
  name: string
  phone: string
  interests: VolunteerInterest[]
}

function compact(errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
}

// The backend checks all of these again
const VALIDATE: Record<StepId, (d: VolunteerDraft) => FieldErrors> = {
  about: (d) =>
    compact({
      name: d.name.trim() ? tooLong(d.name, MAX_NAME) : 'Enter your full name.',
      phone: !d.phone.trim() || isPhone(d.phone) ? undefined : 'Enter a 10-digit phone number, or leave it blank.',
    }),
  interests: (d) => compact({ interests: interestsError(d.interests) }),
  review: () => ({}),
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
    description: 'Your name',
    heading: 'Join Relay Collective as a volunteer',
    lead: 'Share your interests and discover ways to contribute to your community.',
    help: <p>Your sign-in email is already on your account. A phone number is optional, and only the Relay Collective team sees it.</p>,
  },
  {
    id: 'interests',
    title: 'Interests',
    description: 'How you’d like to help',
    heading: 'How would you like to help?',
    lead: 'Pick everything that appeals to you. You can change these anytime.',
    help: <p>You don’t need a vehicle to volunteer. Transportation is just one of the ways to help.</p>,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Check and join',
    heading: 'Review your details.',
    lead: 'Check everything, then join.',
    help: <p>Your interests help us understand how you’d like to contribute. They don’t sign you up for anything.</p>,
  },
]

const STEP_IDS = STEPS.map((s) => s.id)

export function VolunteerOnboarding() {
  const { identity } = useApp()
  if (!identity) return null
  return <VolunteerFlow identity={identity} />
}

function VolunteerFlow({ identity }: { identity: Identity }) {
  const { currentUser, reloadSession } = useApp()
  const navigate = useNavigate()
  const [initial] = useState(() => {
    const saved = loadDraft<VolunteerDraft>('volunteer', identity.id, { name: identity.name, phone: '', interests: [] })
    const draft = { ...saved.value, interests: normalizeInterests(saved.value.interests ?? []) }
    return { draft, index: Math.max(0, STEP_IDS.indexOf(saved.step as StepId)) }
  })
  const [draft, setDraft] = useState<VolunteerDraft>(initial.draft)
  const [index, setIndex] = useState(initial.index)
  const [furthest, setFurthest] = useState(initial.index)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const [submitted, setSubmitted] = useState(false)
  const step = STEPS[index]

  useEffect(() => {
    if (!submitted) saveDraft('volunteer', identity.id, draft, step.id)
  }, [draft, step.id, identity.id, submitted])

  function change(patch: Partial<VolunteerDraft>) {
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
    const found = VALIDATE[step.id](draft)
    if (Object.keys(found).length) {
      setErrors(found)
      focusFirstError()
      return
    }
    if (step.id !== 'review') return go(index + 1)
    const invalid = STEPS.findIndex((s) => Object.keys(VALIDATE[s.id](draft)).length > 0)
    if (invalid >= 0) {
      go(invalid)
      setErrors(VALIDATE[STEPS[invalid].id](draft))
      return
    }
    setBusy(true)
    setSubmitError(undefined)
    try {
      await dataService.registerVolunteer({ name: draft.name.trim(), phone: draft.phone.trim() || undefined, interests: draft.interests })
      clearDraft('volunteer', identity.id)
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
          title="You're part of Relay Collective."
          actions={
            <Link to="/home" className={`${primaryButton} sm:self-start`}>
              Go to my volunteer home <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
          }
        >
          <p>Your volunteering interests have been saved. You can update them as your interests change.</p>
        </StatusScreen>
      </OnboardingLayout>
    )
  }

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
        submitLabel={step.id === 'review' ? 'Join as a volunteer' : STEPS[index + 1]?.id === 'review' ? 'Review' : 'Continue'}
        busy={busy}
        busyLabel="Joining…"
        error={submitError}
      >
        {step.id === 'about' && (
          <div className="space-y-5">
            <TextField
              id="volunteer-name"
              label="Full name"
              autoComplete="name"
              value={draft.name}
              maxLength={MAX_NAME}
              onChange={(e) => change({ name: e.target.value })}
              error={errors.name}
            />
            <TextField
              id="volunteer-phone"
              label="Mobile phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              optional
              hint="Only if you'd like the Relay Collective team to be able to call you."
              value={draft.phone}
              onChange={(e) => change({ phone: e.target.value })}
              error={errors.phone}
            />
            <TextField
              id="volunteer-email"
              label="Email"
              value={identity.email}
              readOnly
              disabled
              hint="From your sign-in. It isn't shown to organizations."
            />
          </div>
        )}
        {step.id === 'interests' && (
          <InterestPicker value={draft.interests} onChange={(interests) => change({ interests })} error={errors.interests} showLegend={false} />
        )}
        {step.id === 'review' && (
          <div className="space-y-4">
            <ReviewCard
              title="About you"
              onEdit={() => go(0)}
              rows={[
                ['Name', draft.name.trim()],
                ['Phone', draft.phone.trim() || 'Not shared'],
                ['Email', identity.email],
              ]}
            />
            <section className="rounded-xl border border-rc-line bg-white" aria-labelledby="review-interests-title">
              <div className="flex items-center justify-between gap-3 border-b border-rc-line px-5 py-3">
                <h2 id="review-interests-title" className="font-heading text-base font-bold text-rc-navy">
                  Volunteering interests
                </h2>
                <EditButton title="Volunteering interests" onEdit={() => go(1)} />
              </div>
              <ul className="flex flex-wrap gap-2 px-5 py-4" aria-label="Your volunteering interests">
                {draft.interests.map((id) => (
                  <li key={id} className="inline-flex items-center gap-1.5 rounded-full bg-rc-canvas px-3 py-1.5 text-sm font-semibold text-rc-navy">
                    <InterestIcon interest={id} className="h-4 w-4 text-rc-teal-ink" /> {interestLabel(id)}
                  </li>
                ))}
              </ul>
            </section>
            <p className="flex items-start gap-2.5 rounded-xl bg-rc-navy p-4 text-sm text-white/85">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-rc-cyan" aria-hidden />
              <span>
                Choosing an interest doesn’t guarantee an opportunity is available. Today, Relay Collective runs one service, CareRide
                (transportation).
                {draft.interests.includes('TRANSPORTATION') &&
                  ' Driving for CareRide is a separate enrollment, verified by the Relay Collective team.'}
              </span>
            </p>
          </div>
        )}
      </OnboardingStep>
    </OnboardingLayout>
  )
}

function EditButton({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-rc-blue hover:bg-brand-50 ${focusRing}`}
      aria-label={`Edit ${title.toLowerCase()}`}
    >
      <Pencil className="h-4 w-4" aria-hidden /> Edit
    </button>
  )
}

function ReviewCard({ title, onEdit, rows }: { title: string; onEdit: () => void; rows: [string, string][] }) {
  return (
    <section className="rounded-xl border border-rc-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-rc-line px-5 py-3">
        <h2 className="font-heading text-base font-bold text-rc-navy">{title}</h2>
        <EditButton title={title} onEdit={onEdit} />
      </div>
      <dl className="grid gap-x-6 gap-y-2.5 px-5 py-4 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium text-rc-navy">{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
