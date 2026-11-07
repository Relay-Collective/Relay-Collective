import { DEFAULT_PICKUP_INSTRUCTIONS } from '../../../constants'
import { houseAddress, isRealAddress } from '../../../logic/maps'
import { MAX_NAME, MAX_NOTE, tooLong } from '../../../logic/validate'
import type { Destination, House, Ride, RideStatus, RideType } from '../../../types'
import { BOOK_AHEAD_DAYS, parseLocalInput, quickPicks, toLocalInput } from './pickupTime'

// The booking form's state and rules, kept apart from the page so they can be tested on their own.

// The destination id meaning "an address searched for, not a saved place"
export const CUSTOM = 'custom'

// The statuses in which a booked ride can still be changed
export const EDITABLE: RideStatus[] = ['SEARCHING', 'OFFERED', 'NEEDS_ATTENTION', 'ACCEPTED']

// new: a fresh booking. again: a fresh booking copied from an old ride.
// return: the trip back from an outbound ride. edit: changing a booked ride.
export type Mode = 'new' | 'again' | 'return' | 'edit'

export function bookingMode(params: { edit?: string | null; returnOf?: string | null; again?: string | null }): Mode {
  return params.edit ? 'edit' : params.returnOf ? 'return' : params.again ? 'again' : 'new'
}

// Saved as the unsent draft too, so its shape stays stable: older drafts must still open.
export interface FormState {
  type: RideType
  destinationId: string
  customAddress: string // what's in the box, then the full picked address
  customName: string // the picked place's name, e.g. a hospital, or its street address
  customPicked: boolean // picked from the search list, so it's a real place drivers can find
  pickupTime: string // datetime-local style
  passengers: number
  riderNames: string[]
  pickupInstructions: string
  needsWheelchair: boolean
  needsAssistance: boolean
  notes: string
}

export type Field = 'destination' | 'customAddress' | 'pickupTime' | 'passengers' | 'riderNames' | 'pickupInstructions' | 'notes'
export type Errors = Partial<Record<Field, string>>

// Every checked field, in page order, so a failed send goes to the first problem
export const FIELD_ORDER: Field[] = ['destination', 'customAddress', 'pickupTime', 'passengers', 'riderNames', 'pickupInstructions', 'notes']

export function blankForm(now: number): FormState {
  return {
    type: 'SCHEDULED',
    destinationId: '',
    customAddress: '',
    customName: '',
    customPicked: false,
    pickupTime: quickPicks(now)[0].value,
    passengers: 1,
    riderNames: [''],
    pickupInstructions: DEFAULT_PICKUP_INSTRUCTIONS,
    needsWheelchair: false,
    needsAssistance: false,
    notes: '',
  }
}

// Whether staff have entered anything worth keeping. The default pickup time moves with the clock, so it doesn't count.
export function isUntouched(form: FormState, now: number): boolean {
  const blank = blankForm(now)
  return JSON.stringify({ ...form, pickupTime: '' }) === JSON.stringify({ ...blank, pickupTime: '' })
}

// A stored draft, read defensively: it may come from an older version of the form, the /demo deck, or be damaged.
// Only fields of the right type are kept; anything else falls back to the blank form.
export function parseDraft(raw: string | null | undefined): Partial<FormState> | undefined {
  if (!raw) return undefined
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const v = value as Record<string, unknown>
  const draft: Partial<FormState> = {}
  if (v.type === 'SCHEDULED' || v.type === 'ON_DEMAND') draft.type = v.type
  for (const key of ['destinationId', 'customAddress', 'customName', 'pickupTime', 'pickupInstructions', 'notes'] as const) {
    if (typeof v[key] === 'string') draft[key] = v[key]
  }
  for (const key of ['customPicked', 'needsWheelchair', 'needsAssistance'] as const) {
    if (typeof v[key] === 'boolean') draft[key] = v[key]
  }
  if (typeof v.passengers === 'number' && Number.isInteger(v.passengers) && v.passengers >= 1) draft.passengers = v.passengers
  if (Array.isArray(v.riderNames)) {
    const names = v.riderNames.map((n) => (typeof n === 'string' ? n : ''))
    const count = draft.passengers ?? 1
    draft.riderNames = Array.from({ length: count }, (_, i) => names[i] ?? '')
  } else if (draft.passengers) {
    draft.riderNames = Array.from({ length: draft.passengers }, () => '')
  }
  return draft
}

// The who and how of an earlier ride, to start a new one from
function copyRiders(ride: Ride): Pick<FormState, 'passengers' | 'riderNames' | 'needsWheelchair' | 'needsAssistance'> {
  return {
    passengers: ride.passengers,
    riderNames: Array.from({ length: ride.passengers }, (_, i) => ride.riderNames?.[i] ?? ''),
    needsWheelchair: ride.needsWheelchair,
    needsAssistance: ride.needsAssistance,
  }
}

// The form a booking opens with. A new booking picks up an unsent draft, if there's one worth keeping.
export function initialForm(
  mode: Mode,
  source: Ride | undefined,
  draft: Partial<FormState> | undefined,
  now: number,
): { form: FormState; restored: boolean } {
  const blank = blankForm(now)
  if (mode === 'new') {
    if (!draft || isUntouched({ ...blank, ...draft }, now)) return { form: blank, restored: false }
    // A saved time that has since passed (or can't be read) goes back to the default
    const saved = draft.pickupTime ? parseLocalInput(draft.pickupTime) : NaN
    const stale = Number.isNaN(saved) || saved <= now
    return { form: { ...blank, ...draft, pickupTime: stale ? blank.pickupTime : draft.pickupTime! }, restored: true }
  }
  if (!source) return { form: blank, restored: false }
  // A typed address from an older ride counts as picked, unless it was never a real one
  const destination = source.destinationId
    ? { destinationId: source.destinationId, customAddress: '', customName: '', customPicked: false }
    : {
        destinationId: CUSTOM,
        customAddress: source.destinationAddress,
        customName: source.destinationName,
        customPicked: isRealAddress(source.destinationAddress),
      }
  if (mode === 'return') return { form: { ...blank, ...copyRiders(source) }, restored: false }
  if (mode === 'again') {
    return {
      form: { ...blank, ...destination, ...copyRiders(source), pickupInstructions: source.pickupInstructions ?? '', notes: source.notes ?? '' },
      restored: false,
    }
  }
  return {
    form: {
      ...destination,
      ...copyRiders(source),
      type: source.type,
      pickupTime: source.type === 'SCHEDULED' ? toLocalInput(Date.parse(source.pickupTime)) : blank.pickupTime,
      pickupInstructions: source.pickupInstructions ?? '',
      notes: source.notes ?? '',
    },
    restored: false,
  }
}

// Whether the trip goes back to the partner's address: a return booking, or editing one
export function isReturnTrip(mode: Mode, source: Pick<Ride, 'returnOfRideId'> | undefined): boolean {
  return mode === 'return' || (mode === 'edit' && !!source?.returnOfRideId)
}

interface Rules {
  isReturn: boolean
  maxRiders: number
  at: number // the clock pickup times are checked against
}

// Every problem with the form, by field. Nothing here is shown until staff first try to send.
export function validate(form: FormState, { isReturn, maxRiders, at }: Rules): Errors {
  const found: Errors = {}
  const pickupMs = parseLocalInput(form.pickupTime)
  if (!isReturn && !form.destinationId) found.destination = 'Choose where the client is going.'
  if (!isReturn && form.destinationId === CUSTOM) {
    const address = form.customAddress.trim()
    if (!address) found.customAddress = 'Search for the address the client is going to.'
    else if (!form.customPicked) found.customAddress = 'Pick a matching address from the list, so the driver can find it.'
    else found.customAddress = tooLong(address, MAX_NAME * 2)
  }
  if (form.type === 'SCHEDULED') {
    if (Number.isNaN(pickupMs)) found.pickupTime = 'Choose a pickup date and time.'
    else if (pickupMs < at) found.pickupTime = 'That time has already passed. Choose a later time.'
    else if (pickupMs > at + BOOK_AHEAD_DAYS * 86_400_000) found.pickupTime = `Book up to ${BOOK_AHEAD_DAYS} days ahead.`
  }
  if (form.passengers > maxRiders) found.passengers = `A ride can take up to ${maxRiders} passengers. Book two rides for a bigger group.`
  if (form.riderNames.some((n) => tooLong(n, MAX_NAME))) found.riderNames = `Keep each name under ${MAX_NAME} characters.`
  found.pickupInstructions = tooLong(form.pickupInstructions, MAX_NOTE)
  found.notes = tooLong(form.notes, MAX_NOTE)
  return Object.fromEntries(Object.entries(found).filter(([, v]) => v)) as Errors
}

export function firstProblem(errors: Errors): Field | undefined {
  return FIELD_ORDER.find((f) => errors[f])
}

// The three required sections and whether each is complete
export function sectionsDone(errors: Errors): { where: boolean; when: boolean; who: boolean } {
  return {
    where: !errors.destination && !errors.customAddress,
    when: !errors.pickupTime,
    who: !errors.passengers && !errors.riderNames,
  }
}

// What still stands between the form and a booking, in page order, in words staff use.
// One item per thing to fix, so the summary never says "nearly done" while something critical is missing.
export function missingItems(errors: Errors): { field: Field; label: string }[] {
  const labels: Record<Field, string> = {
    destination: 'Destination',
    customAddress: 'Destination address',
    pickupTime: 'Pickup time',
    passengers: 'Passengers',
    riderNames: 'Passenger names',
    pickupInstructions: 'Meeting point',
    notes: 'Driver notes',
  }
  return FIELD_ORDER.filter((f) => errors[f]).map((field) => ({ field, label: labels[field] }))
}

// What the ride is booked with: the form's choices in the shape the services take
export function rideDetails(
  form: FormState,
  { isReturn, saved, house, pickupTime }: { isReturn: boolean; saved?: Destination; house: House; pickupTime: string },
) {
  const destination = isReturn
    ? { destinationId: undefined, destinationName: house.name, destinationAddress: houseAddress(house) }
    : saved
      ? { destinationId: saved.id, destinationName: saved.name, destinationAddress: saved.address }
      : {
          destinationId: undefined,
          destinationName: form.customName.trim() || form.customAddress.trim(),
          destinationAddress: form.customAddress.trim(),
        }
  return {
    type: form.type,
    pickupTime,
    passengers: form.passengers,
    riderNames: form.riderNames.map((n) => n.trim()),
    needsWheelchair: form.needsWheelchair,
    needsAssistance: form.needsAssistance,
    pickupInstructions: form.pickupInstructions.trim() || undefined,
    notes: form.notes.trim() || undefined,
    ...destination,
  }
}
