import type { Locator, Page } from '@playwright/test'
import { accounts, expect, signIn, test } from './fixtures'
import { choose } from './helpers'

// General volunteers: people who take part without being CareRide drivers. Priya is seeded with Food
// distribution and Community outreach, and has no driver profile. These check the screens; the database's
// access rules (npm run test:db, tests/db/volunteers.test.ts) are what actually keep interests from granting access.

// Interest cards are checkboxes styled as cards (the input is visually hidden): toggle them from the keyboard
async function toggle(checkbox: Locator): Promise<void> {
  const was = await checkbox.isChecked()
  await checkbox.focus()
  await checkbox.press('Space')
  await expect(checkbox).toBeChecked({ checked: !was })
}

const interest = (page: Page, label: string) => page.getByRole('checkbox', { name: new RegExp(`^${label}`) })

test.describe('general volunteers', () => {
  test('a new person registers as a volunteer with several interests and no vehicle details', { tag: '@critical' }, async ({ page }) => {
    await page.goto('/register')
    await page.getByLabel('Full name').fill('Lee Volunteer (Fictional)')
    await page.getByLabel('Email address').fill('lee.volunteer@example.org')
    await page.getByLabel('Password', { exact: true }).fill('a-long-test-password')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'How would you like to get started?' })).toBeVisible()

    await choose(page.getByRole('radio', { name: /^Join as a volunteer/ }))
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/onboarding\/volunteer$/)

    // Step 1: who they are. The name from sign-up is already there; nothing about a vehicle or licence.
    await expect(page.getByRole('heading', { level: 1, name: 'Join Relay Collective as a volunteer' })).toBeVisible()
    await expect(page.getByText('Share your interests and discover ways to contribute to your community.')).toBeVisible()
    await expect(page.getByLabel('Full name')).toHaveValue('Lee Volunteer (Fictional)')
    for (const driverOnly of [/vehicle/i, /licen[cs]e/i, /service area/i, /seats|spaces/i]) await expect(page.getByLabel(driverOnly)).toHaveCount(0)
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 2: interests. At least one is needed; several can be chosen.
    await expect(page.getByRole('heading', { level: 1, name: 'How would you like to help?' })).toBeVisible()
    await page.getByRole('button', { name: 'Review' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Choose at least one way you’d like to help.' })).toBeVisible()
    await toggle(interest(page, 'Food distribution'))
    await toggle(interest(page, 'Transportation'))
    await toggle(interest(page, 'General volunteering'))
    await page.getByRole('button', { name: 'Review' }).click()

    // Step 3: review, with the honest note about what's available
    await expect(page.getByRole('heading', { level: 1, name: 'Review your details.' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Your volunteering interests' }).getByRole('listitem')).toHaveText([
      'Transportation',
      'Food distribution',
      'General volunteering',
    ])
    await expect(page.getByText('Choosing an interest doesn’t guarantee an opportunity is available.')).toBeVisible()
    await expect(page.getByText('Driving for CareRide is a separate enrollment')).toBeVisible()
    await page.getByRole('button', { name: 'Join as a volunteer' }).click()

    await expect(page.getByRole('heading', { level: 1, name: "You're part of Relay Collective." })).toBeVisible()
    await expect(page.getByText('Your volunteering interests have been saved. You can update them as your interests change.')).toBeVisible()
    await page.getByRole('link', { name: 'Go to my volunteer home' }).click()

    // Their home: a volunteer workspace without driving
    await expect(page).toHaveURL(/\/volunteer$/)
    const saved = page.getByRole('region', { name: 'Your volunteering interests' })
    await expect(saved.getByRole('listitem')).toHaveCount(3)
    await expect(saved).toContainText('Transportation')
    await expect(saved).toContainText('separate enrollment')
    await expect(page.getByRole('region', { name: 'Volunteer profile' })).toContainText('General volunteer')
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'CareRide' })).toHaveCount(0)

    // Still saved after a refresh
    await page.reload()
    await expect(page.getByRole('region', { name: 'Your volunteering interests' }).getByRole('listitem')).toHaveCount(3)
  })

  test('a general volunteer signs in to their own home, without driving pages', { tag: '@smoke' }, async ({ page }) => {
    await signIn(page, accounts.priya)
    await expect(page).toHaveURL(/\/volunteer$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Good morning, Priya.' })).toBeVisible()
    const saved = page.getByRole('region', { name: 'Your volunteering interests' })
    await expect(saved.getByRole('listitem')).toHaveCount(2)
    await expect(saved).toContainText('Food distribution')
    await expect(saved).toContainText('Community outreach')
    await expect(saved).toContainText('Not on Relay Collective yet.')

    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'Volunteering interests' })).toBeVisible()
    for (const driving of ['CareRide', 'Opportunities', 'My commitments', 'Availability', 'My profile']) {
      await expect(nav.getByRole('link', { name: driving, exact: true })).toHaveCount(0)
    }
    // No driver verification banner or prompt for someone who never enrolled
    await expect(page.getByRole('main').getByText(/verification/i)).toHaveCount(0)
  })

  test('interests can be added and removed, and stay saved after a refresh', async ({ page }) => {
    await signIn(page, accounts.priya)
    await page.getByRole('link', { name: 'Update interests' }).click()
    await expect(page).toHaveURL(/\/volunteer\/interests$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Volunteering interests' })).toBeVisible()
    await expect(interest(page, 'Food distribution')).toBeChecked()
    await expect(interest(page, 'Community outreach')).toBeChecked()

    await toggle(interest(page, 'Food distribution')) // remove
    await toggle(interest(page, 'Resource coordination')) // add
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()

    await page.reload()
    await expect(interest(page, 'Food distribution')).not.toBeChecked()
    await expect(interest(page, 'Community outreach')).toBeChecked()
    await expect(interest(page, 'Resource coordination')).toBeChecked()
    await expect(interest(page, 'Transportation')).not.toBeChecked()

    // Removing every interest isn't saved
    await toggle(interest(page, 'Community outreach'))
    await toggle(interest(page, 'Resource coordination'))
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Choose at least one way you’d like to help.' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(interest(page, 'Community outreach')).toBeChecked()
  })

  test('choosing Transportation does not open driving: driver-only pages send a volunteer home', { tag: '@critical' }, async ({ page }) => {
    await signIn(page, accounts.priya)
    await page.goto('/volunteer/interests')
    await toggle(interest(page, 'Transportation'))
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()

    for (const path of [
      '/volunteer/opportunities',
      '/volunteer/commitments',
      '/volunteer/transportation',
      '/volunteer/transportation/rides',
      '/volunteer/availability',
      '/volunteer/profile',
      '/volunteer/profile/verification',
      '/driver',
      '/workspace',
      '/workspace/transportation/new',
      '/admin',
    ]) {
      await page.goto(path)
      await expect(page, `${path} should send a general volunteer home`).toHaveURL(/\/volunteer$/)
    }
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'CareRide' })).toHaveCount(0)
  })

  test('an existing CareRide driver still signs in to their driving workspace', async ({ page }) => {
    await signIn(page, accounts.frank)
    await expect(page.getByRole('heading', { level: 1, name: 'Good morning, Frank.' })).toBeVisible()
    const nav = page.getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link', { name: 'CareRide' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Opportunities' })).toBeVisible()
    await expect(nav.getByRole('link', { name: 'Volunteering interests' })).toHaveCount(0)
    await page.goto('/volunteer/profile/verification')
    await expect(page.getByRole('region', { name: 'Review status' }).getByRole('status')).toHaveText('You’re approved to drive.')
    // The general volunteer's interests page isn't a driver page
    await page.goto('/volunteer/interests')
    await expect(page).toHaveURL(/\/volunteer$/)
  })

  test('platform admins see a general volunteer as a volunteer, not a driver', async ({ page }) => {
    await signIn(page, accounts.admin)
    await page.goto('/admin/users?role=VOLUNTEER')
    const row = page.getByRole('row', { name: /Priya/ })
    await expect(row).toContainText('Volunteer')
    await row.getByRole('link', { name: 'Priya', exact: true }).click()
    const details = page.getByRole('main')
    await expect(details.getByRole('heading', { name: 'Participation' })).toBeVisible()
    await expect(details).toContainText('General volunteer')
    await expect(details).toContainText('Food distribution, Community outreach')
    await expect(page.getByText('Driver profile', { exact: true })).toHaveCount(0)
  })
})
