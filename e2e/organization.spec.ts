import { accounts, expect, signIn, test } from './fixtures'

// The organization workspace that every partner organization shares, whatever modules it uses.

test.describe('organization workspace', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, accounts.belkin)
  })

  test('the overview shows the organization and what needs attention', { tag: '@smoke' }, async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Good morning.' })).toBeVisible()
    await expect(page.getByText('Monday, October 5')).toBeVisible()
    const main = page.getByRole('main')
    await expect(main.getByRole('definition').filter({ hasText: /^Belkin House$/ })).toBeVisible()
    await expect(main.getByRole('definition').filter({ hasText: /^Administrator$/ })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Needs your attention' })).toContainText("You're all caught up.")
    // The three seeded rides finished within the last 30 days
    await expect(page.getByRole('link', { name: /^Completed: 3\. In the last 30 days/ })).toBeVisible()
  })

  test('modules: CareRide is active, the rest are planned and have nothing to click', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'All modules' }).click()
    await expect(page).toHaveURL(/\/workspace\/services$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Modules' })).toBeVisible()

    const available = page.getByRole('region', { name: 'Available to your organization' })
    const careRide = available.getByRole('article').filter({ has: page.getByRole('heading', { name: 'CareRide' }) })
    await expect(careRide).toContainText('Active')
    await expect(careRide.getByRole('link', { name: 'Open CareRide' })).toBeVisible()

    const planned = page.getByRole('region', { name: 'Planned' })
    await expect(planned.getByRole('heading', { level: 3 })).toHaveText([
      'Volunteer coordination',
      'Resource sharing',
      'Cross-organization collaboration',
    ])
    for (const card of await planned.getByRole('article').all()) {
      await expect(card).toContainText('Planned')
      await expect(card.getByRole('link')).toHaveCount(0)
      await expect(card.getByRole('button')).toHaveCount(0)
    }
  })

  test('opening CareRide from the modules page lands in the transportation module', async ({ page }) => {
    await page.goto('/workspace/services')
    await page.getByRole('link', { name: 'Open CareRide' }).click()
    await expect(page).toHaveURL(/\/workspace\/transportation$/)
    await expect(page.getByText('CareRide', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: 'Ride overview' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'CareRide' })).toBeVisible()
  })

  test('the sidebar reaches every workspace page', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Main' })
    const destinations: [string, RegExp, string][] = [
      ['Organization', /\/workspace\/organization$/, 'Organization profile'],
      ['Team', /\/workspace\/team$/, 'Team and memberships'],
      ['CareRide', /\/workspace\/transportation$/, 'Ride overview'],
      ['All modules', /\/workspace\/services$/, 'Modules'],
      ['Overview', /\/workspace$/, 'Good morning.'],
    ]
    for (const [link, url, heading] of destinations) {
      await nav.getByRole('link', { name: link, exact: true }).click()
      await expect(page).toHaveURL(url)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expect(nav.getByRole('link', { name: link, exact: true })).toHaveAttribute('aria-current', 'page')
    }
  })

  test('an administrator sees every team tab and the visibility setting', async ({ page }) => {
    await page.goto('/workspace/team')
    await expect(page.getByRole('tablist', { name: 'Team' }).getByRole('tab')).toHaveText(['Members', 'Join requests', 'Invitations'])
    await expect(page.getByRole('table', { name: 'Members of Belkin House' }).getByRole('columnheader', { name: 'Email' })).toBeVisible()

    await page.goto('/workspace/organization')
    const visibility = page.getByRole('region', { name: 'Organization Visibility' })
    await expect(visibility.getByRole('radio', { name: /^Invitation Only/ })).toBeEnabled()
  })
})
