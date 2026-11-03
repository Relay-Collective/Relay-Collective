import type { Locator, Page } from '@playwright/test'
import { expect } from './fixtures'

// The booking form's choices are radio buttons styled as cards (the input itself is visually hidden).
// Choose them the way a keyboard user does: focus, then Space.
export async function choose(radio: Locator): Promise<void> {
  await radio.focus()
  await radio.press('Space')
  await expect(radio).toBeChecked()
}

export interface Booking {
  destination: RegExp
  when: 'asap' | 'Tomorrow, 9 AM' | 'Tomorrow, 1 PM' | 'In 2 hours'
  passenger: string
}

// Books a ride from the partner's "Request a ride" form and waits for the ride page.
// Returns the ride's id from the address (/workspace/transportation/rides/<id>).
export async function bookRide(page: Page, booking: Booking): Promise<string> {
  await page.goto('/workspace/transportation/new')
  await expect(page.getByRole('heading', { level: 1, name: 'Request a ride' })).toBeVisible()
  await choose(page.getByRole('radio', { name: booking.destination }))
  if (booking.when === 'asap') {
    await choose(page.getByRole('radio', { name: /^As soon as possible/ }))
  } else {
    await page.getByRole('group', { name: 'Quick picks' }).getByRole('button', { name: booking.when }).click()
  }
  await page.getByLabel('Passenger 1 name').fill(booking.passenger)
  await page.getByRole('button', { name: 'Request ride' }).click()
  await expect(page.getByRole('status').getByRole('heading', { name: 'Ride requested' })).toBeVisible()
  await expect(page).toHaveURL(/\/workspace\/transportation\/rides\/[^/]+$/)
  return new URL(page.url()).pathname.split('/').pop()!
}

// The short reference people see on lists ("Ref. #EPAST3" for ride-past-3), from the app's own rule.
export { requestReference as rideReference } from '../src/modules/careride/logic/requestSummary'
