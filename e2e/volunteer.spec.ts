import { accounts, expect, signIn, signInInNewTab, test } from './fixtures'
import { bookRide } from './helpers'

// The volunteer workspace, from Frank's side. Frank is approved, takes requests any time, and drives
// in Vancouver and Richmond.

test.describe('volunteer driver workspace', () => {
  test('the dashboard opens in the volunteer workspace', { tag: '@smoke' }, async ({ page }) => {
    await signIn(page, accounts.frank)
    await expect(page.getByRole('heading', { level: 1, name: 'Good morning, Frank.' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Action required' })).toContainText("You're all caught up.")
    await expect(page.getByRole('link', { name: /^Requests to answer: 0\./ })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Taking requests now' })).toBeVisible()
  })

  test('a request that fits shows up in opportunities, and accepting it makes a commitment', async ({ page: partner, context }) => {
    test.slow()
    await signIn(partner, accounts.belkin)
    await bookRide(partner, { destination: /^Vancouver General Hospital/, when: 'Tomorrow, 9 AM', passenger: 'Quinn Test (Fictional)' })

    const driver = await signInInNewTab(context, accounts.frank)
    await driver.goto('/volunteer/opportunities')
    const request = driver.getByRole('region', { name: 'Transportation requests' }).getByRole('article', { name: 'Vancouver General Hospital' })
    await expect(request.getByRole('definition').filter({ hasText: 'Belkin House, Vancouver' })).toBeVisible()
    await expect(request.getByRole('button', { name: 'Accept' })).toBeEnabled()
    await expect(request.getByRole('button', { name: 'Decline' })).toBeEnabled()
    await request.getByRole('button', { name: 'Accept' }).click()
    await expect(driver.getByText("Ride accepted. It's in your upcoming rides.")).toBeVisible()

    await driver.goto('/volunteer/commitments')
    await expect(driver.getByRole('heading', { level: 1, name: 'My commitments' })).toBeVisible()
    await expect(driver.getByRole('main').getByText('Vancouver General Hospital').first()).toBeVisible()
    await expect(driver.getByText("You don't have any upcoming commitments.")).toHaveCount(0)
  })

  test('declining a request removes it from opportunities', async ({ page: partner, context }) => {
    test.slow()
    await signIn(partner, accounts.belkin)
    await bookRide(partner, { destination: /^St\. Paul's Hospital/, when: 'Tomorrow, 1 PM', passenger: 'Drew Test (Fictional)' })

    const driver = await signInInNewTab(context, accounts.frank)
    await driver.goto('/volunteer/opportunities')
    const requests = driver.getByRole('region', { name: 'Transportation requests' })
    await requests.getByRole('article', { name: "St. Paul's Hospital" }).getByRole('button', { name: 'Decline' }).click()
    await expect(requests.getByText('There are no transportation requests available to you right now.')).toBeVisible()
  })

  test('availability changes are saved and kept', async ({ page }) => {
    await signIn(page, accounts.frank)
    await page.goto('/volunteer/availability')
    const sunday = page.getByRole('switch', { name: 'Requests on Sunday' })
    await expect(sunday).toBeChecked()
    await sunday.click()
    await expect(sunday).not.toBeChecked()

    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()

    await page.reload()
    await expect(page.getByRole('switch', { name: 'Requests on Sunday' })).not.toBeChecked()
    await expect(page.getByRole('switch', { name: 'Requests on Monday' })).toBeChecked()
  })

  test('an unsaved availability change can be cancelled', async ({ page }) => {
    await signIn(page, accounts.frank)
    await page.goto('/volunteer/availability')
    // The city options are cards over a visually hidden checkbox: toggle it from the keyboard
    const richmond = page.getByRole('checkbox', { name: /^Richmond/ })
    await richmond.focus()
    await richmond.press('Space')
    await expect(richmond).not.toBeChecked()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('checkbox', { name: /^Richmond/ })).toBeChecked()
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
  })

  test('verification shows an approved driver as approved, with every requirement complete', async ({ page }) => {
    await signIn(page, accounts.frank)
    await page.goto('/volunteer/profile/verification')
    const status = page.getByRole('region', { name: 'Review status' })
    await expect(status.getByRole('status')).toHaveText('You’re approved to drive.')
    const requirements = status.getByRole('list', { name: 'Verification requirements' }).getByRole('listitem')
    await expect(requirements).toHaveCount(4)
    for (const item of await requirements.all()) await expect(item).toContainText('Complete')
  })
})
