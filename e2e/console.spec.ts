import type { Page } from '@playwright/test'
import { accounts, expect, signIn, test } from './fixtures'

// The console look (DESIGN.md §5–6): the route rail and its sidebar, the greeting's accent word, the CareRide
// card on the overview, CareRide's segmented tabs and the phone tab bar. These check what each piece promises a
// person (words, current-page marks, links, motion that respects the system setting), not pixels.

// The one link in a navigation marked as the current page
async function expectOneCurrent(page: Page, nav: string, name: string) {
  const current = page.getByRole('navigation', { name }).locator('[aria-current="page"]')
  await expect(current, `${nav} should mark exactly one current page`).toHaveCount(1)
  return current
}

test.describe('console', () => {
  test('the greeting sets its time of day as an accent and keeps its words', async ({ page }) => {
    await signIn(page, accounts.belkin)
    const heading = page.getByRole('heading', { level: 1, name: 'Good morning.' })
    await expect(heading).toBeVisible()
    await expect(heading.locator('em')).toHaveText('morning')
  })

  test("a driver's greeting keeps their name after the accent", async ({ page }) => {
    await signIn(page, accounts.frank)
    const heading = page.getByRole('heading', { level: 1, name: 'Good morning, Frank.' })
    await expect(heading).toBeVisible()
    await expect(heading.locator('em')).toHaveText('morning')
  })

  test('the sidebar marks one current page, and it moves as you go', async ({ page }) => {
    await signIn(page, accounts.belkin)
    await expect(await expectOneCurrent(page, 'sidebar', 'Main')).toHaveText('Overview')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'CareRide', exact: true }).click()
    await expect(page).toHaveURL(/\/workspace\/transportation$/)
    await expect(await expectOneCurrent(page, 'sidebar', 'Main')).toHaveText('CareRide')
  })

  test("the sidebar's relay point rests on the current page's station, and follows you", async ({ page }) => {
    await signIn(page, accounts.belkin)
    const nav = page.getByRole('navigation', { name: 'Main' })
    const relay = page.getByRole('complementary', { name: 'Sidebar' }).locator('.bg-cantaloupe')
    const restsOn = async (name: string) => {
      const station = nav.getByRole('link', { name, exact: true }).locator('[data-station]')
      await expect(station).toHaveAttribute('data-current', 'true')
      await expect(nav.locator('[data-station][data-current]')).toHaveCount(1)
      // The relay point's centre sits on the station's centre
      await expect(async () => {
        const [a, b] = await Promise.all([relay.boundingBox(), station.boundingBox()])
        expect(Math.abs(a!.y + a!.height / 2 - (b!.y + b!.height / 2))).toBeLessThan(1.5)
      }).toPass()
    }
    await restsOn('Overview')
    await nav.getByRole('link', { name: 'Team', exact: true }).click()
    await restsOn('Team')
  })

  test('the sidebar collapses to icons, keeps every link named, and remembers the choice', async ({ page }) => {
    await signIn(page, accounts.belkin)
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' })
    await sidebar.getByRole('button', { name: 'Collapse sidebar' }).click()
    await expect(sidebar.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    // The words are hidden from sight only: each link keeps its name
    await expect(sidebar.getByRole('link', { name: 'Team', exact: true })).toBeVisible()
    await expect(sidebar.getByText('Team', { exact: true })).not.toBeInViewport()

    await page.reload()
    await expect(sidebar.getByRole('button', { name: 'Expand sidebar' })).toBeVisible()
    await sidebar.getByRole('button', { name: 'Expand sidebar' }).click()
    await expect(sidebar.getByText('Team', { exact: true })).toBeInViewport()
  })

  test('the CareRide card leads into the module, with its numbers below and its drawing kept from screen readers', async ({ page }) => {
    await signIn(page, accounts.belkin)
    const card = page.getByRole('region', { name: 'Your modules' }).getByRole('article').filter({ has: page.getByRole('heading', { name: 'CareRide' }) })
    await expect(card).toContainText('Active')
    await expect(card.getByRole('link', { name: /^Completed: 3\./ })).toBeVisible()
    // The drawn trip is decoration: nothing in it reaches the accessibility tree
    await expect(card.getByRole('img')).toHaveCount(0)
    await expect(card.locator('[aria-hidden="true"]:has(.rc-route-draw)')).toHaveCount(1)

    await card.getByRole('link', { name: 'Open CareRide' }).click()
    await expect(page).toHaveURL(/\/workspace\/transportation$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Ride overview' })).toBeVisible()
  })

  test("CareRide's tabs mark the current page, including History inside the requests list", async ({ page }) => {
    await signIn(page, accounts.belkin)
    await page.goto('/workspace/transportation')
    const tabs = page.getByRole('navigation', { name: 'CareRide' })
    await expect(tabs.getByRole('link')).toHaveText(['Overview', 'Requests', 'New ride', 'Destinations', 'History'])
    await expect(await expectOneCurrent(page, 'CareRide tabs', 'CareRide')).toHaveText('Overview')

    for (const [tab, url, heading] of [
      ['New ride', /\/transportation\/new$/, 'Request a ride'],
      ['History', /view=past$/, undefined],
      ['Requests', /\/requests$/, undefined],
    ] as const) {
      await tabs.getByRole('link', { name: tab }).click()
      await expect(page).toHaveURL(url)
      if (heading) await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      await expect(await expectOneCurrent(page, 'CareRide tabs', 'CareRide')).toHaveText(tab)
    }
  })

  test('the admin console carries the same frame, with its own name in the sidebar', async ({ page }) => {
    await signIn(page, accounts.admin)
    const sidebar = page.getByRole('complementary', { name: 'Sidebar' })
    await expect(sidebar.getByText('Platform administration')).toBeVisible()
    await expect(await expectOneCurrent(page, 'admin sidebar', 'Main')).toHaveText('Dashboard')
    // Every section, the last one included, can be reached from the sidebar at this window size
    const settings = sidebar.getByRole('link', { name: 'Settings', exact: true })
    await settings.scrollIntoViewIfNeeded()
    await settings.click()
    await expect(page).toHaveURL(/\/admin\/settings$/)
  })

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('the CareRide route is drawn in full straight away and nothing on the overview keeps moving', async ({ page }) => {
      await signIn(page, accounts.belkin)
      await expect(page.getByRole('region', { name: 'Your modules' })).toBeVisible()
      const route = page.locator('.rc-route-draw')
      await expect(route).toHaveCSS('animation-name', 'none')
      await expect(route).toHaveCSS('stroke-dashoffset', '0px')
      // Pages don't settle in either, so the first frame is the final one
      await expect(page.locator('.rc-page > *').first()).toHaveCSS('animation-name', 'none')
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
    })
  })

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test("the volunteer tab bar marks the current tab, and it moves as you go", async ({ page }) => {
      await signIn(page, accounts.frank)
      await expect(await expectOneCurrent(page, 'tab bar', 'Quick')).toContainText('Overview')
      await page.getByRole('navigation', { name: 'Quick' }).getByRole('link', { name: 'Availability' }).click()
      await expect(page.getByRole('heading', { level: 1, name: 'Availability' })).toBeVisible()
      await expect(await expectOneCurrent(page, 'tab bar', 'Quick')).toContainText('Availability')
    })

    test('the drawer is the same sidebar, with the current page marked', async ({ page }) => {
      await signIn(page, accounts.belkin)
      await page.getByRole('button', { name: 'Open navigation' }).click()
      const drawer = page.getByRole('dialog', { name: 'Navigation' })
      await expect(drawer.getByRole('link', { name: 'Overview', exact: true })).toHaveAttribute('aria-current', 'page')
      await expect(drawer.getByText('Nonprofit workspace')).toBeVisible()
    })
  })
})
