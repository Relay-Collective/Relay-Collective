import {
  Accessibility,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  CircleCheck,
  Clock,
  DoorOpen,
  HandHelping,
  History,
  LoaderCircle,
  TriangleAlert,
  User as UserIcon,
  Zap,
} from 'lucide-react'
import { useEffect, useRef, useState, type FocusEvent, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DestinationPicker, FixedRoute } from '../components/booking/DestinationPicker'
import { FormSection } from '../components/booking/FormSection'
import { MatchLine } from '../components/booking/MatchLine'
import { OptionTile } from '../components/booking/OptionTile'
import { PassengerStepper } from '../components/booking/PassengerStepper'
import { PickupTimePicker } from '../components/booking/PickupTimePicker'
import { TripSummary } from '../components/booking/TripSummary'
import { FieldMessage } from '../../../components/form/FieldMessage'
import { RequiredMark } from '../../../components/form/RequiredMark'
import { TextField } from '../../../components/form/TextField'
import { card, ghostButton, input, label, primaryButton } from '../../../components/ui'
import { DEMO_FRAME_USER } from '../../../context/demoFrame'
import { useApp } from '../../../hooks/useApp'
import { useData } from '../../../hooks/useData'
import { useHospitalWaitTimes } from '../hooks/useHospitalWaitTimes'
import { maxPassengers } from '../../../logic/capacity'
import { ON_DEMAND_GIVE_UP_MINUTES } from '../../../logic/dispatch'
import {
  blankForm,
  bookingMode,
  CUSTOM,
  EDITABLE,
  firstProblem,
  initialForm,
  isReturnTrip,
  isUntouched,
  missingItems,
  parseDraft,
  rideDetails,
  sectionsDone,
  validate,
  type Errors,
  type Field,
  type FormState,
  type Mode,
} from '../logic/bookingForm'
import { previewDriverMatch, type MatchCheck, type MatchPreview } from '../logic/driverMatchPreview'
import { estimateFare } from '../../../logic/estimateFare'
import { matchWaitTime, waitNote, waitSummary } from '../logic/hospitalWaitTimes'
import { houseAddress } from '../../../logic/maps'
import { describePickup, parseLocalInput, quickPicks } from '../logic/pickupTime'
import { frequentDestinations, sortByPopularity } from '../logic/popularDestinations'
import { passengersLabel, riderLabel } from '../logic/rideText'
import { MAX_NAME, MAX_NOTE, tooLong } from '../../../logic/validate'
import { dataService } from '../../../services'
import type { House, Ride, User } from '../../../types'
import { careRidePaths as paths } from '../paths'

// The booking sheet and the summary: one white surface each, no nested frames
const sheet = 'rounded-2xl border border-slate-200/80 bg-white shadow-[var(--shadow-rest)]'
const focusRing = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-500 focus-visible:ring-offset-2'

// Where each checked field lives, so a failed send (or a "still needed" link) goes straight to it.
const FIELD_TARGETS: Record<Field, { section: string; focus: string }> = {
  destination: { section: 'where', focus: '#destination-search' },
  customAddress: { section: 'where', focus: '#custom-address' },
  pickupTime: { section: 'when', focus: '#pickup-time' },
  passengers: { section: 'who', focus: '#passengers-label' },
  riderNames: { section: 'who', focus: '#rider-name-0' },
  pickupInstructions: { section: 'extras', focus: '#instructions' },
  notes: { section: 'extras', focus: '#notes' },
}

// Read the clock outside render, e.g. when the form is sent
const clock = () => Date.now()

function scrollBehavior(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
}

// After the next paint, so a part that opens to show its problem (the calendar, the notes) is there to focus
function jumpTo(field: Field) {
  requestAnimationFrame(() => {
    const { section, focus } = FIELD_TARGETS[field]
    document.getElementById(section)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    const target = document.querySelector<HTMLElement>(focus) ?? document.querySelector<HTMLElement>(`#${section} input, #${section} button`)
    target?.focus({ preventScroll: true })
  })
}

// ---- Unfinished bookings survive the back button, a refresh, or closing the tab

const draftKey = (userId: string) => `careride-ride-draft:${userId}`

function readDraft(userId: string): Partial<FormState> | undefined {
  try {
    return parseDraft(localStorage.getItem(draftKey(userId)))
  } catch {
    return undefined
  }
}

function saveDraft(userId: string, form: FormState): void {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify(form))
  } catch {
    // Ignore: the draft just won't survive leaving the page
  }
}

function clearDraft(userId: string): void {
  try {
    localStorage.removeItem(draftKey(userId))
  } catch {
    // Ignore
  }
}

// A text box that brings up the on-screen keyboard
function isTextEntry(el: EventTarget): boolean {
  return el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['radio', 'checkbox', 'button', 'submit'].includes(el.type))
}

// One-way trip. ?returnOf=<id> books the trip back, ?edit=<id> changes a booked ride,
// and ?again=<id> starts a new booking from an old one.
export function RequestRide() {
  const { currentUser } = useApp()
  const [params] = useSearchParams()
  const returnOf = params.get('returnOf') ?? ''
  const editId = params.get('edit') ?? ''
  const againId = params.get('again') ?? ''
  const mode: Mode = bookingMode({ edit: editId, returnOf, again: againId })
  const sourceId = editId || returnOf || againId

  const houses = useData(() => dataService.listHouses(currentUser?.orgId), currentUser?.orgId)
  // null once we know there's no such ride, so it isn't mistaken for still loading
  const source = useData(() => (sourceId ? dataService.getRide(sourceId).then((r) => r ?? null) : Promise.resolve(null)), sourceId)

  if (!currentUser || !houses || source === undefined) return null
  const house = houses.find((h) => h.id === currentUser.houseId)
  if (!house) return <p>This account has no pickup address. Ask the Relay Collective team to add one.</p>
  if (sourceId && !source) {
    return (
      <p>
        We couldn't find that ride.{' '}
        <Link to={paths.transport} className="font-semibold text-brand-700 underline underline-offset-2">
          Back to your rides
        </Link>
      </p>
    )
  }
  if (mode === 'edit' && source && !EDITABLE.includes(source.status)) {
    return (
      <div className={`${card} max-w-xl`}>
        <h1 className="text-2xl font-bold">This ride can't be changed anymore</h1>
        <p className="mt-2 text-slate-600">
          {source.status === 'PICKED_UP' ? 'The client is already in the car.' : 'It has already finished or been cancelled.'}
        </p>
        <Link to={paths.ride(source.id)} className={`${primaryButton} mt-5`}>
          Back to the ride
        </Link>
      </div>
    )
  }

  // A fresh form whenever the kind of booking changes
  return <RideForm key={`${mode}:${sourceId}`} mode={mode} source={source ?? undefined} house={house} user={currentUser} />
}

function InlineMatchHint({ match, checks }: { match?: MatchPreview; checks: MatchCheck[] }) {
  if (!match || match.count > 0 || !match.check || !checks.includes(match.check)) return null
  return (
    <p role="status" className="mt-4 flex gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
      <span>
        <strong className="font-semibold">Heads up:</strong> {match.reason}
      </span>
    </p>
  )
}

// One half of the "when" switch. A real radio, styled as a segment.
function WhenOption({ checked, onChange, title, description, icon }: { checked: boolean; onChange: () => void; title: string; description: string; icon: ReactNode }) {
  return (
    <label
      className={`flex min-h-14 cursor-pointer select-none items-center gap-2.5 rounded-xl px-3 py-2 transition duration-150 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand-500 ${
        checked ? 'bg-white text-ink shadow-[var(--shadow-rest)] ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white/60 hover:text-ink'
      }`}
    >
      <input type="radio" name="when" checked={checked} onChange={onChange} className="sr-only" />
      <span className={`shrink-0 ${checked ? 'text-brand-600' : 'text-slate-500'}`} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight sm:text-base">{title}</span>
        <span className="hidden text-sm text-slate-600 sm:block">{description}</span>
      </span>
    </label>
  )
}

interface FormProps {
  mode: Mode
  source?: Ride
  house: House
  user: User
}

function RideForm({ mode, source, house, user }: FormProps) {
  const { refresh } = useApp()
  const navigate = useNavigate()
  const ridesForHouse = useData(() => dataService.listRidesForHouse(house.id), house.id)
  const destinations = useData(() => dataService.listDestinations(user.orgId), user.orgId)
  // Anonymous eligibility only: enough to say how many drivers could take the ride, not who
  const drivers = useData(() => dataService.listDriverPool())
  const waits = useHospitalWaitTimes()
  const pastRides = ridesForHouse ?? []
  // Places stay "loading" until past rides are in too, so the frequent list doesn't jump in afterwards
  const places = destinations && ridesForHouse ? destinations : undefined
  const sorted = sortByPopularity(places ?? [], pastRides, house.id)
  const frequent = frequentDestinations(places ?? [], pastRides, house.id)

  // When the form was opened. The default pickup times are based on it.
  const [openedAt] = useState(() => Date.now())
  const picks = quickPicks(openedAt)
  const [initial] = useState(() => initialForm(mode, source, mode === 'new' ? readDraft(user.id) : undefined, openedAt))
  const [form, setForm] = useState<FormState>(initial.form)
  const [restored, setRestored] = useState(initial.restored && !DEMO_FRAME_USER) // the /demo deck fills the form on purpose
  // Errors stay hidden until the first send, then update live as staff fix them.
  const [showErrors, setShowErrors] = useState(false)
  // The clock pickup times are checked against. Ticks every half minute so past times drop off the picker.
  const [now, setNow] = useState(openedAt)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  // The full calendar opens on request, or straight away for a time that isn't one of the quick picks
  const [moreTimes, setMoreTimes] = useState(() => initial.form.type === 'SCHEDULED' && !picks.some((p) => p.value === initial.form.pickupTime))
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [typing, setTyping] = useState(false) // the on-screen keyboard is likely up
  const errorRef = useRef<HTMLParagraphElement>(null)
  // One id per booking attempt, kept across retries, so a lost response can't book the ride twice
  const requestId = useRef(crypto.randomUUID())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (mode !== 'new') return
    if (isUntouched(form, openedAt)) clearDraft(user.id)
    else saveDraft(user.id, form)
  }, [mode, user.id, form, openedAt])

  const isReturn = isReturnTrip(mode, source)
  const maxRiders = drivers ? maxPassengers(drivers) : form.passengers
  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  function setPassengers(passengers: number) {
    setForm((f) => ({ ...f, passengers, riderNames: Array.from({ length: passengers }, (_, i) => f.riderNames[i] ?? '') }))
  }

  function startOver() {
    clearDraft(user.id)
    const blank = blankForm(Date.now())
    setForm(blank)
    setMoreTimes(false)
    setRestored(false)
    setShowErrors(false)
  }

  const pickupMs = parseLocalInput(form.pickupTime)
  const pickupValid = !Number.isNaN(pickupMs)
  const saved = places?.find((d) => d.id === form.destinationId)

  function check(at: number): Errors {
    const found = validate(form, { isReturn, maxRiders, at })
    // A saved place that has since been removed can't be booked to
    if (!isReturn && places && form.destinationId && form.destinationId !== CUSTOM && !saved) {
      return { destination: 'Choose where the client is going.', ...found }
    }
    return found
  }

  const errors = check(now)
  const shown = showErrors ? errors : {}
  const done = sectionsDone(errors)
  const missing = missingItems(errors)
  const ready = missing.length === 0

  // Whether any driver could take this ride, shown while filling in the form so staff aren't surprised.
  const pickupIso = form.type === 'ON_DEMAND' ? new Date(now).toISOString() : pickupValid ? new Date(pickupMs).toISOString() : ''
  const match =
    drivers && pickupIso
      ? previewDriverMatch(
          {
            type: form.type,
            pickupTime: pickupIso,
            passengers: form.passengers,
            needsWheelchair: form.needsWheelchair,
            preferredDriverId: mode === 'return' ? source?.driverId : undefined,
          },
          house,
          drivers,
        )
      : undefined

  const waitFor = (name: string, address?: string) => {
    const wait = matchWaitTime(name, address, waits)
    return wait ? waitNote(wait) : undefined
  }
  const anyWaits = sorted.some((d) => matchWaitTime(d.name, d.address, waits))
  const chosenWait = isReturn
    ? undefined
    : saved
      ? matchWaitTime(saved.name, saved.address, waits)
      : form.destinationId === CUSTOM
        ? matchWaitTime(form.customName || form.customAddress, form.customAddress, waits)
        : undefined

  // A return trip goes from where the outbound one went, back to the partner's address
  const returnFrom =
    mode === 'return' && source
      ? { name: source.destinationName, detail: source.destinationAddress }
      : mode === 'edit' && source?.returnOfRideId
        ? { name: source.pickupAddress, detail: undefined }
        : undefined
  const from = returnFrom ?? { name: house.name, detail: house.address }
  const to = isReturn
    ? { name: house.name, detail: house.address }
    : saved
      ? { name: saved.name, detail: saved.address }
      : form.destinationId === CUSTOM && form.customPicked
        ? { name: form.customName || form.customAddress, detail: form.customName ? form.customAddress : undefined }
        : undefined

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (sending) return

    // Check the pickup time against the real clock, in case the form sat open for a while.
    const at = clock()
    setNow(at)
    setShowErrors(true)
    const problem = firstProblem(check(at))
    if (problem) {
      jumpTo(problem)
      return
    }

    const pickupTime = form.type === 'ON_DEMAND' ? new Date().toISOString() : new Date(pickupMs).toISOString()
    const details = rideDetails(form, { isReturn, saved, house, pickupTime })

    setError('')
    setSending(true)
    try {
      let ride: Ride
      if (mode === 'edit' && source) {
        ride = await dataService.updateRide(source.id, details)
      } else {
        const base = {
          ...details,
          orgId: house.orgId,
          houseId: house.id,
          requestedBy: user.id,
          estimatedFareSaved: estimateFare(),
        }
        ride =
          mode === 'return' && source
            ? await dataService.requestRide(
                {
                  ...base,
                  pickupAddress: source.destinationAddress,
                  returnOfRideId: source.id,
                  preferredDriverId: source.driverId, // ask the same driver first
                },
                requestId.current,
              )
            : await dataService.requestRide({ ...base, pickupAddress: houseAddress(house) }, requestId.current)
        requestId.current = crypto.randomUUID()
      }
      if (mode === 'new') clearDraft(user.id)
      refresh()
      navigate(paths.ride(ride.id), { state: { justSaved: mode === 'edit' ? 'changed' : 'booked' } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSending(false)
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'center' }))
    }
  }

  // On phones, the bar at the bottom gets out of the way while the keyboard is up
  function onFocusIn(e: FocusEvent) {
    if (isTextEntry(e.target) && window.matchMedia('(pointer: coarse)').matches) setTyping(true)
  }
  function onFocusOut(e: FocusEvent) {
    if (isTextEntry(e.target)) setTyping(false)
  }

  function reviewRide() {
    document.getElementById('trip-summary')?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' })
    document.getElementById('trip-summary-heading')?.focus({ preventScroll: true })
  }

  const title = { new: 'Request a ride', again: 'Book this ride again', return: 'Book the return trip', edit: 'Change this ride' }[mode]
  const intro = {
    new: 'Three quick questions. Most rides take under a minute.',
    again: `We've copied the details from the ride to ${source?.destinationName}. Pick a new time.`,
    return: `Bring the client home from ${source?.destinationName}.`,
    edit:
      source?.status === 'ACCEPTED'
        ? 'Changing the time, place, or passengers sends the ride back to drivers. We ask the current driver first.'
        : 'Update anything below. Drivers who were asked will see the new details.',
  }[mode]
  const sendLabel = { new: 'Request ride', again: 'Request ride', return: 'Book return trip', edit: 'Save changes' }[mode]
  const backTo = source && mode !== 'again' ? paths.ride(source.id) : paths.transport

  const submitButton = (wide: boolean) => (
    <button type="submit" className={`${primaryButton} ${wide ? 'w-full' : 'px-5'}`} disabled={sending} aria-describedby={!ready && showErrors ? 'send-blockers' : undefined}>
      {sending ? (
        <>
          <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
          {mode === 'edit' ? 'Saving…' : 'Sending…'}
        </>
      ) : (
        <>
          {sendLabel}
          <ArrowRight className="h-5 w-5" aria-hidden />
        </>
      )}
    </button>
  )

  const missingText = missing.map((m) => m.label).join(', ')
  const isQuickPick = picks.some((p) => p.value === form.pickupTime)
  const calendarOpen = moreTimes || !!shown.pickupTime
  const extrasShown = extrasOpen || !!shown.pickupInstructions || !!shown.notes
  const extrasSummary = [
    form.pickupInstructions.trim() ? `Meets: ${form.pickupInstructions.trim()}` : 'No meeting point',
    form.notes.trim() ? 'Note added' : undefined,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <form onSubmit={handleSubmit} onFocus={onFocusIn} onBlur={onFocusOut} noValidate className="pb-32 lg:pb-0">
      <div className="mb-6 sm:mb-8">
        <Link
          to={backTo}
          className={`-ml-1 mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-slate-600 transition hover:text-ink ${focusRing}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {source && mode !== 'again' ? 'Back to the ride' : 'Back to your rides'}
        </Link>
        <h1 className="font-display text-3xl font-bold tracking-[-0.035em] text-balance text-ink sm:text-[2.5rem] sm:leading-[1.08]">{title}</h1>
        <p className="mt-2 max-w-prose text-slate-600">{intro}</p>
        {restored && (
          <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
            <History className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1">We kept the request you hadn't sent yet.</span>
            <button type="button" className={`min-h-9 rounded-lg font-semibold underline underline-offset-2 ${focusRing}`} onClick={startOver}>
              Start over
            </button>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
        <div className="min-w-0 space-y-4">
          <div className={`${sheet} divide-y divide-slate-100`}>
            <FormSection
              id="where"
              step={1}
              title="Where are we going?"
              description={isReturn ? `The trip back to ${house.name}.` : undefined}
              done={done.where && !!to}
            >
              {isReturn ? (
                <FixedRoute from={from} to={{ name: house.name, detail: house.address }} />
              ) : (
                <DestinationPicker
                  from={from}
                  destinations={places}
                  sorted={sorted}
                  frequent={frequent}
                  destinationId={form.destinationId}
                  customAddress={form.customAddress}
                  customName={form.customName}
                  customPicked={form.customPicked}
                  waitFor={waitFor}
                  chosenWait={chosenWait ? waitNote(chosenWait) : undefined}
                  destinationError={shown.destination}
                  customAddressError={shown.customAddress}
                  hint={anyWaits ? 'Wait times are to be seen right now. More urgent needs go first.' : undefined}
                  onChoose={(destinationId) => update({ destinationId })}
                  onCustom={(query) =>
                    setForm((f) => ({
                      ...f,
                      destinationId: CUSTOM,
                      // A search typed into the saved places carries over; otherwise the last address stays
                      ...(query ? { customAddress: query, customName: '', customPicked: false } : {}),
                    }))
                  }
                  onCustomQuery={(customAddress) => update({ customAddress, customName: '', customPicked: false })}
                  onCustomSelect={(place) =>
                    update({ customAddress: `${place.address}, ${place.city}`, customName: place.name ?? place.address, customPicked: true })
                  }
                />
              )}
              <InlineMatchHint match={match} checks={['city']} />
            </FormSection>

            <FormSection id="when" step={2} title="When do you need the ride?" done={done.when}>
              <fieldset>
                <legend className="sr-only">When does the client need the ride?</legend>
                <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
                  <WhenOption
                    checked={form.type === 'SCHEDULED'}
                    onChange={() => update({ type: 'SCHEDULED' })}
                    title="Schedule for later"
                    description="Pick a pickup time"
                    icon={<CalendarClock className="h-5 w-5" />}
                  />
                  <WhenOption
                    checked={form.type === 'ON_DEMAND'}
                    onChange={() => update({ type: 'ON_DEMAND' })}
                    title="As soon as possible"
                    description="Find a driver now"
                    icon={<Zap className="h-5 w-5" />}
                  />
                </div>
              </fieldset>

              {form.type === 'SCHEDULED' ? (
                <div className="mt-5 space-y-4">
                  <div role="group" aria-labelledby="quick-picks">
                    <span className="mb-2 block text-sm font-semibold text-ink" id="quick-picks">
                      Quick picks
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {picks.map((p) => {
                        const on = form.pickupTime === p.value
                        return (
                          <button
                            key={p.label}
                            type="button"
                            aria-pressed={on}
                            onClick={() => update({ pickupTime: p.value })}
                            className={`min-h-11 rounded-full px-4 text-sm font-semibold transition active:scale-95 ${focusRing} ${
                              on ? 'bg-brand-600 text-white' : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:ring-brand-300'
                            }`}
                          >
                            {p.label}
                          </button>
                        )
                      })}
                      <button
                        type="button"
                        aria-expanded={calendarOpen}
                        aria-controls="pickup-time"
                        onClick={() => setMoreTimes((open) => !open)}
                        className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition active:scale-95 ${focusRing} ${
                          !isQuickPick && pickupValid
                            ? 'bg-brand-600 text-white'
                            : 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:ring-brand-300'
                        }`}
                      >
                        <CalendarDays className="h-4 w-4" aria-hidden />
                        {!isQuickPick && pickupValid && !calendarOpen ? describePickup(pickupMs, now) : 'Another time'}
                        <ChevronDown className={`h-4 w-4 transition ${calendarOpen ? 'rotate-180' : ''}`} aria-hidden />
                      </button>
                    </div>
                  </div>
                  {calendarOpen && (
                    <div className="animate-fade-up">
                      <PickupTimePicker
                        id="pickup-time"
                        value={form.pickupTime}
                        now={now}
                        error={shown.pickupTime}
                        onChange={(pickupTime) => update({ pickupTime })}
                      />
                    </div>
                  )}
                  {pickupValid && !shown.pickupTime && (
                    <p className="flex items-center gap-2 text-sm text-slate-700" aria-live="polite">
                      <Clock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                      <span>
                        Pickup <strong className="font-semibold text-ink">{describePickup(pickupMs, now)}</strong>
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />
                  Drivers taking requests right now are asked as soon as you send this. If nobody accepts within {ON_DEMAND_GIVE_UP_MINUTES} minutes,
                  the request is cancelled so you can make other plans.
                </p>
              )}
              <InlineMatchHint match={match} checks={['schedule']} />
            </FormSection>

            <FormSection id="who" step={3} title="Who is travelling?" done={done.who}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <div className="min-w-0">
                  <span id="passengers-label" tabIndex={-1} className="block font-semibold text-ink focus:outline-none">
                    Passengers
                    <RequiredMark />
                  </span>
                  <span className="block text-sm text-slate-600">Up to {maxRiders} per ride, the most any driver's vehicle can take.</span>
                </div>
                <PassengerStepper labelId="passengers-label" value={form.passengers} onChange={setPassengers} max={maxRiders} />
              </div>
              <FieldMessage id="passengers-message" error={shown.passengers} />
              <InlineMatchHint match={match} checks={['seats']} />

              <fieldset className="mt-6" aria-describedby="rider-names-message">
                <legend className={label}>
                  {form.passengers === 1 ? "Passenger's name" : "Passengers' names"}
                  <span className="ml-1 font-normal text-slate-600">(optional)</span>
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {form.riderNames.map((name, i) => (
                    <div key={i} className="relative">
                      <UserIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden />
                      <input
                        id={`rider-name-${i}`}
                        className={`${input} pl-11`}
                        autoComplete="off"
                        maxLength={MAX_NAME}
                        aria-label={`Passenger ${i + 1} name`}
                        aria-invalid={shown.riderNames && tooLong(name, MAX_NAME) ? true : undefined}
                        placeholder={form.passengers === 1 ? 'e.g. Sam Rivera' : `Passenger ${i + 1}`}
                        value={name}
                        onChange={(e) => setForm((f) => ({ ...f, riderNames: f.riderNames.map((n, j) => (j === i ? e.target.value : n)) }))}
                      />
                    </div>
                  ))}
                </div>
                <FieldMessage id="rider-names-message" error={shown.riderNames} hint="A first name helps the driver find the right person." />
              </fieldset>

              <fieldset className="mt-6">
                <legend className={label}>Accessibility needs</legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <OptionTile
                    type="checkbox"
                    checked={form.needsWheelchair}
                    onChange={() => update({ needsWheelchair: !form.needsWheelchair })}
                    title="Wheelchair accessible"
                    description="Only accessible vehicles are asked"
                    icon={<Accessibility className="h-5 w-5" />}
                  />
                  <OptionTile
                    type="checkbox"
                    checked={form.needsAssistance}
                    onChange={() => update({ needsAssistance: !form.needsAssistance })}
                    title="Help getting in and out"
                    description="The driver lends a hand"
                    icon={<HandHelping className="h-5 w-5" />}
                  />
                </div>
                <InlineMatchHint match={match} checks={['wheelchair']} />
              </fieldset>
            </FormSection>
          </div>

          {/* Secondary: open on request, and kept (never cleared) while closed */}
          <section id="extras" aria-labelledby="extras-heading" className={`${sheet} scroll-mt-28`}>
            <h2 id="extras-heading">
              <button
                type="button"
                aria-expanded={extrasShown}
                aria-controls="extras-panel"
                onClick={() => setExtrasOpen((open) => !open)}
                className={`flex min-h-16 w-full items-center gap-3 rounded-2xl px-5 py-4 text-left sm:px-7 ${focusRing}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 font-display text-base font-bold text-ink">
                    Notes for the driver
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-sans text-xs font-semibold text-slate-600">Optional</span>
                  </span>
                  {!extrasShown && <span className="mt-0.5 block truncate font-sans text-sm font-normal text-slate-600">{extrasSummary}</span>}
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-500 transition ${extrasShown ? 'rotate-180' : ''}`} aria-hidden />
              </button>
            </h2>
            <div id="extras-panel" hidden={!extrasShown} className="space-y-5 border-t border-slate-100 px-5 pb-6 pt-5 sm:px-7">
              <TextField
                id="instructions"
                label="Where the driver meets the client"
                icon={<DoorOpen className="h-5 w-5" />}
                maxLength={MAX_NOTE}
                value={form.pickupInstructions}
                error={shown.pickupInstructions}
                onChange={(e) => update({ pickupInstructions: e.target.value })}
              />
              <div>
                <label className={label} htmlFor="notes">
                  Notes for the driver
                  <span className="ml-1 font-normal text-slate-600">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  rows={3}
                  maxLength={MAX_NOTE}
                  className={`${input} resize-y py-3`}
                  placeholder="e.g. Uses a walker. The appointment is on the 3rd floor."
                  aria-invalid={shown.notes ? true : undefined}
                  aria-describedby="notes-message"
                  value={form.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                />
                <FieldMessage id="notes-message" error={shown.notes} />
              </div>
            </div>
          </section>

          {/* TODO: suggest group rides (modules/careride/logic/groupRides.ts) before submitting */}
        </div>

        <aside
          id="trip-summary"
          className="scroll-mt-24 lg:sticky lg:top-24 lg:-m-1 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:p-1"
          aria-label="Trip summary"
        >
          <TripSummary
            from={from}
            to={to}
            when={form.type === 'ON_DEMAND' ? 'As soon as possible' : pickupValid ? describePickup(pickupMs, now) : undefined}
            wait={chosenWait ? waitSummary(chosenWait) : undefined}
            rider={riderLabel(form)}
            passengers={form.passengers}
            needs={[...(form.needsWheelchair ? ['Wheelchair'] : []), ...(form.needsAssistance ? ['Help in and out'] : [])]}
            missing={missing}
            showErrors={showErrors}
            onJump={jumpTo}
          >
            <MatchLine match={match} />
            {error && (
              <p ref={errorRef} role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900 ring-1 ring-red-600">
                <strong>{mode === 'edit' ? "We couldn't save your changes." : "We couldn't send this ride."}</strong> {error}
              </p>
            )}
            <div className="hidden space-y-2 lg:block">
              {submitButton(true)}
              {mode === 'edit' && (
                <Link to={backTo} className={`${ghostButton} w-full`}>
                  Keep the ride as it was
                </Link>
              )}
            </div>
            {mode === 'edit' && (
              <Link to={backTo} className={`${ghostButton} w-full lg:hidden`}>
                Keep the ride as it was
              </Link>
            )}
          </TripSummary>
        </aside>
      </div>

      <p id="send-blockers" className="sr-only">
        {missing.length > 0 ? `Still needed: ${missingText}.` : ''}
      </p>

      {/* On phones the send button stays in reach at the bottom of the screen. */}
      <div
        className={`native-bottom-chrome no-print fixed bottom-0 left-[var(--shell-inset,0px)] right-0 z-20 border-t border-slate-200/70 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-16px_rgb(17_24_32/0.25)] lg:hidden ${
          typing ? 'max-lg:hidden' : ''
        }`}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button type="button" onClick={reviewRide} className={`min-h-12 min-w-0 flex-1 rounded-xl px-1 text-left text-sm ${focusRing}`}>
            <span className="sr-only">Review your ride. </span>
            <span
              className={`flex items-center gap-1.5 font-semibold ${ready ? 'text-emerald-800' : showErrors ? 'text-red-700' : 'text-ink'}`}
            >
              {ready ? <CircleCheck className="h-4 w-4 shrink-0" aria-hidden /> : showErrors && <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />}
              <span className="truncate">{ready ? 'Ready to send' : `${showErrors ? 'Fix' : 'Still needed'}: ${missingText}`}</span>
            </span>
            <span className={`block truncate ${match && match.count === 0 ? 'font-semibold text-amber-800' : 'text-slate-600'}`}>
              {match && match.count === 0
                ? 'No driver fits yet. Review'
                : to
                  ? `To ${to.name} · ${passengersLabel(form.passengers)}`
                  : 'Review your ride'}
            </span>
          </button>
          <div className="shrink-0">{submitButton(false)}</div>
        </div>
      </div>
    </form>
  )
}
