import type { Locator, Page } from '@playwright/test'
import { accounts, expect, signIn, test } from './fixtures'

// The adaptive volunteer workspace (src/volunteer/workspace.ts): one workspace that shows each person what fits how
// they take part. Seeded people used here:
//   Alex Morgan  general volunteer, interested in Transportation and Community outreach, not a driver
//   Priya        general volunteer, Food distribution and Community outreach
//   Maya         approved CareRide driver who also saved interests (Transportation, Food distribution)
//   Frank        approved CareRide driver from before interests existed: no volunteer profile (a legacy account)
//   Jordan       driver still waiting for review
// These check the screens. The database's access rules (npm run test:db) are what keep interests from granting access.

const alex = accounts.alex

const main = (page: Page) => page.getByRole('main')
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })
const interestsRegion = (page: Page) => main(page).getByRole('region', { name: 'Your volunteering interests' })
const interest = (page: Page, label: string) => page.getByRole('checkbox', { name: new RegExp(`^${label}`) })

// Interest cards are checkboxes styled as cards (the input is visually hidden): toggle them from the keyboard
async function toggle(checkbox: Locator): Promise<void> {
  const was = await checkbox.isChecked()
  await checkbox.focus()
  await checkbox.press('Space')
  await expect(checkbox).toBeChecked({ checked: !was })
}

// The sidebar's identity card: the person's name, with how they take part beneath it
async function expectIdentity(page: Page, name: string, label: string) {
  const subtitle = page.getByText(label, { exact: true }).first()
  await expect(subtitle).toBeVisible()
  await expect(subtitle.locator('xpath=..')).toContainText(name)
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'the page should not scroll sideways').toBeLessThanOrEqual(0)
}

test.describe('adaptive volunteer workspace', () => {
  test('a general volunteer’s dashboard is about them, with no driving', { tag: '@smoke' }, async ({ page }) => {
    await signIn(page, alex)
    await expect(page).toHaveURL(/\/volunteer$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Good morning, Alex.' })).toBeVisible()
    await expect(main(page).getByText('Your willingness to help makes a difference. Here’s your volunteering space.')).toBeVisible()
    await expectIdentity(page, 'Alex Morgan', 'Volunteer')

    // Their interests, each with what it means for them today
    const interests = interestsRegion(page)
    await expect(interests.getByText('The ways you’ve chosen to contribute.')).toBeVisible()
    await expect(interests.getByRole('listitem')).toHaveCount(2)
    await expect(interests.getByRole('listitem').filter({ hasText: 'Transportation' })).toContainText('isn’t open to volunteer accounts yet')
    await expect(interests.getByRole('listitem').filter({ hasText: 'Community outreach' })).toContainText('Not on Relay Collective yet')

    // No service yet: said plainly, with CareRide shown as running but not theirs
    const services = main(page).getByRole('region', { name: 'Your services' })
    await expect(services.getByText('Your volunteering journey starts here.')).toBeVisible()
    await expect(services.getByRole('listitem').filter({ hasText: 'CareRide · Transportation' })).toContainText('Not enrolled')

    // Nothing from a driver's dashboard: no alerts, ride numbers, requests or commitments
    for (const driving of ['Action required', 'CareRide', 'Upcoming commitments', 'Available opportunities', 'Your impact']) {
      await expect(main(page).getByRole('region', { name: driving, exact: true })).toHaveCount(0)
    }
    await expect(main(page).getByText(/caught up|verification|vehicle/i)).toHaveCount(0)

    // Navigation for a general volunteer, every link working
    await expect(nav(page).getByRole('link')).toHaveText(['Overview', 'My interests', 'My profile', 'Settings'])
    for (const [link, heading] of [
      ['My interests', 'Volunteering interests'],
      ['My profile', 'My profile'],
      ['Settings', 'Settings'],
    ]) {
      await nav(page).getByRole('link', { name: link, exact: true }).click()
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expect(nav(page).getByRole('link', { name: link, exact: true })).toHaveAttribute('aria-current', 'page')
    }
    // The sidebar's footer: help for their workspace, and their feedback
    for (const [link, heading] of [
      ['Help', 'Help'],
      ['My feedback', 'My feedback'],
    ]) {
      // The sidebar comes before the page in the document; the Help page links to My feedback too
      await page.getByRole('link', { name: link, exact: true }).first().click()
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    }
  })

  test('a general volunteer’s profile keeps interests and service participation apart, with no transportation details', async ({ page }) => {
    await signIn(page, alex)
    await page.goto('/volunteer/profile')
    await expect(main(page).getByRole('region', { name: 'Personal information' })).toContainText('alex@careride.demo')
    await expect(interestsRegion(page).getByRole('listitem')).toHaveCount(2)
    const participation = main(page).getByRole('region', { name: 'Service participation' })
    await expect(participation).toContainText('You’re not enrolled in a service yet.')
    await expect(participation).toContainText('Not enrolled')
    for (const driving of ['Transportation details', 'Driver verification', 'No transportation profile']) {
      await expect(main(page).getByRole('heading', { name: driving })).toHaveCount(0)
    }
    await expect(main(page).getByText(/vehicle/i)).toHaveCount(0)

    // Help talks about their workspace, not rides
    await page.goto('/volunteer/help')
    await expect(main(page).getByRole('region', { name: 'Finding your way' })).toContainText('My interests')
    await expect(main(page).getByRole('region', { name: 'Ride statuses' })).toHaveCount(0)
  })

  test('a volunteer with no saved interests sees an empty state that leads to choosing some', async ({ page }) => {
    await signIn(page, accounts.priya)
    // Interests can't be emptied through the app or the database; this stands in for data from an older or partial save
    await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.startsWith('careride-db-'))!
      const db = JSON.parse(localStorage.getItem(key)!)
      for (const p of db.volunteerProfiles) if (p.userId === 'u-priya') p.interests = []
      localStorage.setItem(key, JSON.stringify(db))
    })
    await page.reload()
    const interests = interestsRegion(page)
    await expect(interests.getByText('No interests saved yet')).toBeVisible()
    await expect(interests.getByRole('listitem')).toHaveCount(0)
    await interests.getByRole('link', { name: 'Choose interests' }).click()
    await expect(page).toHaveURL(/\/volunteer\/interests$/)
    await toggle(interest(page, 'General volunteering'))
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()
    await nav(page).getByRole('link', { name: 'Overview' }).click()
    await expect(interestsRegion(page).getByRole('listitem')).toHaveText([/^General volunteering/])
  })

  test('interest changes are saved, shown everywhere, and kept after a refresh', async ({ page }) => {
    await signIn(page, alex)
    await interestsRegion(page).getByRole('link', { name: 'Manage interests' }).click()
    await expect(interest(page, 'Transportation')).toBeChecked()
    await expect(interest(page, 'Community outreach')).toBeChecked()

    await toggle(interest(page, 'Transportation')) // remove
    await toggle(interest(page, 'Food distribution')) // add
    await toggle(interest(page, 'Resource coordination')) // add
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('status').or(page.getByText('Changes saved.')).first()).toBeVisible()
    await expect(page.getByText('Changes saved.')).toBeVisible()

    await page.reload()
    await expect(interest(page, 'Transportation')).not.toBeChecked()
    for (const kept of ['Food distribution', 'Community outreach', 'Resource coordination']) await expect(interest(page, kept)).toBeChecked()

    await nav(page).getByRole('link', { name: 'Overview' }).click()
    await expect(interestsRegion(page).getByRole('listitem')).toHaveText([/^Food distribution/, /^Community outreach/, /^Resource coordination/])
    await nav(page).getByRole('link', { name: 'My profile' }).click()
    await expect(interestsRegion(page).getByRole('listitem')).toHaveCount(3)
  })

  test('an approved CareRide driver keeps the full driving dashboard, with their interests beside it', { tag: '@critical' }, async ({ page }) => {
    await signIn(page, accounts.maya)
    await expect(page.getByRole('heading', { level: 1, name: 'Good morning, Maya.' })).toBeVisible()
    await expect(main(page).getByText("Your time makes a difference. Here's what's happening in your workspace.")).toBeVisible()
    await expectIdentity(page, 'Maya', 'Professional transportation provider')

    await expect(main(page).getByRole('region', { name: 'Action required' })).toContainText("You're all caught up.")
    const careRide = main(page).getByRole('region', { name: 'CareRide' })
    for (const metric of [/^Requests to answer: 0\./, /^Under way: 0\./, /^Upcoming rides: 0\./, /^Completed rides: 3\./]) {
      await expect(careRide.getByRole('link', { name: metric })).toBeVisible()
    }
    await expect(main(page).getByRole('region', { name: 'Upcoming commitments' })).toBeVisible()
    await expect(main(page).getByRole('region', { name: 'Available opportunities' })).toBeVisible()
    await expect(main(page).getByRole('heading', { name: 'Taking requests now' })).toBeVisible()
    await expect(main(page).getByRole('region', { name: 'Your impact' })).toBeVisible()

    // Interests sit beside driving, and Transportation reflects that she actually drives
    await expect(interestsRegion(page).getByRole('listitem').filter({ hasText: 'Transportation' })).toContainText('You drive with CareRide.')

    // Every driving destination is still there and works
    await expect(nav(page).getByRole('link')).toHaveText([
      'Overview',
      /^Opportunities/,
      'My commitments',
      'CareRide',
      'Availability',
      'My interests',
      'My profile',
      'Settings',
    ])
    for (const [link, heading] of [
      ['Opportunities', 'Opportunities'],
      ['My commitments', 'My commitments'],
      ['Availability', 'Availability'],
      ['CareRide', 'CareRide'],
    ]) {
      await nav(page)
        .getByRole('link', { name: new RegExp(`^${link}`) })
        .click()
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    }

    // The profile keeps transportation details and verification, now with interests and participation
    await nav(page).getByRole('link', { name: 'My profile' }).click()
    await expect(main(page).getByRole('region', { name: 'Transportation details' })).toBeVisible()
    await expect(main(page).getByRole('textbox', { name: /vehicle/i })).toHaveValue('White sedan')
    const participation = main(page).getByRole('region', { name: 'Service participation' })
    await expect(participation).toContainText('Professional transportation provider')
    await expect(participation).toContainText('Approved')
    await expect(interestsRegion(page).getByRole('listitem')).toHaveCount(2)
  })

  test('removing Transportation from a driver’s interests leaves driving untouched', async ({ page }) => {
    await signIn(page, accounts.maya)
    await page.goto('/volunteer/interests')
    await expect(main(page).getByText('removing Transportation doesn’t affect your rides')).toBeVisible()
    await toggle(interest(page, 'Transportation'))
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()
    await nav(page).getByRole('link', { name: 'Overview' }).click()
    await expect(main(page).getByRole('region', { name: 'CareRide' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: /^Opportunities/ })).toBeVisible()
    await page.goto('/volunteer/profile/verification')
    await expect(page.getByRole('region', { name: 'Review status' }).getByRole('status')).toHaveText('You’re approved to drive.')
  })

  test('a driver waiting for review sees their status, and requests stay closed', async ({ page }) => {
    await signIn(page, accounts.jordan)
    await expect(page.getByText('Your account is waiting for approval from the Relay Collective team.')).toBeVisible()
    await expect(main(page).getByText('Your driver application is currently under review.')).toBeVisible()
    await expect(nav(page).getByRole('link', { name: /^Opportunities/ })).toHaveCount(0)
    await expect(nav(page).getByRole('link', { name: 'My commitments' })).toHaveCount(0)
    await expect(nav(page).getByRole('link', { name: 'CareRide' })).toBeVisible()
    // Opening the requests page directly explains instead of showing requests
    await page.goto('/volunteer/opportunities')
    await expect(page.getByRole('heading', { name: 'Your driver application is currently under review.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0)
    await page.goto('/volunteer/profile')
    await expect(main(page).getByRole('region', { name: 'Service participation' })).toContainText('Pending')
  })

  test('typing a CareRide address doesn’t get a general volunteer in, even with Transportation chosen', { tag: '@critical' }, async ({ page }) => {
    await signIn(page, alex) // interested in Transportation
    for (const path of [
      '/volunteer/opportunities',
      '/volunteer/commitments',
      '/volunteer/transportation',
      '/volunteer/transportation/rides',
      '/volunteer/transportation/rides/ride-past-1',
      '/volunteer/availability',
      '/volunteer/profile/verification',
      '/driver',
      '/driver/my-rides',
    ]) {
      await page.goto(path)
      await expect(page, `${path} should send a general volunteer home`).toHaveURL(/\/volunteer$/)
      await expect(page.getByRole('heading', { level: 1, name: 'Good morning, Alex.' })).toBeVisible()
    }
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0)
  })

  test('a driver from before interests existed keeps working, and can add interests without changing driving', async ({ page }) => {
    await signIn(page, accounts.frank)
    await expect(page.getByRole('heading', { level: 1, name: 'Good morning, Frank.' })).toBeVisible()
    await expect(main(page).getByRole('region', { name: 'CareRide' })).toBeVisible()
    await expectIdentity(page, 'Frank', 'Professional transportation provider')
    // No volunteer profile: an invitation, not an error, and nothing is created by just looking
    await expect(interestsRegion(page).getByText('No interests saved yet')).toBeVisible()
    await page.goto('/volunteer/profile')
    await expect(main(page).getByRole('region', { name: 'Transportation details' })).toBeVisible()

    await interestsRegion(page).getByRole('link', { name: 'Choose interests' }).click()
    await expect(main(page).getByText('Besides driving, choose any other ways you’d like to help.')).toBeVisible()
    await toggle(interest(page, 'Community outreach'))
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()
    await page.reload()
    await expect(interest(page, 'Community outreach')).toBeChecked()

    await nav(page).getByRole('link', { name: 'Overview' }).click()
    await expect(interestsRegion(page).getByRole('listitem')).toHaveText([/^Community outreach/])
    await expect(nav(page).getByRole('link', { name: /^Opportunities/ })).toBeVisible()
    await expectIdentity(page, 'Frank', 'Professional transportation provider')
  })
})

test.describe('adaptive volunteer workspace on smaller screens', () => {
  for (const [size, viewport] of [
    ['a phone', { width: 390, height: 844 }],
    ['a tablet', { width: 820, height: 1180 }],
  ] as const) {
    test.describe(`on ${size}`, () => {
      test.use({ viewport, hasTouch: true, isMobile: size === 'a phone' })

      // Phones have a tab bar along the bottom; from tablet width up, the sidebar is always there instead
      const phone = size === 'a phone'
      const links = (page: Page) => (phone ? page.getByRole('navigation', { name: 'Quick' }) : nav(page)).getByRole('link')

      test('a general volunteer gets only their own destinations, and nothing scrolls sideways', async ({ page }) => {
        await signIn(page, alex)
        await expect(interestsRegion(page).getByRole('listitem')).toHaveCount(2)
        await expect(links(page)).toHaveText(phone ? ['Overview', 'Interests', 'Profile'] : ['Overview', 'My interests', 'My profile', 'Settings'])
        await expectNoSidewaysScroll(page)
        await links(page)
          .filter({ hasText: /interests/i })
          .click()
        await expect(page.getByRole('heading', { level: 1, name: 'Volunteering interests' })).toBeVisible()
        await expectNoSidewaysScroll(page)
        await links(page)
          .filter({ hasText: /profile/i })
          .click()
        await expect(page.getByRole('heading', { level: 1, name: 'My profile' })).toBeVisible()
        await expectNoSidewaysScroll(page)
      })

      test('a driver keeps one-tap access to requests and rides', async ({ page }) => {
        await signIn(page, accounts.maya)
        if (phone) await expect(links(page)).toHaveText(['Overview', /^Requests/, 'Rides', 'Availability', 'Profile'])
        else
          for (const link of [/^Opportunities/, 'My commitments', 'CareRide', 'Availability'])
            await expect(links(page).filter({ hasText: link })).toBeVisible()
        await expect(main(page).getByRole('region', { name: 'CareRide' })).toBeVisible()
        await expectNoSidewaysScroll(page)
        await links(page)
          .filter({ hasText: phone ? 'Rides' : 'CareRide' })
          .click()
        await expect(page.getByRole('heading', { level: 1, name: 'CareRide' })).toBeVisible()
        await expectNoSidewaysScroll(page)
      })
    })
  }
})
