import type { Page } from '@playwright/test'
import { accounts, expect, signIn, test } from './fixtures'
import { bookRide, choose, pickDestination } from './helpers'

// The "Request a ride" form in detail: finding a destination, choosing a time, who's riding, the summary,
// drafts, every booking mode, and what happens when sending fails. Belkin House has 11 saved places and three
// past rides (two to St. Paul's, one to Vancouver General), so those two are its frequent places.

const NEW_RIDE = '/workspace/transportation/new'

const where = (page: Page) => page.getByRole('region', { name: 'Where are we going?' })
const summary = (page: Page) => page.getByRole('complementary', { name: 'Trip summary' })
const notes = (page: Page) => page.getByRole('textbox', { name: /^Notes for the driver/ })
const search = (page: Page) => page.getByRole('searchbox', { name: /^Where would you like to go\?/ })

// Changes the in-browser demo data directly, for situations the seed doesn't have (a huge list of places,
// a driver who changed their vehicle). The app reads it fresh on the next page load or request.
async function editDemoData(page: Page, edit: string) {
  await page.evaluate((body) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('careride-db-'))
    if (!key) throw new Error('No demo data saved yet')
    const db = JSON.parse(localStorage.getItem(key)!)
    new Function('db', body)(db)
    localStorage.setItem(key, JSON.stringify(db))
  }, edit)
}

async function expectNoSideways(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'the page should not scroll sideways').toBeLessThanOrEqual(0)
}

async function send(page: Page, label = 'Request ride', heading = 'Ride requested') {
  await page.getByRole('button', { name: label }).click()
  await expect(page.getByRole('status').getByRole('heading', { name: heading })).toBeVisible()
}

test.describe('Request a ride', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, accounts.belkin)
  })

  test('frequent places come first, and choosing one folds the list into the route', async ({ page }) => {
    await page.goto(NEW_RIDE)
    const frequent = page.getByRole('list', { name: 'Frequent from Belkin House' })
    await expect(frequent.getByRole('radio')).toHaveCount(2)
    await expect(frequent.getByRole('radio').first()).toHaveAccessibleName(/^St\. Paul's Hospital.*2 rides/)
    await expect(frequent.getByRole('radio').nth(1)).toHaveAccessibleName(/^Vancouver General Hospital.*1 ride/)
    // The rest are in one list, without repeating the frequent ones
    await expect(page.getByRole('list', { name: /^All saved places/ }).getByRole('radio')).toHaveCount(9)
    await expect(summary(page)).toContainText('Not chosen yet')

    await page.getByText("St. Paul's Hospital", { exact: true }).click()
    await expect(where(page).getByRole('radio')).toHaveCount(0)
    await expect(where(page)).toContainText("St. Paul's Hospital1081 Burrard St, Vancouver")
    await expect(summary(page).getByRole('list', { name: 'Route' })).toContainText("St. Paul's Hospital")
    await expect(summary(page)).toContainText('Ready to send')

    // Changing it keeps everything else; keeping it closes the list again
    await page.getByLabel('Passenger 1 name').fill('Avery Test (Fictional)')
    await page.getByRole('button', { name: 'Change destination' }).click()
    await expect(search(page)).toBeFocused()
    await expect(page.getByRole('radio', { name: /^St\. Paul's Hospital/ })).toBeChecked()
    await page.getByRole('button', { name: "Keep St. Paul's Hospital" }).click()
    await expect(page.getByRole('button', { name: 'Change destination' })).toBeFocused()
    await expect(page.getByLabel('Passenger 1 name')).toHaveValue('Avery Test (Fictional)')
  })

  test('searching narrows saved places by name or address, and Enter takes the best match', async ({ page }) => {
    await page.goto(NEW_RIDE)
    await search(page).fill('st pauls')
    await expect(page.getByRole('radio', { name: /^St\. Paul's Hospital/ })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Saved places' }).getByRole('radio')).toHaveCount(1)

    await search(page).fill('12th ave')
    await expect(page.getByRole('list', { name: 'Saved places' }).getByRole('radio')).toHaveCount(2)

    await search(page).fill('nowhere at all')
    await expect(where(page)).toContainText('No saved place matches “nowhere at all”.')
    await expect(page.getByRole('radio', { name: /^Somewhere else/ })).toHaveAccessibleName(/Search all addresses for “nowhere at all”/)

    await search(page).fill('richmond hosp')
    await search(page).press('Enter')
    await expect(where(page)).toContainText('Richmond Hospital')
    await expect(page.getByRole('button', { name: 'Change destination' })).toBeFocused()
  })

  test('only the keyboard is needed to find and choose a place', async ({ page }) => {
    await page.goto(NEW_RIDE)
    await search(page).focus()
    await page.keyboard.type('hospital')
    await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('radio', { name: /^St\. Paul's Hospital/ })).toBeFocused()
    // Arrow keys move through the places like any radio group, without closing the list
    await page.keyboard.press('ArrowDown')
    const vgh = page.getByRole('radio', { name: /^Vancouver General Hospital/ })
    await expect(vgh).toBeFocused()
    await expect(vgh).toBeChecked()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/new$/) // Enter chose the place; it didn't send the form
    await expect(where(page)).toContainText('Vancouver General Hospital')
    await expect(page.getByRole('button', { name: 'Change destination' })).toBeFocused()
    // Escape leaves the list as it was
    await page.keyboard.press('Enter')
    await expect(search(page)).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Change destination' })).toBeFocused()
  })

  test('an address that is not saved is found with the address search', async ({ page }) => {
    // The address search (Photon) is outside the test server, so it answers from here
    await page.route('https://photon.komoot.io/**', (route) =>
      route.fulfill({
        json: {
          features: [
            {
              properties: {
                osm_type: 'W',
                osm_id: 42,
                name: 'Mount Saint Joseph Hospital',
                housenumber: '3080',
                street: 'Prince Edward Street',
                city: 'Vancouver',
                postcode: 'V5V 3X6',
                countrycode: 'CA',
              },
            },
          ],
        },
      }),
    )
    await page.goto(NEW_RIDE)
    await search(page).fill('3080 Prince Edward')
    await search(page).press('Enter') // nothing saved matches, so Enter searches every address
    const address = page.getByRole('combobox', { name: /^Search any address/ })
    await expect(address).toBeFocused()
    await expect(address).toHaveValue('3080 Prince Edward')

    // Typing alone isn't enough: the address has to be picked so the driver can find it
    await page.getByRole('button', { name: 'Request ride' }).click()
    await expect(page.getByText('Pick a matching address from the list, so the driver can find it.')).toBeVisible()

    await page.getByRole('option', { name: /Mount Saint Joseph Hospital/ }).click()
    await expect(where(page)).toContainText('Mount Saint Joseph Hospital3080 Prince Edward Street, Vancouver')
    await expect(summary(page)).toContainText('Mount Saint Joseph Hospital')
    await page.getByRole('group', { name: 'Quick picks' }).getByRole('button', { name: 'Tomorrow, 9 AM' }).click()
    await send(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Ride to Mount Saint Joseph Hospital' })).toBeVisible()
  })

  test('a long list of places with long names stays compact and searchable', async ({ page }) => {
    const long = 'The Very Long Named Downtown Community Health and Wellness Centre for Families, Elders and Newcomers (East Wing)'
    await editDemoData(
      page,
      `for (let i = 1; i <= 150; i++) db.destinations.push({ id: 'dest-bulk-' + i, orgId: 'org-belkin', name: 'Community place ' + i, address: i + ' Main St', city: 'Vancouver' })
       db.destinations.push({ id: 'dest-long', orgId: 'org-belkin', name: ${JSON.stringify(long)}, address: '1234 Extraordinarily Long Boulevard Name Northwest, Suite 5600', city: 'Vancouver' })`,
    )
    await page.goto(NEW_RIDE)
    const all = page.getByRole('list', { name: /^All saved places · 160/ })
    await expect(all.getByRole('radio')).toHaveCount(160)
    // The list scrolls inside itself instead of making the page 160 rows long
    const box = await all.boundingBox()
    expect(box!.height).toBeLessThan(340)
    await expect(page.getByRole('region', { name: 'When do you need the ride?' })).toBeVisible()

    await search(page).fill('community place 149')
    await expect(page.getByRole('list', { name: 'Saved places' }).getByRole('radio')).toHaveCount(1)
    await search(page).fill('newcomers')
    await search(page).press('Enter')
    await expect(where(page)).toContainText(long)
    await expect(summary(page)).toContainText(long)

    // On a small phone (a fresh load, as the shell lays itself out on arrival). The draft keeps the choice.
    await page.setViewportSize({ width: 360, height: 740 })
    await page.reload()
    await expect(where(page)).toContainText(long)
    await expectNoSideways(page)
  })

  test('scheduling for another day uses the calendar, and the summary follows', async ({ page }) => {
    await page.goto(NEW_RIDE)
    await pickDestination(page, /^Vancouver General Hospital/)
    await expect(page.getByRole('button', { name: 'In 2 hours' })).toHaveAttribute('aria-pressed', 'true')
    await expect(summary(page)).toContainText('Today at 12:00 PM')

    await page.getByRole('button', { name: 'Another time' }).click()
    await page.getByRole('button', { name: /^Wednesday, October 7/ }).click()
    await page.getByRole('group', { name: /^Times on Wednesday/ }).getByRole('button', { name: '2:00 PM', exact: true }).click()
    await expect(summary(page)).toContainText('Wed, Oct 7 at 2:00 PM')
    await expect(page.getByRole('region', { name: 'When do you need the ride?' })).toContainText('Pickup Wed, Oct 7 at 2:00 PM')

    await choose(page.getByRole('radio', { name: /^As soon as possible/ }))
    await expect(summary(page)).toContainText('As soon as possible')
    await expect(page.getByText(/If nobody accepts within \d+ minutes/)).toBeVisible()
    await choose(page.getByRole('radio', { name: /^Schedule for later/ }))
    await expect(summary(page)).toContainText('Wed, Oct 7 at 2:00 PM')
    await send(page)
  })

  test('passengers, accessibility needs and driver matches update together', async ({ page }) => {
    await page.goto(NEW_RIDE)
    await pickDestination(page, /^St\. Paul's Hospital/)
    await expect(summary(page)).toContainText('3 drivers can take this ride')
    await expect(summary(page)).toContainText('Nobody has accepted yet')

    await page.getByRole('button', { name: 'One more person' }).click()
    await page.getByRole('button', { name: 'One more person' }).click()
    await expect(page.getByRole('textbox', { name: /^Passenger \d name$/ })).toHaveCount(3)
    await page.getByLabel('Passenger 2 name').fill('Riley')
    await expect(summary(page)).toContainText('3 passengers')
    await expect(summary(page)).toContainText('Riley')

    // Only one demo driver has an accessible vehicle
    await page.getByText('Wheelchair accessible', { exact: true }).click()
    await expect(page.getByRole('checkbox', { name: /^Wheelchair accessible/ })).toBeChecked()
    await expect(summary(page).getByText('Wheelchair', { exact: true })).toBeVisible()
    await expect(summary(page)).toContainText('1 driver can take this ride')
    await page.getByText('Help getting in and out', { exact: true }).click()
    await expect(summary(page).getByText('Help in and out', { exact: true })).toBeVisible()

    // Six seats is the most any vehicle has
    for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'One more person' }).click()
    await expect(page.getByRole('button', { name: 'One more person' })).toBeDisabled()
    await send(page)
    await expect(page.getByText('6 passengers').first()).toBeVisible()
  })

  test('with no driver who fits, staff are told why and can still send', async ({ page }) => {
    await editDemoData(page, `db.drivers.forEach((d) => (d.wheelchairAccessible = false))`)
    await page.goto(NEW_RIDE)
    await pickDestination(page, /^St\. Paul's Hospital/)
    await page.getByText('Wheelchair accessible', { exact: true }).click()
    await expect(summary(page)).toContainText('No driver fits this ride right now: no wheelchair-accessible driver is free at this time.')
    await expect(page.getByRole('region', { name: 'Who is travelling?' })).toContainText('Heads up: no wheelchair-accessible driver is free')
    await send(page)
  })

  test('sending with something missing says what, and goes to it', async ({ page }) => {
    await page.goto(NEW_RIDE)
    await expect(summary(page)).toContainText('Still needed')
    await page.getByRole('button', { name: 'Request ride' }).click()
    await expect(page.getByText('Choose where the client is going.')).toBeVisible()
    await expect(search(page)).toBeFocused()
    await expect(summary(page)).toContainText('Fix before sending')
    await expect(page).toHaveURL(/\/new$/)

    // The summary's links go straight to the field
    await page.getByRole('button', { name: 'Request ride' }).focus()
    await summary(page).getByRole('button', { name: 'Destination' }).click()
    await expect(search(page)).toBeFocused()

    await pickDestination(page, /^St\. Paul's Hospital/)
    await expect(summary(page)).toContainText('Ready to send')
  })

  test('driver notes fold away without being lost', async ({ page }) => {
    await page.goto(NEW_RIDE)
    const toggle = page.getByRole('button', { name: /^Notes for the driver/ })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toContainText('Meets: Driver meets the client in the front lobby.')
    await toggle.click()
    await expect(page.getByLabel('Where the driver meets the client')).toHaveValue('Driver meets the client in the front lobby.')
    await notes(page).fill('Uses a walker.')
    await toggle.click()
    await expect(toggle).toContainText('Note added')
    await toggle.click()
    await expect(notes(page)).toHaveValue('Uses a walker.')
  })

  test('an unsent request survives a refresh, and Start over clears it', async ({ page }) => {
    await page.goto(NEW_RIDE)
    await pickDestination(page, /^Vancouver General Hospital/)
    await page.getByRole('group', { name: 'Quick picks' }).getByRole('button', { name: 'Tomorrow, 1 PM' }).click()
    await page.getByLabel('Passenger 1 name').fill('Quinn')
    await page.reload()

    await expect(page.getByText("We kept the request you hadn't sent yet.")).toBeVisible()
    await expect(where(page)).toContainText('Vancouver General Hospital')
    await expect(page.getByRole('button', { name: 'Tomorrow, 1 PM' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Passenger 1 name')).toHaveValue('Quinn')

    await page.getByRole('button', { name: 'Start over' }).click()
    await expect(page.getByText("We kept the request you hadn't sent yet.")).toBeHidden()
    await expect(search(page)).toBeVisible()
    await expect(page.getByLabel('Passenger 1 name')).toHaveValue('')
    await page.reload()
    await expect(page.getByText("We kept the request you hadn't sent yet.")).toBeHidden()
  })

  test('a sent request leaves no draft behind', async ({ page }) => {
    await bookRide(page, { destination: /^St\. Paul's Hospital/, when: 'Tomorrow, 9 AM', passenger: 'Drew' })
    await page.goto(NEW_RIDE)
    await expect(page.getByText("We kept the request you hadn't sent yet.")).toBeHidden()
    await expect(page.getByLabel('Passenger 1 name')).toHaveValue('')
  })

  test('booking an old ride again copies its place and riders', async ({ page }) => {
    await page.goto('/workspace/transportation/rides/ride-past-3')
    await page.getByRole('link', { name: 'Book this ride again' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Book this ride again' })).toBeVisible()
    await expect(where(page)).toContainText('Vancouver General Hospital')
    await expect(page.getByRole('button', { name: 'Change destination' })).toBeVisible()
    await send(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Ride to Vancouver General Hospital' })).toBeVisible()
  })

  test('a return trip runs the route backwards, with nothing to choose', async ({ page }) => {
    await page.goto('/workspace/transportation/rides/ride-past-3')
    await page.getByRole('link', { name: 'Book the return trip' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Book the return trip' })).toBeVisible()
    const route = where(page).getByRole('list', { name: 'Route' })
    await expect(route.getByRole('listitem').first()).toContainText('PickupVancouver General Hospital')
    await expect(route.getByRole('listitem').last()).toContainText('Drop-offBelkin House')
    await expect(search(page)).toHaveCount(0)
    await expect(summary(page).getByRole('list', { name: 'Route' })).toContainText('Vancouver General Hospital')
    await send(page, 'Book return trip')
    await expect(page.getByRole('heading', { level: 1, name: 'Ride to Belkin House' })).toBeVisible()
  })

  test('editing a ride keeps its details and can move it to another place', async ({ page }) => {
    await bookRide(page, { destination: /^St\. Paul's Hospital/, when: 'Tomorrow, 1 PM', passenger: 'Jamie Test (Fictional)' })
    await page.getByRole('link', { name: 'Change details' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Change this ride' })).toBeVisible()
    await expect(where(page)).toContainText("St. Paul's Hospital")
    await expect(page.getByLabel('Passenger 1 name')).toHaveValue('Jamie Test (Fictional)')
    await expect(page.getByRole('button', { name: 'Tomorrow, 1 PM' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('link', { name: 'Keep the ride as it was' })).toBeVisible()

    await page.getByRole('button', { name: 'Change destination' }).click()
    await search(page).fill('vancouver general')
    await search(page).press('Enter')
    await send(page, 'Save changes', 'Changes saved')
    await expect(page.getByRole('heading', { level: 1, name: 'Ride to Vancouver General Hospital' })).toBeVisible()
  })

  test('a failed send keeps the form and can be tried again', async ({ page }) => {
    await page.goto(NEW_RIDE)
    await pickDestination(page, /^St\. Paul's Hospital/)
    await page.getByRole('button', { name: 'One more person' }).click()
    await page.getByRole('button', { name: 'One more person' }).click()
    // Behind the form's back, every vehicle loses its back seats, so the service turns the booking down
    await editDemoData(page, `db.drivers.forEach((d) => (d.seats = 2))`)
    await page.getByRole('button', { name: 'Request ride' }).click()
    const alert = page.getByRole('alert').filter({ hasText: "We couldn't send this ride." })
    await expect(alert).toContainText('A ride can take up to 2 passengers.')
    await expect(page).toHaveURL(/\/new$/)
    await expect(page.getByRole('button', { name: 'Request ride' })).toBeEnabled()
    await expect(where(page)).toContainText("St. Paul's Hospital")

    await page.getByRole('button', { name: 'One fewer person' }).click()
    await send(page)
  })

  test('pressing send twice books one ride', async ({ page }) => {
    await page.goto(NEW_RIDE)
    await pickDestination(page, /^St\. Paul's Hospital/)
    await page.getByLabel('Passenger 1 name').fill('Casey Test (Fictional)')
    await page.getByRole('button', { name: 'Request ride' }).dblclick()
    await expect(page.getByRole('status').getByRole('heading', { name: 'Ride requested' })).toBeVisible()
    await page.goto('/workspace/requests')
    // Belkin House has no open rides before this one
    await expect(page.getByRole('row').filter({ hasText: "St. Paul's Hospital" })).toHaveCount(1)
  })
})

test.describe('Request a ride on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })

  test('books from the bar at the bottom of the screen, without sideways scrolling', async ({ page }) => {
    await signIn(page, accounts.belkin)
    await page.goto(NEW_RIDE)
    await expectNoSideways(page)
    const bar = page.locator('.native-bottom-chrome')
    await expect(bar).toContainText('Still needed: Destination')
    await expect(bar.getByRole('button', { name: 'Request ride' })).toBeInViewport()

    await page.getByText("St. Paul's Hospital", { exact: true }).tap()
    await expect(page.getByRole('button', { name: 'Change destination' })).toBeVisible()
    await expect(bar).toContainText('Ready to send')
    await expect(bar).toContainText("To St. Paul's Hospital · 1 passenger")

    // The summary sits after the form on phones; the bar takes you to it
    await bar.getByRole('button', { name: /^Review your ride/ }).tap()
    await expect(page.getByRole('heading', { name: 'Your ride' })).toBeFocused()
    await expectNoSideways(page)

    await bar.getByRole('button', { name: 'Request ride' }).tap()
    await expect(page.getByRole('status').getByRole('heading', { name: 'Ride requested' })).toBeVisible()
  })

  test('the bottom bar steps aside while typing', async ({ page }) => {
    await signIn(page, accounts.belkin)
    await page.goto(NEW_RIDE)
    const bar = page.locator('.native-bottom-chrome')
    await search(page).focus()
    await expect(bar).toBeHidden()
    await search(page).blur()
    await expect(bar).toBeVisible()
  })
})
