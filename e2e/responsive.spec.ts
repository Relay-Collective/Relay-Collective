import type { Page } from '@playwright/test'
import { accounts, expect, signIn, test } from './fixtures'

// Phone-sized layouts (390 × 844, touch). The desktop layout (1440 × 900) is what every other spec uses.
// These check that things work, not how they look: navigation opens and closes, pages load, controls
// are reachable, and nothing is wider than the screen.

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

async function expectNoSideways(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'the page should not scroll sideways').toBeLessThanOrEqual(0)
}

// Opens the slide-out navigation, follows one link, and checks the drawer has closed again
async function navigateFromDrawer(page: Page, link: string | RegExp, url: RegExp) {
  await page.getByRole('banner').getByRole('button', { name: 'Open navigation' }).click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await drawer.getByRole('link', { name: link, exact: typeof link === 'string' }).click()
  await expect(page).toHaveURL(url)
  await expect(drawer).toBeHidden()
}

test.describe('on a phone', () => {
  test('the landing page menu opens, leads to sign-in, and fits the screen', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/')
    await expectNoSideways(page)
    await page.getByRole('button', { name: 'Open menu' }).click()
    const menu = page.getByRole('navigation', { name: 'Main' })
    await expect(menu.getByRole('link', { name: 'Modules' })).toBeVisible()
    // The open menu has its own "Log in" link, after the one in the header bar
    const logIn = page.getByRole('banner').getByRole('link', { name: 'Log in' })
    await expect(logIn).toHaveCount(2)
    await logIn.last().click()
    await expect(page).toHaveURL(/\/signin$/)
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
    await expectNoSideways(page)
  })

  test('the organization workspace drawer opens, closes, and reaches CareRide', async ({ page }) => {
    await signIn(page, accounts.belkin)
    await expectNoSideways(page)

    // Close without choosing anything
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()

    await navigateFromDrawer(page, 'CareRide', /\/workspace\/transportation$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Ride overview' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'CareRide' }).getByRole('link', { name: 'New ride' })).toBeVisible()
    await expectNoSideways(page)

    await page.getByRole('navigation', { name: 'CareRide' }).getByRole('link', { name: 'New ride' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Request a ride' })).toBeVisible()
    await page.getByRole('button', { name: 'Request ride' }).scrollIntoViewIfNeeded()
    await expect(page.getByRole('button', { name: 'Request ride' })).toBeInViewport()
    await expectNoSideways(page)
  })

  test('the volunteer workspace has quick links and a drawer', async ({ page }) => {
    await signIn(page, accounts.frank)
    await expectNoSideways(page)
    const quick = page.getByRole('navigation', { name: 'Quick' })
    await expect(quick).toBeInViewport()
    await quick.getByRole('link', { name: 'Availability' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Availability' })).toBeVisible()
    await expectNoSideways(page)

    await navigateFromDrawer(page, 'Opportunities', /\/volunteer\/opportunities$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Opportunities' })).toBeVisible()
  })

  test('the admin console drawer reaches each section', async ({ page }) => {
    await signIn(page, accounts.admin)
    await expectNoSideways(page)
    await navigateFromDrawer(page, /^Approvals/, /\/admin\/approvals$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Approvals' })).toBeVisible()
    await expectNoSideways(page)
    await navigateFromDrawer(page, 'CareRide', /\/admin\/transportation$/)
    await expect(page.getByRole('heading', { level: 1, name: 'CareRide' })).toBeVisible()
  })

  test('a dialog can be dismissed on a phone', async ({ page }) => {
    await signIn(page, accounts.belkin)
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Send feedback' }).click()
    const feedback = page.getByRole('dialog', { name: 'Help us make Relay Collective better.' })
    await expect(feedback).toBeVisible()
    await expect(feedback.getByRole('button', { name: 'Submit Feedback' })).toBeVisible()
    await feedback.getByRole('button', { name: 'Close' }).click()
    await expect(feedback).toBeHidden()
  })
})
