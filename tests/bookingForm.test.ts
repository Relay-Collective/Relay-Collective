import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { DEFAULT_PICKUP_INSTRUCTIONS } from '../src/constants'
import {
  blankForm,
  bookingMode,
  CUSTOM,
  firstProblem,
  initialForm,
  isReturnTrip,
  isUntouched,
  missingItems,
  parseDraft,
  rideDetails,
  sectionsDone,
  validate,
  type FormState,
} from '../src/modules/careride/logic/bookingForm'
import { previewDriverMatch } from '../src/modules/careride/logic/driverMatchPreview'
import { BOOK_AHEAD_DAYS, describePickup, parseLocalInput, quickPicks, toLocalInput } from '../src/modules/careride/logic/pickupTime'
import { filterDestinations, frequentDestinations, sortByPopularity, usageCounts } from '../src/modules/careride/logic/popularDestinations'
import { seed } from '../src/services/seed'
import type { Destination, House, Ride } from '../src/types'

// The booking form's rules: finding a place, the four kinds of booking, drafts, checks and what's sent.

const HOUR = 3_600_000
// A Monday morning, local time, like the browser tests
const NOW = new Date(2026, 9, 5, 10, 0).getTime()

const house: House = { id: 'house-belkin', orgId: 'org-belkin', name: 'Belkin House', address: '555 Homer St', city: 'Vancouver', phone: '' }

const place = (id: string, name: string, address: string, city = 'Vancouver'): Destination => ({ id, orgId: 'org-belkin', name, address, city })
const STP = place('stp', "St. Paul's Hospital", '1081 Burrard St, Vancouver')
const VGH = place('vgh', 'Vancouver General Hospital', '899 W 12th Ave, Vancouver')
const AAC = place('aac', 'Access and Assessment Centre (VGH)', '803 W 12th Ave, Vancouver')
const RH = place('rh', 'Richmond Hospital', '7000 Westminster Hwy, Richmond', 'Richmond')
const PLACES = [AAC, RH, STP, VGH]

function ride(extra: Partial<Ride> = {}): Ride {
  return {
    id: 'ride-1',
    type: 'SCHEDULED',
    orgId: 'org-belkin',
    houseId: 'house-belkin',
    requestedBy: 'u-belkin',
    passengers: 1,
    pickupAddress: '555 Homer St, Vancouver',
    destinationId: 'stp',
    destinationName: STP.name,
    destinationAddress: STP.address,
    pickupTime: new Date(NOW + 26 * HOUR).toISOString(),
    needsWheelchair: false,
    needsAssistance: false,
    status: 'OFFERED',
    estimatedFareSaved: 2.58,
    createdAt: new Date(NOW).toISOString(),
    ...extra,
  }
}

const rules = { isReturn: false, maxRiders: 6, at: NOW }
const filled = (extra: Partial<FormState> = {}): FormState => ({ ...blankForm(NOW), destinationId: 'stp', ...extra })

describe('finding a destination', () => {
  test('popularity counts only this house, and orders most used first', () => {
    const rides = [ride({ destinationId: 'vgh' }), ride({ destinationId: 'stp' }), ride({ destinationId: 'stp' }), ride({ houseId: 'other', destinationId: 'rh' })]
    assert.deepEqual([...usageCounts(rides, house.id)], [['vgh', 1], ['stp', 2]])
    assert.deepEqual(
      sortByPopularity(PLACES, rides, house.id).map((d) => d.id),
      ['stp', 'vgh', 'aac', 'rh'], // unused places keep their order
    )
  })

  test('frequent places are only ones actually used, at most three', () => {
    const rides = [ride({ destinationId: 'vgh' }), ride({ destinationId: 'stp' }), ride({ destinationId: 'stp' })]
    assert.deepEqual(
      frequentDestinations(PLACES, rides, house.id).map((f) => [f.destination.id, f.rides]),
      [
        ['stp', 2],
        ['vgh', 1],
      ],
    )
    assert.deepEqual(frequentDestinations(PLACES, [], house.id), [])
    const many = ['aac', 'rh', 'stp', 'vgh'].flatMap((id) => [ride({ destinationId: id })])
    assert.equal(frequentDestinations(PLACES, many, house.id).length, 3)
    assert.equal(frequentDestinations(PLACES, many, house.id, 1).length, 1)
  })

  test('search matches every word in the name, address or city, ignoring case and punctuation', () => {
    const ids = (q: string) => filterDestinations(PLACES, q).map((d) => d.id)
    assert.deepEqual(ids(''), ['aac', 'rh', 'stp', 'vgh'])
    assert.deepEqual(ids('   '), ['aac', 'rh', 'stp', 'vgh'])
    assert.deepEqual(ids("St. Paul's"), ['stp'])
    assert.deepEqual(ids('st pauls'), ['stp'])
    assert.deepEqual(ids('12th ave'), ['aac', 'vgh'])
    assert.deepEqual(ids('vgh'), ['aac']) // "(VGH)" in the name
    assert.deepEqual(ids('richmond'), ['rh'])
    assert.deepEqual(ids('HOSPITAL burrard'), ['stp'])
    assert.deepEqual(ids('nowhere'), [])
  })
})

describe('booking modes', () => {
  test('the address decides the mode, edit first', () => {
    assert.equal(bookingMode({}), 'new')
    assert.equal(bookingMode({ again: 'r1' }), 'again')
    assert.equal(bookingMode({ returnOf: 'r1' }), 'return')
    assert.equal(bookingMode({ edit: 'r1', returnOf: 'r2' }), 'edit')
  })

  test('a new booking starts blank, with the first quick pick and the usual meeting point', () => {
    const { form, restored } = initialForm('new', undefined, undefined, NOW)
    assert.equal(restored, false)
    assert.equal(form.pickupTime, quickPicks(NOW)[0].value)
    assert.equal(form.pickupInstructions, DEFAULT_PICKUP_INSTRUCTIONS)
    assert.equal(form.destinationId, '')
    assert.deepEqual(form.riderNames, [''])
  })

  test('booking again copies the place, riders and notes, but not the time', () => {
    const source = ride({ passengers: 2, riderNames: ['Sam'], needsWheelchair: true, notes: 'Walker', pickupInstructions: 'Side door' })
    const { form } = initialForm('again', source, undefined, NOW)
    assert.equal(form.destinationId, 'stp')
    assert.deepEqual(form.riderNames, ['Sam', ''])
    assert.equal(form.needsWheelchair, true)
    assert.equal(form.notes, 'Walker')
    assert.equal(form.pickupInstructions, 'Side door')
    assert.equal(form.pickupTime, blankForm(NOW).pickupTime)
  })

  test('booking again from a searched address keeps it as a picked address', () => {
    const source = ride({ destinationId: undefined, destinationName: 'Mount Saint Joseph Hospital', destinationAddress: '3080 Prince Edward St, Vancouver' })
    const { form } = initialForm('again', source, undefined, NOW)
    assert.equal(form.destinationId, CUSTOM)
    assert.equal(form.customPicked, true)
    assert.equal(form.customName, 'Mount Saint Joseph Hospital')
    // A placeholder address was never a real one, so it has to be searched again
    const unconfirmed = initialForm('again', ride({ destinationId: undefined, destinationAddress: 'Address to confirm' }), undefined, NOW)
    assert.equal(unconfirmed.form.customPicked, false)
  })

  test('a return trip copies the riders only: the route is fixed', () => {
    const source = ride({ passengers: 3, riderNames: ['A', 'B', 'C'], needsAssistance: true, notes: 'Outbound note' })
    const { form } = initialForm('return', source, undefined, NOW)
    assert.equal(form.destinationId, '')
    assert.deepEqual(form.riderNames, ['A', 'B', 'C'])
    assert.equal(form.needsAssistance, true)
    assert.equal(form.notes, '')
    assert.equal(isReturnTrip('return', source), true)
    assert.equal(isReturnTrip('edit', ride({ returnOfRideId: 'r0' })), true)
    assert.equal(isReturnTrip('edit', source), false)
    // No destination is needed on the way back
    assert.deepEqual(validate(form, { ...rules, isReturn: true }), {})
  })

  test('editing keeps everything, including the booked time and kind', () => {
    const pickup = NOW + 30 * HOUR
    const scheduled = initialForm('edit', ride({ pickupTime: new Date(pickup).toISOString(), notes: 'n' }), undefined, NOW).form
    assert.equal(scheduled.pickupTime, toLocalInput(pickup))
    assert.equal(scheduled.notes, 'n')
    const asap = initialForm('edit', ride({ type: 'ON_DEMAND' }), undefined, NOW).form
    assert.equal(asap.type, 'ON_DEMAND')
    assert.equal(asap.pickupTime, blankForm(NOW).pickupTime)
  })

  test('a missing source ride falls back to a blank form', () => {
    assert.deepEqual(initialForm('edit', undefined, undefined, NOW), { form: blankForm(NOW), restored: false })
  })
})

describe('drafts', () => {
  test('an untouched form is not worth keeping, whatever the clock says', () => {
    assert.equal(isUntouched(blankForm(NOW + 5 * HOUR), NOW), true)
    assert.equal(isUntouched({ ...blankForm(NOW), notes: 'x' }, NOW), false)
  })

  test('a saved draft is restored, with a time that has passed reset', () => {
    const later = toLocalInput(NOW + 5 * HOUR)
    const kept = initialForm('new', undefined, { ...filled(), pickupTime: later }, NOW)
    assert.equal(kept.restored, true)
    assert.equal(kept.form.pickupTime, later)
    const stale = initialForm('new', undefined, { ...filled(), pickupTime: toLocalInput(NOW - HOUR) }, NOW)
    assert.equal(stale.form.pickupTime, blankForm(NOW).pickupTime)
    assert.equal(stale.form.destinationId, 'stp')
    // Drafts only open a new booking
    assert.equal(initialForm('again', ride(), filled({ notes: 'draft' }), NOW).form.notes, '')
  })

  test('an untouched draft opens as a blank form, not a restored one', () => {
    assert.equal(initialForm('new', undefined, blankForm(NOW - HOUR), NOW).restored, false)
  })

  test('drafts from older versions, the demo deck, or damaged storage are read safely', () => {
    assert.equal(parseDraft(null), undefined)
    assert.equal(parseDraft('not json'), undefined)
    assert.equal(parseDraft('[1,2]'), undefined)
    assert.equal(parseDraft('"text"'), undefined)
    // The /demo deck's draft has no customName or customPicked: those come from the blank form
    const demo = parseDraft(JSON.stringify({ type: 'SCHEDULED', destinationId: 'stp', customAddress: '', passengers: 1, riderNames: ['Alex'], needsAssistance: true }))
    assert.deepEqual(demo, { type: 'SCHEDULED', destinationId: 'stp', customAddress: '', passengers: 1, riderNames: ['Alex'], needsAssistance: true })
    assert.equal(initialForm('new', undefined, demo, NOW).form.customPicked, false)
    // Wrong types are dropped; names always match the passenger count
    const odd = parseDraft(JSON.stringify({ type: 'BOAT', passengers: 3, riderNames: ['A', 7], notes: 5, needsWheelchair: 'yes' }))
    assert.deepEqual(odd, { passengers: 3, riderNames: ['A', '', ''] })
    assert.deepEqual(parseDraft(JSON.stringify({ passengers: 0 })), {})
    assert.deepEqual(parseDraft(JSON.stringify({ passengers: 2 })), { passengers: 2, riderNames: ['', ''] })
  })
})

describe('checks before sending', () => {
  test('a destination is required', () => {
    const errors = validate(blankForm(NOW), rules)
    assert.equal(errors.destination, 'Choose where the client is going.')
    assert.equal(firstProblem(errors), 'destination')
  })

  test('a searched address must be picked from the list, so drivers can find it', () => {
    assert.equal(validate(filled({ destinationId: CUSTOM }), rules).customAddress, 'Search for the address the client is going to.')
    assert.equal(
      validate(filled({ destinationId: CUSTOM, customAddress: '3080 Prince Ed' }), rules).customAddress,
      'Pick a matching address from the list, so the driver can find it.',
    )
    assert.deepEqual(validate(filled({ destinationId: CUSTOM, customAddress: '3080 Prince Edward St, Vancouver', customPicked: true }), rules), {})
    assert.match(validate(filled({ destinationId: CUSTOM, customAddress: 'x'.repeat(200), customPicked: true }), rules).customAddress!, /Keep this under/)
  })

  test('a scheduled pickup must be readable, ahead, and within the booking window', () => {
    assert.equal(validate(filled({ pickupTime: '' }), rules).pickupTime, 'Choose a pickup date and time.')
    assert.equal(validate(filled({ pickupTime: toLocalInput(NOW - 15 * 60_000) }), rules).pickupTime, 'That time has already passed. Choose a later time.')
    assert.equal(validate(filled({ pickupTime: toLocalInput(NOW + (BOOK_AHEAD_DAYS + 1) * 24 * HOUR) }), rules).pickupTime, `Book up to ${BOOK_AHEAD_DAYS} days ahead.`)
    // An on-demand ride has no pickup time to check
    assert.equal(validate(filled({ type: 'ON_DEMAND', pickupTime: '' }), rules).pickupTime, undefined)
  })

  test('passengers fit the biggest vehicle, and names and notes stay short', () => {
    assert.match(validate(filled({ passengers: 7, riderNames: Array(7).fill('') }), rules).passengers!, /up to 6 passengers/)
    assert.match(validate(filled({ riderNames: ['x'.repeat(81)] }), rules).riderNames!, /Keep each name under 80/)
    assert.ok(validate(filled({ notes: 'x'.repeat(501) }), rules).notes)
    assert.ok(validate(filled({ pickupInstructions: 'x'.repeat(501) }), rules).pickupInstructions)
  })

  test('the summary lists what is missing in page order, and never calls a form with a gap ready', () => {
    const blank = validate(blankForm(NOW), rules)
    assert.deepEqual(missingItems(blank), [{ field: 'destination', label: 'Destination' }])
    assert.deepEqual(sectionsDone(blank), { where: false, when: true, who: true })

    const several = validate(filled({ destinationId: '', pickupTime: '', notes: 'x'.repeat(501) }), rules)
    assert.deepEqual(
      missingItems(several).map((m) => m.label),
      ['Destination', 'Pickup time', 'Driver notes'],
    )
    assert.equal(firstProblem(several), 'destination')

    const ready = validate(filled(), rules)
    assert.deepEqual(missingItems(ready), [])
    assert.deepEqual(sectionsDone(ready), { where: true, when: true, who: true })
  })
})

describe('what is sent', () => {
  const pickupTime = new Date(NOW + 2 * HOUR).toISOString()

  test('a saved place is sent with its id, name and address', () => {
    const details = rideDetails(filled({ riderNames: ['  Sam '], notes: '  ', pickupInstructions: ' Lobby ' }), { isReturn: false, saved: STP, house, pickupTime })
    assert.equal(details.destinationId, 'stp')
    assert.equal(details.destinationName, STP.name)
    assert.equal(details.destinationAddress, STP.address)
    assert.deepEqual(details.riderNames, ['Sam'])
    assert.equal(details.notes, undefined)
    assert.equal(details.pickupInstructions, 'Lobby')
    assert.equal(details.pickupTime, pickupTime)
  })

  test('a searched address is sent by name and address, with no saved id', () => {
    const form = filled({ destinationId: CUSTOM, customAddress: '3080 Prince Edward St, Vancouver', customName: 'Mount Saint Joseph Hospital', customPicked: true })
    const details = rideDetails(form, { isReturn: false, house, pickupTime })
    assert.equal(details.destinationId, undefined)
    assert.equal(details.destinationName, 'Mount Saint Joseph Hospital')
    assert.equal(details.destinationAddress, '3080 Prince Edward St, Vancouver')
    // A plain street address names itself
    assert.equal(rideDetails({ ...form, customName: '' }, { isReturn: false, house, pickupTime }).destinationName, '3080 Prince Edward St, Vancouver')
  })

  test('a return trip goes to the partner address, whatever the form says', () => {
    const details = rideDetails(filled(), { isReturn: true, saved: STP, house, pickupTime })
    assert.equal(details.destinationId, undefined)
    assert.equal(details.destinationName, 'Belkin House')
    assert.equal(details.destinationAddress, '555 Homer St, Vancouver')
  })

  test('accessibility needs and passengers go through unchanged', () => {
    const details = rideDetails(filled({ passengers: 2, riderNames: ['A', 'B'], needsWheelchair: true, needsAssistance: true }), {
      isReturn: false,
      saved: STP,
      house,
      pickupTime,
    })
    assert.equal(details.passengers, 2)
    assert.equal(details.needsWheelchair, true)
    assert.equal(details.needsAssistance, true)
  })
})

describe('pickup times', () => {
  test('quick picks are two hours out (to the quarter hour), then tomorrow morning and afternoon', () => {
    const [soon, morning, afternoon] = quickPicks(new Date(2026, 9, 5, 10, 7).getTime())
    assert.equal(soon.value, '2026-10-05T12:15')
    assert.equal(morning.value, '2026-10-06T09:00')
    assert.equal(afternoon.value, '2026-10-06T13:00')
  })

  test('local times read back exactly, and say the day in words', () => {
    assert.equal(parseLocalInput(toLocalInput(NOW)), NOW)
    assert.ok(Number.isNaN(parseLocalInput('soon')))
    assert.match(describePickup(NOW + 2 * HOUR, NOW), /^Today at 12:00/)
    assert.match(describePickup(NOW + 24 * HOUR, NOW), /^Tomorrow at 10:00/)
    assert.match(describePickup(NOW + 72 * HOUR, NOW), / at 10:00/)
  })
})

describe('driver matching while booking', () => {
  const belkin = seed.houses.find((h) => h.id === 'house-belkin')!
  // Monday 10 AM: inside every approved demo driver's request hours
  const monday = new Date(NOW)
  const needs = { type: 'SCHEDULED' as const, pickupTime: new Date(NOW + 2 * HOUR).toISOString(), passengers: 1, needsWheelchair: false }

  test('counts every approved driver who fits', () => {
    assert.deepEqual(previewDriverMatch(needs, belkin, seed.drivers, monday), { count: 3 })
    assert.equal(previewDriverMatch({ ...needs, needsWheelchair: true }, belkin, seed.drivers, monday).count, 1)
    assert.equal(previewDriverMatch({ ...needs, passengers: 6 }, belkin, seed.drivers, monday).count, 1)
  })

  test('with nobody left, says which need rules everyone out', () => {
    const noAccessible = seed.drivers.map((d) => ({ ...d, wheelchairAccessible: false }))
    const preview = previewDriverMatch({ ...needs, needsWheelchair: true }, belkin, noAccessible, monday)
    assert.equal(preview.count, 0)
    assert.equal(preview.check, 'wheelchair')
    assert.match(preview.reason!, /wheelchair-accessible/)
    assert.deepEqual(previewDriverMatch(needs, belkin, [], monday), { count: 0, reason: 'no drivers are approved yet.' })
  })
})
