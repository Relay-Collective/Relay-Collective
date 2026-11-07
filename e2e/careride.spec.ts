import { accounts, expect, signIn, signInInNewTab, test } from './fixtures'
import { bookRide, choose, rideReference } from './helpers'

// CareRide, the transportation module, from the partner organization's side.
// Belkin House starts with three completed rides (Sep 28 – Oct 1) and nothing upcoming.

test.describe('CareRide for a partner organization', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, accounts.belkin)
  })

  test('the transportation overview shows the seeded totals', { tag: '@smoke' }, async ({ page }) => {
    await page.getByRole('link', { name: 'Open CareRide' }).first().click()
    await expect(page).toHaveURL(/\/workspace\/transportation$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Ride overview' })).toBeVisible()

    const moduleNav = page.getByRole('navigation', { name: 'CareRide' })
    for (const link of ['Overview', 'Requests', 'New ride', 'Destinations', 'History']) {
      await expect(moduleNav.getByRole('link', { name: link })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: '3 Completed. Show past rides' })).toBeVisible()
    // Three completed trips, one $2.58 bus fare each
    await expect(page.getByText('$7.74', { exact: true }).first()).toBeVisible()
  })

  test('booking a scheduled ride creates a request that waits for a driver', { tag: '@critical' }, async ({ page }) => {
    const rideId = await bookRide(page, { destination: /^Vancouver General Hospital/, when: 'Tomorrow, 9 AM', passenger: 'Avery Test (Fictional)' })

    await expect(page.getByRole('heading', { level: 1, name: 'Ride to Vancouver General Hospital' })).toBeVisible()
    await expect(page.getByText('Waiting for driver')).toBeVisible()
    await expect(page.getByText('Avery Test (Fictional)').first()).toBeVisible()
    // Every approved driver who fits is asked; Jordan is still pending review, so isn't.
    const asked = page.getByRole('heading', { name: 'Drivers asked' }).locator('+ ul')
    await expect(asked.getByRole('listitem')).toHaveText([/^Frank:/, /^Maya:/, /^Sam:/])

    await page.getByRole('navigation', { name: 'CareRide' }).getByRole('link', { name: 'Requests' }).click()
    await expect(page.getByRole('row', { name: new RegExp(`Ref\\. #${rideReference(rideId)}`) })).toContainText('Vancouver General Hospital')
  })

  test('a past ride opens with its details', async ({ page }) => {
    await page.goto('/workspace/requests?view=past')
    await page.getByRole('link', { name: 'View the ride to Vancouver General Hospital, reference EPAST3' }).click()
    await expect(page).toHaveURL(/\/workspace\/transportation\/rides\/ride-past-3$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Ride to Vancouver General Hospital' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Trip progress' })).toBeVisible()
    await expect(page.getByText('Completed').first()).toBeVisible()
  })

  test('a waiting ride can be changed, and the change is shown', async ({ page }) => {
    await bookRide(page, { destination: /^St\. Paul's Hospital/, when: 'Tomorrow, 1 PM', passenger: 'Jamie Test (Fictional)' })

    await page.getByRole('link', { name: 'Change details' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Change this ride' })).toBeVisible()
    await page.getByRole('button', { name: 'One more person' }).click()
    await page.getByLabel('Passenger 2 name').fill('Riley Test (Fictional)')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByRole('status').getByRole('heading', { name: 'Changes saved' })).toBeVisible()
    await expect(page.getByText('2 passengers').first()).toBeVisible()
  })

  test('history lists completed rides only', async ({ page }) => {
    await bookRide(page, { destination: /^St\. Paul's Hospital/, when: 'Tomorrow, 9 AM', passenger: 'Casey Test (Fictional)' })

    await page.getByRole('navigation', { name: 'CareRide' }).getByRole('link', { name: 'History' }).click()
    await expect(page).toHaveURL(/view=past/)
    await expect(page.getByRole('button', { name: 'Past 3' })).toHaveAttribute('aria-pressed', 'true')
    const rows = page
      .getByRole('table', { name: /^Requests/ })
      .getByRole('rowgroup')
      .nth(1)
      .getByRole('row')
    await expect(rows).toHaveCount(3)
    for (const row of await rows.all()) await expect(row.getByRole('cell').nth(1)).toHaveText('Completed')
    await expect(page.getByText('3 requests')).toBeVisible()
  })

  test('the form refuses a booking with no destination', async ({ page }) => {
    await page.goto('/workspace/transportation/new')
    await page.getByRole('button', { name: 'Request ride' }).click()
    await expect(page.getByText('Choose where the client is going.')).toBeVisible()
    await expect(page).toHaveURL(/\/workspace\/transportation\/new$/)

    // Fixing it lets the booking through
    await choose(page.getByRole('radio', { name: /^St\. Paul's Hospital/ }))
    await expect(page.getByText('Choose where the client is going.')).toBeHidden()
  })
})

// The most important journey: a partner books, a driver accepts and drives it, and both see it finish.
// Both people use tabs in the same browser, so they share the demo data while keeping their own sign-in.
test('a ride goes from request to drop-off across partner and driver', { tag: '@critical' }, async ({ page: partner, context }) => {
  // Two people, about forty steps: give it three times the usual time limit
  test.slow()
  await signIn(partner, accounts.belkin)
  const rideId = await bookRide(partner, { destination: /^St\. Paul's Hospital/, when: 'asap', passenger: 'Morgan Test (Fictional)' })
  await expect(partner.getByText('Waiting for driver')).toBeVisible()

  // Frank takes requests any time and drives in Vancouver, so the matching rules send it to him
  const driver = await signInInNewTab(context, accounts.frank)
  await driver.getByRole('link', { name: /^Requests to answer: 1\./ }).click()
  await expect(driver).toHaveURL(/\/volunteer\/opportunities$/)
  const request = driver.getByRole('article', { name: "St. Paul's Hospital" })
  await expect(request.getByRole('definition').filter({ hasText: 'Belkin House, Vancouver' })).toBeVisible()
  await request.getByRole('button', { name: 'Accept' }).click()
  await expect(driver.getByRole('status').getByText("Ride accepted. It's in your upcoming rides.")).toBeVisible()

  // The partner's page updates by itself
  await partner.bringToFront()
  await expect(partner.getByRole('heading', { name: 'Frank accepted your request and will head over soon.' })).toBeVisible()
  const asked = partner.getByRole('heading', { name: 'Drivers asked' }).locator('+ ul')
  await expect(asked.getByRole('listitem').filter({ hasText: 'Frank' })).toContainText('Accepted')
  await expect(asked.getByRole('listitem').filter({ hasText: 'Maya' })).toContainText('Another driver accepted first')

  // The driver works through each trip step
  await driver.bringToFront()
  await driver.getByRole('link', { name: 'Open the ride' }).click()
  await expect(driver).toHaveURL(new RegExp(`/volunteer/transportation/rides/${rideId}$`))
  const steps = driver.getByRole('list', { name: 'Trip steps' })
  await steps.getByRole('button', { name: "I'm on my way" }).click()
  await expect(steps.getByRole('heading', { name: 'Head to pickup (done)' })).toBeVisible()
  await steps.getByRole('button', { name: "I'm here" }).click()
  await expect(steps.getByRole('heading', { name: 'Arrive at pickup (done)' })).toBeVisible()
  await steps.getByRole('button', { name: 'Client is in the car' }).click()
  await expect(steps.getByRole('heading', { name: 'Client gets in (done)' })).toBeVisible()
  await steps.getByRole('button', { name: 'Client dropped off' }).click()
  await expect(driver.getByRole('list', { name: 'Ride progress' }).getByText('Passenger dropped off (done)')).toBeVisible()

  // The partner sees the finished ride, and it moves to history
  await partner.bringToFront()
  const progress = partner.getByRole('region', { name: 'Trip progress' })
  await expect(progress.getByRole('listitem').filter({ hasText: 'Dropped off' })).toContainText('10:00 AM')
  await partner.goto('/workspace/requests?view=past')
  const row = partner.getByRole('row', { name: new RegExp(`Ref\\. #${rideReference(rideId)}`) })
  await expect(row).toContainText("St. Paul's Hospital")
  await expect(row.getByRole('cell').nth(1)).toHaveText('Completed')
  await expect(partner.getByRole('button', { name: 'Past 4' })).toBeVisible()

  // And the driver's completed count goes up
  await driver.bringToFront()
  await driver.goto('/volunteer')
  await expect(driver.getByRole('link', { name: /^Completed rides: 1\./ })).toBeVisible()
})
