import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import type { FieldErrors } from '../../../components/driverDraft'
import { OnboardingLayout } from '../../../components/onboarding/OnboardingLayout'
import { OnboardingStep } from '../../../components/onboarding/OnboardingStep'
import type { StepItem } from '../../../components/onboarding/OnboardingStepper'
import { useApp } from '../../../hooks/useApp'
import { clearDraft, loadDraft, saveDraft } from '../../../onboarding/drafts'
import { focusFirstError } from '../../../onboarding/focus'
import {
  emptyOrganizationDraft,
  toApplication,
  validateContact,
  validateIdentity,
  validateInterests,
  validateReview,
  validateServices,
  type OrganizationDraft,
} from '../../../onboarding/organizationDraft'
import { onboardingPaths } from '../../../onboarding/routing'
import { dataService } from '../../../services'
import type { Identity } from '../../../types'
import { ContactStep, IdentityStep, InterestsStep, ReviewStep, ServicesStep, type StepProps } from './steps'
import { Submitted } from './Submitted'

type StepId = 'identity' | 'contact' | 'services' | 'interests' | 'review'

interface StepDef extends StepItem {
  id: StepId
  heading: string
  lead: string
  help: ReactNode
  Component: (p: StepProps) => ReactNode
  validate: (d: OrganizationDraft) => FieldErrors
}

const STEPS: StepDef[] = [
  {
    id: 'identity',
    title: 'Organization',
    description: 'Name, type, and location',
    heading: 'Tell us about your organization.',
    lead: 'The basics our team needs to recognise your organization.',
    help: <p>Use your organization's public name. If you work from several sites, start with the main one; more locations can come later.</p>,
    Component: IdentityStep,
    validate: validateIdentity,
  },
  {
    id: 'contact',
    title: 'Contact',
    description: 'Who we can reach',
    heading: 'How can we reach your organization?',
    lead: 'The person our team should contact about this application.',
    help: <p>Contact details stay with your organization and Relay Collective administrators. Drivers only see your location's phone number.</p>,
    Component: ContactStep,
    validate: validateContact,
  },
  {
    id: 'services',
    title: 'Community services',
    description: 'The work you do',
    heading: 'What kind of work does your organization do?',
    lead: 'This helps us understand your community and connect you with the right partners.',
    help: <p>These describe your organization. They don't unlock or limit anything.</p>,
    Component: ServicesStep,
    validate: validateServices,
  },
  {
    id: 'interests',
    title: 'Platform interests',
    description: 'How we could help',
    heading: 'How could Relay Collective support your work?',
    lead: 'Transportation is available today. Tell us what else would help as the platform grows.',
    help: <p>Planned capabilities aren't available yet. Choosing one doesn't sign you up for anything.</p>,
    Component: InterestsStep,
    validate: validateInterests,
  },
  {
    id: 'review',
    title: 'Review',
    description: 'Check and submit',
    heading: 'Review your organization details.',
    lead: 'Make sure everything is right. You can edit any section before you submit.',
    help: <p>Applications are reviewed by the Relay Collective team. We'll contact you at the email you gave if we have questions.</p>,
    Component: ReviewStep,
    validate: validateReview,
  },
]

const STEP_IDS = STEPS.map((s) => s.id)

export function OrganizationOnboarding() {
  const { identity } = useApp()
  if (!identity) return null
  return <OrganizationFlow identity={identity} />
}

function OrganizationFlow({ identity }: { identity: Identity }) {
  const { currentUser, reloadSession } = useApp()
  const navigate = useNavigate()
  const [initial] = useState(() => {
    const saved = loadDraft('organization', identity.id, emptyOrganizationDraft(identity))
    const index = Math.max(0, STEP_IDS.indexOf(saved.step as StepId))
    return { draft: { ...saved.value, acknowledged: false }, index }
  })
  const [draft, setDraft] = useState<OrganizationDraft>(initial.draft)
  const [index, setIndex] = useState(initial.index)
  const [furthest, setFurthest] = useState(initial.index)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const [submitted, setSubmitted] = useState(false)

  const step = STEPS[index]

  useEffect(() => {
    if (submitted) return
    // The acknowledgement is asked fresh each time; everything else carries over a refresh
    saveDraft('organization', identity.id, { ...draft, acknowledged: false }, step.id)
  }, [draft, step.id, identity.id, submitted])

  function update(patch: Partial<OrganizationDraft>) {
    setDraft((d) => ({ ...d, ...patch }))
    // Clear the message for whatever is being fixed (picking an address fixes the address field)
    const fixed = new Set(Object.keys(patch).map((k) => (k === 'placeId' ? 'address' : k)))
    setErrors((e) => Object.fromEntries(Object.entries(e).filter(([k]) => !fixed.has(k))))
    setSubmitError(undefined)
  }

  function go(to: number) {
    if (to < 0 || to >= STEPS.length || busy) return
    setDirection(to < index ? 'back' : 'forward')
    setErrors({})
    setIndex(to)
    setFurthest((f) => Math.max(f, to))
  }

  // Earlier steps may have been left invalid (e.g. an address cleared on a later visit): send them back there
  function firstInvalidStep(): number {
    return STEPS.findIndex((s) => Object.keys(s.validate(draft)).length > 0)
  }

  async function next() {
    const found = step.validate(draft)
    if (Object.keys(found).length) {
      setErrors(found)
      focusFirstError()
      return
    }
    if (step.id !== 'review') return go(index + 1)

    const invalid = firstInvalidStep()
    if (invalid >= 0 && invalid < index) {
      go(invalid)
      setErrors(STEPS[invalid].validate(draft))
      focusFirstError()
      return
    }

    setBusy(true)
    setSubmitError(undefined)
    try {
      // The backend returns the existing application if this was already submitted (a retry, a second tab)
      await dataService.submitOrganizationApplication(toApplication(draft))
      clearDraft('organization', identity.id)
      setSubmitted(true)
      await reloadSession()
    } catch (err) {
      setSubmitError((err as Error).message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  // Already has a role (e.g. submitted in another tab): nothing to register here
  if (currentUser && !submitted) return <Navigate to="/home" replace />
  if (submitted) return <Submitted orgName={draft.orgName.trim()} contactEmail={draft.contactEmail.trim()} />

  const { Component } = step
  return (
    <OnboardingLayout
      progress={{ steps: STEPS, current: index, furthest, onSelect: go, disabled: busy }}
      help={step.help}
    >
      <OnboardingStep
        stepKey={step.id}
        label={`Step ${index + 1} of ${STEPS.length}`}
        title={step.heading}
        description={step.lead}
        direction={direction}
        onSubmit={next}
        onBack={index > 0 ? () => go(index - 1) : () => navigate(onboardingPaths.start)}
        backLabel={index > 0 ? 'Back' : 'Change path'}
        submitLabel={step.id === 'review' ? 'Submit application' : STEPS[index + 1]?.id === 'review' ? 'Review' : 'Continue'}
        busy={busy}
        busyLabel="Submitting…"
        error={submitError}
      >
        <Component draft={draft} update={update} errors={errors} goTo={(id) => go(STEP_IDS.indexOf(id as StepId))} />
      </OnboardingStep>
    </OnboardingLayout>
  )
}
