import type { Locator, Page } from '@playwright/test'
import { accounts, expect, signIn, signInInNewTab, test } from './fixtures'
import { bookRide } from './helpers'

// CareRide driver enrollment for an existing general volunteer (Phase 3, docs/architecture/volunteers.md).
// Priya is a seeded general volunteer (Food distribution, Community outreach) with no phone and no driver profile.
// She applies from her own workspace, on the same account, and only an admin's approval lets her drive.
// The database rules behind each step are tested in tests/db/careRideEnrollment.test.ts.

const priya = accounts.priya

const main = (page: Page) => page.getByRole('main')
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })
const heading = (page: Page, name: string) => page.getByRole('heading', { level: 1, name })
const enrollCard = (page: Page) => main(page).getByRole('region', { name: 'Drive with CareRide' })
const interestsRegion = (page: Page) => main(page).getByRole('region', { name: 'Your volunteering interests' })

// Checkbox cards hide the real input: use them the way a keyboard user does
async function check(box: Locator): Promise<void> {
  await box.focus()
  await box.press('Space')
  await expect(box).toBeChecked()
}

async function openApplication(page: Page) {
  await enrollCard(page).getByRole('link', { name: 'Apply to drive' }).click()
  await expect(page).toHaveURL(/\/volunteer\/careride\/apply$/)
  await expect(heading(page, 'Drive with CareRide.')).toBeVisible()
}

// Every step, with valid answers. Leaves the page on the confirmation.
async function completeApplication(page: Page) {
  await openApplication(page)
  await page.getByRole('button', { name: 'Start application' }).click()

  await expect(heading(page, 'Confirm your details.')).toBeVisible()
  await page.getByLabel('Mobile phone').fill('604-555-0177')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(heading(page, 'Tell us about your vehicle.')).toBeVisible()
  await page.getByLabel('Vehicle colour and type').fill('Green hatchback (Fictional)')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(heading(page, 'Where can you drive?')).toBeVisible()
  await check(page.getByRole('checkbox', { name: /^Vancouver/ }))
  await page.getByRole('button', { name: 'Continue' }).click()

  // The weekday daytime preset is already chosen, so Monday morning requests reach her
  await expect(heading(page, 'When should we send you ride requests?')).toBeVisible()
  await page.getByRole('button', { name: 'Review' }).click()

  await expect(heading(page, 'Review your application.')).toBeVisible()
  await page.getByRole('checkbox', { name: /valid driver's licence/ }).check()
  await page.getByRole('button', { name: 'Submit application' }).click()
  await expect(heading(page, 'Your CareRide application has been submitted.')).toBeVisible()
}

// The admin console's existing driver review, in a second tab
async function decide(page: Page, decision: 'Approve' | 'Reject'): Promise<Page> {
  const admin = await signInInNewTab(page.context(), accounts.admin)
  await admin.goto('/admin/approvals')
  const table = admin.getByRole('table', { name: /^Applications/ })
  await expect(table.getByRole('row').filter({ hasText: 'Priya' })).toContainText('Driver verification · existing volunteer')
  await table.getByRole('link', { name: 'Priya' }).first().click()
  await expect(admin.getByRole('region', { name: 'Submitted information' })).toContainText('Existing volunteer, from their workspace')
  await expect(admin.getByRole('region', { name: 'Submitted information' })).toContainText('Green hatchback (Fictional)')
  const region = admin.getByRole('region', { name: 'Decision' })
  await region.getByRole('button', { name: decision }).click()
  await admin
    .getByRole('dialog')
    .getByRole('button', { name: new RegExp(`^${decision} `) })
    .click()
  await expect(region.getByText(decision === 'Approve' ? 'Priya was approved.' : 'Priya was marked not approved.')).toBeVisible()
  return admin
}

async function expectInterestsKept(page: Page) {
  await page.goto('/volunteer/interests')
  await expect(page.getByRole('checkbox', { name: /^Food distribution/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /^Community outreach/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /^Transportation/ })).not.toBeChecked()
}

test.describe('CareRide enrollment for a general volunteer', () => {
  test('a general volunteer applies on the same account, and lands in review', { tag: '@critical' }, async ({ page }) => {
    await signIn(page, priya)
    await expect(enrollCard(page)).toContainText('Help people reach essential services.')
    // Learning more doesn't leave the page
    await enrollCard(page).getByText('Learn about CareRide').click()
    await expect(enrollCard(page)).toContainText('Applying doesn’t approve you to drive.')

    await completeApplication(page)
    await expect(main(page)).toContainText('You can continue using Relay Collective while your application is being reviewed.')

    // Same person, same sign-in: no second account, no log-out
    await page.getByRole('link', { name: 'Go to my overview' }).click()
    await expect(heading(page, 'Good morning, Priya.')).toBeVisible()
    const review = main(page).getByRole('region', { name: 'CareRide application under review' })
    await expect(review.getByRole('status')).toHaveText('Your driver application is currently under review.')
    await expect(enrollCard(page)).toHaveCount(0)
    await expect(interestsRegion(page).getByRole('listitem')).toHaveCount(2)
    await expect(page.getByText('Volunteer · CareRide', { exact: true }).first()).toBeVisible()

    // Driver-only work stays closed while pending
    await expect(nav(page).getByRole('link', { name: /^Opportunities/ })).toHaveCount(0)
    await expect(nav(page).getByRole('link', { name: 'My commitments' })).toHaveCount(0)
    await page.goto('/volunteer/profile')
    await expect(main(page).getByRole('region', { name: 'Personal information' })).toContainText('priya@careride.demo')
    await expect(main(page).getByRole('region', { name: 'Personal information' })).toContainText('604-555-0177')
    await expect(main(page).getByRole('region', { name: 'Service participation' })).toContainText('Pending')
  })

  test('the application reuses the account: no email or password, and the name comes from the profile', async ({ page }) => {
    await signIn(page, priya)
    await openApplication(page)
    await page.getByRole('button', { name: 'Start application' }).click()
    const account = main(page).getByRole('region', { name: 'Your Relay Collective account' })
    await expect(account).toContainText('Priya')
    await expect(account).toContainText('priya@careride.demo')
    await expect(main(page).getByLabel(/password/i)).toHaveCount(0)
    await expect(main(page).getByRole('textbox', { name: /email|name/i })).toHaveCount(0)
    // Priya has no phone on file, so that one thing is asked
    await expect(main(page).getByLabel('Mobile phone')).toBeVisible()
  })

  test('each step checks its answers before moving on', async ({ page }) => {
    await signIn(page, priya)
    await openApplication(page)
    await page.getByRole('button', { name: 'Start application' }).click()

    await page.getByLabel('Mobile phone').fill('123')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(main(page).getByText('Enter a 10-digit phone number.')).toBeVisible()
    await expect(page.getByLabel('Mobile phone')).toBeFocused()
    await page.getByLabel('Mobile phone').fill('604-555-0177')
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(main(page).getByText('Describe your vehicle so clients can find it.')).toBeVisible()
    await page.getByLabel('Vehicle colour and type').fill('Green hatchback (Fictional)')
    await page.getByRole('button', { name: 'Continue' }).click()

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(main(page).getByText('Pick at least one city.')).toBeVisible()
    await check(page.getByRole('checkbox', { name: /^Richmond/ }))
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Review' }).click()

    await page.getByRole('button', { name: 'Submit application' }).click()
    await expect(main(page).getByText('Please confirm to submit.')).toBeVisible()
    await expect(heading(page, 'Review your application.')).toBeVisible()
    await expect(main(page).getByText('Your CareRide application has been submitted.')).toHaveCount(0)
  })

  test('an unfinished application is kept on this device and picks up where it was left', async ({ page }) => {
    await signIn(page, priya)
    await openApplication(page)
    await page.getByRole('button', { name: 'Start application' }).click()
    await page.getByLabel('Mobile phone').fill('604-555-0177')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel('Vehicle colour and type').fill('Draft van (Fictional)')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(heading(page, 'Where can you drive?')).toBeVisible()

    // Leave, and come back from the Overview
    await nav(page).getByRole('link', { name: 'Overview' }).click()
    await expect(enrollCard(page)).toContainText('Application not submitted yet')
    await enrollCard(page).getByRole('link', { name: 'Continue application' }).click()
    await expect(heading(page, 'Where can you drive?')).toBeVisible()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await expect(page.getByLabel('Vehicle colour and type')).toHaveValue('Draft van (Fictional)')

    // A reload keeps it too
    await page.reload()
    await expect(page.getByLabel('Vehicle colour and type')).toHaveValue('Draft van (Fictional)')
  })

  test('approval by an admin opens CareRide, and general volunteering stays as it was', { tag: '@critical' }, async ({ page }) => {
    test.slow()
    await signIn(page, priya)
    await completeApplication(page)
    const admin = await decide(page, 'Approve')
    await admin.close()

    await page.bringToFront()
    await page.goto('/volunteer')
    // The CareRide dashboard, as every approved driver has it
    await expect(main(page).getByRole('region', { name: 'CareRide' })).toBeVisible()
    await expect(main(page).getByRole('region', { name: 'Available opportunities' })).toBeVisible()
    await expect(nav(page).getByRole('link', { name: /^Opportunities/ })).toBeVisible()
    await nav(page).getByRole('link', { name: /^Opportunities/ }).click()
    await expect(heading(page, 'Opportunities')).toBeVisible()
    await nav(page).getByRole('link', { name: 'Availability' }).click()
    await expect(heading(page, 'Availability')).toBeVisible()
    await page.goto('/volunteer/profile/verification')
    await expect(page.getByRole('region', { name: 'Review status' }).getByRole('status')).toHaveText('You’re approved to drive.')

    // The same profile and interests, still theirs to change
    await page.goto('/volunteer/profile')
    await expect(main(page).getByRole('region', { name: 'Personal information' })).toContainText('priya@careride.demo')
    await expect(main(page).getByRole('region', { name: 'Transportation details' })).toBeVisible()
    await expect(interestsRegion(page).getByRole('listitem')).toHaveCount(2)
    await expectInterestsKept(page)
  })

  test('a rejected application keeps general volunteering, with no driving', async ({ page }) => {
    test.slow()
    await signIn(page, priya)
    await completeApplication(page)
    const admin = await decide(page, 'Reject')
    await admin.close()

    await page.bringToFront()
    await page.goto('/volunteer')
    await expect(main(page).getByRole('region', { name: 'CareRide application' }).getByRole('status')).toHaveText('Your driver application wasn’t approved.')
    await expect(nav(page).getByRole('link', { name: /^Opportunities/ })).toHaveCount(0)
    await page.goto('/volunteer/opportunities')
    await expect(heading(page, "Your driver application wasn't approved.")).toBeVisible()
    await expect(page.getByRole('button', { name: 'Accept' })).toHaveCount(0)
    // No new application from here: the decision stands until the team changes it
    await page.goto('/volunteer/careride/apply')
    await expect(page).toHaveURL(/\/volunteer$/)
    await expectInterestsKept(page)
    await page.getByRole('checkbox', { name: /^General volunteering/ }).focus()
    await page.getByRole('checkbox', { name: /^General volunteering/ }).press('Space')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Changes saved.')).toBeVisible()
  })

  test('applying twice makes one application', async ({ page, context }) => {
    await signIn(page, priya)
    // A second tab with the application open before the first one is sent
    await openApplication(page)
    const second = await context.newPage()
    await second.goto('/volunteer/careride/apply')
    await expect(heading(second, 'Drive with CareRide.')).toBeVisible()

    await page.getByRole('button', { name: 'Start application' }).click()
    await page.getByLabel('Mobile phone').fill('604-555-0177')
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel('Vehicle colour and type').fill('Green hatchback (Fictional)')
    await page.getByRole('button', { name: 'Continue' }).click()
    await check(page.getByRole('checkbox', { name: /^Vancouver/ }))
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('button', { name: 'Review' }).click()
    await page.getByRole('checkbox', { name: /valid driver's licence/ }).check()
    await page.getByRole('button', { name: 'Submit application' }).click()
    await expect(heading(page, 'Your CareRide application has been submitted.')).toBeVisible()

    // The stale tab still shows the form; finishing it gets the existing application back, not a second one
    await second.getByRole('button', { name: 'Start application' }).click()
    await second.getByLabel('Mobile phone').fill('604-555-0177')
    await second.getByRole('button', { name: 'Continue' }).click()
    await second.getByLabel('Vehicle colour and type').fill('Another car (Fictional)')
    await second.getByRole('button', { name: 'Continue' }).click()
    await check(second.getByRole('checkbox', { name: /^Richmond/ }))
    await second.getByRole('button', { name: 'Continue' }).click()
    await second.getByRole('button', { name: 'Review' }).click()
    await second.getByRole('checkbox', { name: /valid driver's licence/ }).check()
    await second.getByRole('button', { name: 'Submit application' }).click()
    await expect(heading(second, 'You’ve already applied to drive with CareRide.')).toBeVisible()

    // One driver profile, with the first answers
    const drivers = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('careride-db-v8')!) as { drivers: { userId: string; vehicle: string }[] }
      return db.drivers.filter((d) => d.userId === 'u-priya')
    })
    expect(drivers).toHaveLength(1)
    expect(drivers[0].vehicle).toBe('Green hatchback (Fictional)')
  })

  test('driving pages stay closed while the application is pending', { tag: '@critical' }, async ({ page }) => {
    await signIn(page, priya)
    // Before applying, a general volunteer is sent home from every driving page
    await page.goto('/volunteer/opportunities')
    await expect(page).toHaveURL(/\/volunteer$/)
    await completeApplication(page)

    for (const path of ['/volunteer/opportunities', '/volunteer/commitments', '/volunteer/transportation/rides']) {
      await page.goto(path)
      await expect(main(page).getByRole('heading', { name: 'Your driver application is currently under review.' })).toBeVisible()
      await expect(main(page).getByRole('button', { name: 'Accept' })).toHaveCount(0)
    }
    // And the application page itself can't be used to apply again
    await page.goto('/volunteer/careride/apply')
    await expect(page).toHaveURL(/\/volunteer$/)
  })
})

test.describe('existing drivers', () => {
  test('an existing driver needs no enrollment and keeps their workspace', async ({ page }) => {
    await signIn(page, accounts.frank)
    await expect(enrollCard(page)).toHaveCount(0)
    await expect(main(page).getByRole('region', { name: 'CareRide' })).toBeVisible()
    await page.goto('/volunteer/careride/apply')
    await expect(page).toHaveURL(/\/volunteer$/)
    await nav(page).getByRole('link', { name: /^Opportunities/ }).click()
    await expect(heading(page, 'Opportunities')).toBeVisible()
  })

  test('a newly approved volunteer driver drives a ride from request to drop-off', { tag: '@critical' }, async ({ page, context }) => {
    test.slow()
    await signIn(page, priya)
    await completeApplication(page)
    ;(await decide(page, 'Approve')).close()

    const partner = await signInInNewTab(context, accounts.belkin)
    await bookRide(partner, { destination: /^St\. Paul's Hospital/, when: 'asap', passenger: 'Morgan Test (Fictional)' })
    const asked = partner.getByRole('heading', { name: 'Drivers asked' }).locator('+ ul')
    await expect(asked.getByRole('listitem').filter({ hasText: 'Priya' })).toBeVisible()

    await page.bringToFront()
    await page.goto('/volunteer/opportunities')
    const request = page.getByRole('article', { name: "St. Paul's Hospital" })
    await request.getByRole('button', { name: 'Accept' }).click()
    await expect(page.getByRole('status').getByText("Ride accepted. It's in your upcoming rides.")).toBeVisible()

    await page.goto('/volunteer/commitments')
    await expect(main(page).getByText("St. Paul's Hospital").first()).toBeVisible()
    await page.goto('/volunteer/transportation/rides?tab=upcoming')
    await main(page).getByRole('link', { name: /St\. Paul's Hospital/ }).first().click()
    const steps = page.getByRole('list', { name: 'Trip steps' })
    await steps.getByRole('button', { name: "I'm on my way" }).click()
    await expect(steps.getByRole('heading', { name: 'Head to pickup (done)' })).toBeVisible()
    await steps.getByRole('button', { name: "I'm here" }).click()
    await expect(steps.getByRole('heading', { name: 'Arrive at pickup (done)' })).toBeVisible()
    await steps.getByRole('button', { name: 'Client is in the car' }).click()
    await expect(steps.getByRole('heading', { name: 'Client gets in (done)' })).toBeVisible()
    await steps.getByRole('button', { name: 'Client dropped off' }).click()
    await expect(page.getByRole('list', { name: 'Ride progress' }).getByText('Passenger dropped off (done)')).toBeVisible()

    await partner.bringToFront()
    await expect(partner.getByRole('region', { name: 'Trip progress' }).getByRole('listitem').filter({ hasText: 'Dropped off' })).toBeVisible()
  })
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('the whole application works at phone width, without sideways scrolling', async ({ page }) => {
    await signIn(page, priya)
    await expect(enrollCard(page)).toBeVisible()
    await openApplication(page)
    // The step list is a sidebar on wide screens; on a phone each step says where it is
    await expect(main(page).getByText('Step 1 of 6')).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await page.getByRole('button', { name: 'Back to overview' }).click()
    await expect(enrollCard(page)).toBeVisible()
    await completeApplication(page)
    await expect(main(page).getByRole('link', { name: 'Go to my overview' })).toBeVisible()
  })
})
