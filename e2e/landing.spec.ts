import { expect, test } from './fixtures'

// The public home page: what the platform is, a workspace for each role, and one ride from request to drop-off.
// These check what a visitor can find and use (headings, tabs, links, honest captions), not pixels.

test.describe('the home page', () => {
  test('the header jumps to every part of the page, including the workspaces and CareRide', async ({ page }) => {
    await page.goto('/')
    const nav = page.getByRole('banner').getByRole('navigation', { name: 'Main' })
    await expect(nav.getByRole('link')).toHaveText(['Platform', 'Modules', 'Workspaces', 'CareRide', 'Impact', 'Resources'])

    await nav.getByRole('link', { name: 'Workspaces' }).click()
    await expect(page).toHaveURL(/#showcase$/)
    await expect(page.getByRole('heading', { level: 2, name: /^One platform\.\s*Built for every role\.$/ })).toBeInViewport()

    await nav.getByRole('link', { name: 'CareRide' }).click()
    await expect(page).toHaveURL(/#ride$/)
    await expect(page.getByRole('heading', { level: 2, name: 'One ride, relayed.' })).toBeInViewport()
  })

  test('the workspace tabs show each role, by click and by keyboard', async ({ page }) => {
    await page.goto('/')
    const tabs = page.getByRole('tablist', { name: 'Workspaces' })
    await expect(tabs.getByRole('tab')).toHaveCount(3)
    for (const [i, name] of ['Organizations', 'Volunteer drivers', 'Platform admins'].entries()) {
      await expect(tabs.getByRole('tab').nth(i)).toHaveAccessibleName(name)
    }

    const organizations = tabs.getByRole('tab', { name: 'Organizations' })
    await expect(organizations).toHaveAttribute('aria-selected', 'true')
    const panel = page.getByRole('tabpanel', { name: 'Organizations' })
    await expect(panel.getByRole('heading', { level: 3, name: 'Nothing goes quiet' })).toBeVisible()
    await expect(panel.getByRole('link', { name: 'Register your organization' })).toHaveAttribute('href', '/register?role=partner')
    // The drawn workspace is a picture: the caption says so, and nothing in it reaches the accessibility tree
    await expect(panel.getByText(/^Illustrative demo of the organization workspace\./)).toBeVisible()
    await expect(panel.getByRole('button')).toHaveCount(0)

    await tabs.getByRole('tab', { name: 'Volunteer drivers' }).click()
    const drivers = page.getByRole('tabpanel', { name: 'Volunteer drivers' })
    await expect(drivers.getByRole('heading', { level: 3, name: 'Requests come to you' })).toBeVisible()
    await expect(drivers.getByRole('link', { name: 'Volunteer as a driver' })).toHaveAttribute('href', '/register?role=driver')

    // Arrow keys move along the tabs and wrap around; only the chosen tab is in the Tab order
    await tabs.getByRole('tab', { name: 'Volunteer drivers' }).press('ArrowRight')
    const admins = tabs.getByRole('tab', { name: 'Platform admins' })
    await expect(admins).toBeFocused()
    await expect(admins).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel', { name: 'Platform admins' }).getByRole('heading', { name: 'Everyone is reviewed first' })).toBeVisible()
    await admins.press('ArrowRight')
    await expect(organizations).toBeFocused()
    await organizations.press('End')
    await expect(admins).toBeFocused()
    await expect(tabs.locator('[tabindex="0"]')).toHaveCount(1)
  })

  test('one ride is shown in four steps, ending in the CareRide tour', async ({ page }) => {
    await page.goto('/')
    const ride = page.getByRole('region', { name: 'One ride, relayed.' })
    await expect(ride.getByRole('heading', { level: 3 })).toHaveText([
      'Step 1: Book in about a minute',
      'Step 2: A verified driver says yes',
      'Step 3: Everyone sees it move',
      'Step 4: Dropped off, and counted',
    ])
    await ride.getByRole('link', { name: 'Take the CareRide tour' }).click()
    await expect(page).toHaveURL(/\/demo$/)
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test('the workspace tabs fit, keep their full names, and switch with a tap', async ({ page }) => {
      await page.goto('/')
      const tabs = page.getByRole('tablist', { name: 'Workspaces' })
      await tabs.scrollIntoViewIfNeeded()
      // Phones show short labels (Staff, Drivers, Admins); the names stay whole for screen readers
      for (const name of ['Organizations', 'Volunteer drivers', 'Platform admins']) await expect(tabs.getByRole('tab', { name })).toBeVisible()
      await tabs.getByRole('tab', { name: 'Platform admins' }).tap()
      await expect(page.getByRole('tabpanel', { name: 'Platform admins' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    })
  })
})
