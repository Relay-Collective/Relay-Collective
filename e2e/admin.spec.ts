import { accounts, expect, signIn, signInInNewTab, test } from './fixtures'
import { choose } from './helpers'

// The platform admin console. Each test has its own copy of the demo data, so a decision made here
// (approving a driver) changes nothing outside the test.

test.describe('platform admin console', () => {
  test('the dashboard shows platform totals and every section of the console', { tag: '@smoke' }, async ({ page }) => {
    await signIn(page, accounts.admin)
    const metrics = page.getByRole('region', { name: 'Platform metrics' })
    await expect(metrics.getByRole('link', { name: /^Organizations: 5\./ })).toBeVisible()
    await expect(metrics.getByRole('link', { name: /^Pending approvals: 2\./ })).toBeVisible()
    await expect(metrics.getByRole('link', { name: /^Completed rides: 3\./ })).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Main' })
    for (const link of ['Dashboard', 'Organizations', 'Users', /^Approvals/, 'Modules', 'CareRide', 'Activity', 'Issues', 'Feedback', 'Settings']) {
      await expect(nav.getByRole('link', { name: link })).toBeVisible()
    }
  })

  test('organizations are listed and open to their details', async ({ page }) => {
    await signIn(page, accounts.admin)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Organizations' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Organizations' })).toBeVisible()
    const table = page.getByRole('table', { name: /^Organizations/ })
    await expect(table.getByRole('rowgroup').nth(1).getByRole('row')).toHaveCount(5)

    await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'Pending review 1' }).click()
    await expect(table.getByRole('rowgroup').nth(1).getByRole('row')).toHaveCount(1)
    await expect(table).toContainText('Example Shelter Society (Fictional)')

    await page.getByRole('group', { name: 'Status' }).getByRole('button', { name: 'All 5' }).click()
    await table.getByRole('link', { name: 'Belkin House' }).first().click()
    await expect(page).toHaveURL(/\/admin\/organizations\/org-belkin$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Belkin House' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Location' })).toContainText('555 Homer St, Vancouver')
  })

  test('approvals list what is waiting, and approving a driver records the decision', { tag: '@critical' }, async ({ page }) => {
    await signIn(page, accounts.admin)
    await page.goto('/admin/approvals')
    const table = page.getByRole('table', { name: /^Applications/ })
    await expect(table.getByRole('rowgroup').nth(1).getByRole('row')).toHaveCount(2)
    await expect(table).toContainText('Example Shelter Society (Fictional)')
    await expect(table).toContainText('Jordan')

    await table.getByRole('link', { name: 'Jordan' }).first().click()
    await expect(page).toHaveURL(/\/admin\/approvals\/drivers\/d-jordan$/)
    const decision = page.getByRole('region', { name: 'Decision' })
    await expect(decision.getByRole('button', { name: 'Reject' })).toBeEnabled()
    await expect(page.getByRole('region', { name: 'Submitted information' })).toContainText('Blue hatchback')

    await decision.getByRole('button', { name: 'Approve' }).click()
    // Every decision is confirmed first
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Approve / })
      .click()
    await expect(decision.getByText('Jordan was approved.')).toBeVisible()

    await page.goto('/admin/approvals')
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^Approvals/ })).toHaveAccessibleName(
      'Approvals , 1 waiting for review',
    )
    await expect(table.getByRole('rowgroup').nth(1).getByRole('row')).toHaveCount(1)
  })

  test('feedback someone sends shows up for the admin, with its details', async ({ page: partner, context }) => {
    test.slow()
    await signIn(partner, accounts.belkin)
    await partner.getByRole('button', { name: 'Send feedback' }).click()
    const form = partner.getByRole('dialog', { name: 'Help us make Relay Collective better.' })
    await choose(form.getByRole('radio', { name: /^Improvement suggestion/ }))
    await form.getByRole('textbox', { name: 'Title (required)' }).fill('Test: show the pickup time on the ride slip')
    await form.getByRole('textbox', { name: 'Description (required)' }).fill('An end-to-end test wrote this. It uses no real client information.')
    await form.getByRole('button', { name: 'Submit Feedback' }).click()
    await expect(partner.getByRole('dialog').getByText(/thank/i).first()).toBeVisible()

    const admin = await signInInNewTab(context, accounts.admin)
    await admin.goto('/admin/feedback')
    await expect(admin.getByRole('link', { name: /^Total submissions: 1\./ })).toBeVisible()
    await admin.getByRole('link', { name: 'Test: show the pickup time on the ride slip' }).first().click()
    await expect(admin).toHaveURL(/\/admin\/feedback\/[^/]+$/)
    await expect(admin.getByRole('heading', { level: 1, name: 'Test: show the pickup time on the ride slip' })).toBeVisible()
    await expect(admin.getByRole('main')).toContainText('An end-to-end test wrote this.')
  })

  test('transportation oversight lists rides and opens one without private rider details', async ({ page }) => {
    await signIn(page, accounts.admin)
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'CareRide' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'CareRide' })).toBeVisible()
    const rides = page.getByRole('table', { name: /^Ride requests/ })
    await expect(rides.getByRole('rowgroup').nth(1).getByRole('row')).toHaveCount(3)

    await rides.getByRole('link', { name: 'View ride EPAST1' }).click()
    await expect(page).toHaveURL(/\/admin\/transportation\/rides\/ride-past-1$/)
    await expect(page.getByRole('heading', { level: 1, name: "Ride to St. Paul's Hospital" })).toBeVisible()
    await expect(page.getByText('Rider names, notes, and pickup instructions aren’t shown here.', { exact: false })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Request' })).toContainText('Maya')
  })
})
