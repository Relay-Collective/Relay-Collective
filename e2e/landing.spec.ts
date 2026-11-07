import { expect, test } from './fixtures'

// The public home page: what the platform is, a workspace for each role, and one ride from request to drop-off.
// Volunteers are general volunteers first; CareRide driving is one service they can join, and only it is described as running.
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
    for (const [i, name] of ['Organizations', 'Volunteers', 'Platform admins'].entries()) {
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

    // Arrow keys move along the tabs and wrap around; only the chosen tab is in the Tab order
    await organizations.press('ArrowRight')
    const volunteersTab = tabs.getByRole('tab', { name: 'Volunteers' })
    await expect(volunteersTab).toBeFocused()
    await expect(volunteersTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel', { name: 'Volunteers' }).getByRole('heading', { level: 3, name: 'Start with what matters to you' })).toBeVisible()
    await volunteersTab.press('ArrowRight')
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

  test('the volunteer workspace is a general volunteer’s: interests first, CareRide as a service to join', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tablist', { name: 'Workspaces' }).getByRole('tab', { name: 'Volunteers' }).click()
    const panel = page.getByRole('tabpanel', { name: 'Volunteers' })
    await expect(panel.getByRole('heading', { level: 3 })).toHaveText([
      '1Start with what matters to you',
      '2Your volunteering, in one place',
      '3Join a service when you’re ready',
    ])
    // Interests are never presented as assignments, and driving is its own, verified step
    await expect(panel.getByText(/Saving an interest doesn’t sign you up for anything\./)).toBeVisible()
    await expect(panel.getByText(/CareRide is the first service open to volunteers\. .*verifies you before any ride is sent\./)).toBeVisible()
    await expect(panel.getByText(/^Illustrative demo of the volunteer workspace\./)).toBeVisible()
    // No driver-only promises in the volunteer tab
    await expect(panel.getByText(/Requests come to you|Drive when it suits you/)).toHaveCount(0)
    await expect(panel.getByRole('link', { name: 'Become a volunteer' })).toHaveAttribute('href', '/register?role=volunteer')
  })

  test('every general volunteer link goes to volunteer sign-up, and only CareRide links go to the driver sign-up', async ({ page }) => {
    await page.goto('/')
    const hero = page.getByRole('region', { name: /Technology that\s*brings us together\./ })
    await expect(hero.getByText('Want to make a difference?')).toBeVisible()
    await expect(hero.getByRole('link', { name: 'Join as a volunteer' })).toHaveAttribute('href', '/register?role=volunteer')

    for (const link of await page.getByRole('link', { name: 'Become a volunteer' }).all()) {
      await expect(link).toHaveAttribute('href', '/register?role=volunteer')
    }
    // The capability card, the closing call to action and the footer, plus the tab only once it's open
    await expect(page.getByRole('link', { name: 'Become a volunteer' })).toHaveCount(3)
    await expect(page.getByRole('link', { name: /Volunteer as a driver/ })).toHaveCount(0)
    // The one driver sign-up link on the page says it's for CareRide
    const toDriver = page.locator('a[href="/register?role=driver"]')
    await expect(toDriver).toHaveCount(1)
    await expect(toDriver).toHaveText('Drive with CareRide')
  })

  test('the hero’s volunteer link starts general volunteer onboarding, with no vehicle questions', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Join as a volunteer' }).click()
    await expect(page).toHaveURL(/\/register\?role=volunteer$/)
    await expect(page.getByText('Create one account for yourself. Then register your organization, join an existing team, or contribute as a volunteer.')).toBeVisible()
    await page.getByLabel('Full name').fill('Robin Visitor (Fictional)')
    await page.getByLabel('Email address').fill('robin.visitor@example.org')
    await page.getByLabel('Password', { exact: true }).fill('a-long-test-password')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/onboarding\/volunteer$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Join Relay Collective as a volunteer' })).toBeVisible()
    for (const driverOnly of [/vehicle/i, /licen[cs]e/i]) await expect(page.getByLabel(driverOnly)).toHaveCount(0)
  })

  test('CareRide is the working service; volunteering is open to join, and coordinating it is labelled planned', async ({ page }) => {
    await page.goto('/')
    const careRide = page.getByRole('article', { name: 'Move people.' })
    await expect(careRide.getByText('CareRide · Transportation')).toBeVisible()
    await expect(careRide.getByText('Working today')).toBeVisible()

    const volunteering = page.getByRole('article', { name: 'Every contribution matters.' })
    await expect(volunteering.getByText('Volunteer registration open')).toBeVisible()
    await expect(volunteering.getByText('Working today')).toHaveCount(0)
    const ways = volunteering.getByRole('list', { name: 'Ways volunteers can choose to help' }).getByRole('listitem')
    await expect(ways).toHaveText(['Transportation· CareRide', 'Food distribution', 'Community outreach', 'Resource coordination'])
    await expect(volunteering.getByText(/Coordinating other kinds of volunteering is planned\./)).toBeVisible()
    await expect(volunteering.getByRole('link', { name: 'Become a volunteer' })).toHaveAttribute('href', '/register?role=volunteer')

    // What comes next is labelled planned and links nowhere
    const next = page.getByRole('article', { name: 'Built to grow.' })
    await expect(next.getByText('Planned', { exact: true })).toBeVisible()
    await expect(next.getByText(/matching volunteers with opportunities organizations post/)).toBeVisible()
    await expect(next.getByRole('link')).toHaveCount(0)
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
      // Phones show short labels (Staff, Volunteers, Admins); the names stay whole for screen readers
      for (const name of ['Organizations', 'Volunteers', 'Platform admins']) await expect(tabs.getByRole('tab', { name })).toBeVisible()
      await tabs.getByRole('tab', { name: 'Volunteers' }).tap()
      const volunteers = page.getByRole('tabpanel', { name: 'Volunteers' })
      await expect(volunteers.getByRole('heading', { level: 3, name: 'Start with what matters to you' })).toBeVisible()
      await expect(volunteers.getByRole('link', { name: 'Become a volunteer' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
      await tabs.getByRole('tab', { name: 'Platform admins' }).tap()
      await expect(page.getByRole('tabpanel', { name: 'Platform admins' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    })
  })
})
