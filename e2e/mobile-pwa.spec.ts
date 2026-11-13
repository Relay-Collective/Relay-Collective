import { devices, type Page } from '@playwright/test'
import { accounts, expect, signIn, signInInNewTab, test } from './fixtures'
import { bookRide } from './helpers'
import { adminPaths } from '../src/admin/paths'
import { volunteerPaths } from '../src/volunteer/paths'
import { paths } from '../src/workspace/paths'

const phone = devices['Pixel 7']
const iphone = devices['iPhone 13']

async function fitsPhone(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
}

async function sweep(page: Page, routes: readonly string[]) {
  for (const route of routes) {
    await test.step(route, async () => {
      await page.goto(route)
      await expect(page).toHaveURL((url) => url.pathname + url.search === route)
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
      await fitsPhone(page)
    })
  }
}

test.describe('mobile page sweep', () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 320, height: 700 } })

  test('public pages fit a compact phone', async ({ page }) => {
    await sweep(page, ['/', '/signin', '/register', '/forgot-password', '/reset-password', '/welcome', '/install/ios', '/install/android'])
  })

  test('partner workspace and CareRide pages fit a compact phone', async ({ page }) => {
    test.slow()
    await signIn(page, accounts.belkin)
    await sweep(page, [
      paths.overview, paths.services, paths.organization, paths.team, paths.help, paths.feedback,
      paths.transport, paths.requests, `${paths.requests}?view=past`, paths.newRide,
      paths.ride('ride-past-3'), paths.destinations, paths.notifications,
    ])
  })

  test('driver workspace fits a compact phone', async ({ page }) => {
    test.slow()
    await signIn(page, accounts.frank)
    await sweep(page, [
      volunteerPaths.overview, volunteerPaths.opportunities, volunteerPaths.commitments,
      volunteerPaths.transport, volunteerPaths.rides, volunteerPaths.availability, volunteerPaths.profile,
      volunteerPaths.verification, volunteerPaths.interests, volunteerPaths.settings, volunteerPaths.help,
      volunteerPaths.feedback, volunteerPaths.notifications,
    ])
  })

  test('general volunteer workspace fits a compact phone', async ({ page }) => {
    await signIn(page, accounts.priya)
    await sweep(page, [
      volunteerPaths.overview, volunteerPaths.interests, volunteerPaths.profile, volunteerPaths.careRideApply,
      volunteerPaths.settings, volunteerPaths.help, volunteerPaths.feedback,
    ])
  })

  test('admin console fits a compact phone', async ({ page }) => {
    test.slow()
    await signIn(page, accounts.admin)
    await sweep(page, [
      adminPaths.overview, adminPaths.organizations, adminPaths.users, adminPaths.approvals, adminPaths.services,
      adminPaths.transportation, adminPaths.activity, adminPaths.issues, adminPaths.feedback, adminPaths.settings,
      adminPaths.search,
    ])
  })

  test('provider pages fit a compact phone', async ({ page }) => {
    await page.goto('/signin')
    await page.getByLabel('Email address').fill('vanshare@careride.demo')
    await page.getByLabel('Password', { exact: true }).fill(accounts.frank.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByRole('link', { name: 'Open your dashboard' }).click()
    await expect(page).toHaveURL(/\/org\/drivers$/)
    await sweep(page, ['/org/drivers', '/org/bookings', '/org/feedback', '/org/notifications'])
  })
})

for (const platform of ['ios', 'android'] as const) {
  const device = platform === 'ios' ? iphone : phone
  test.describe(`install and inbox on ${platform}`, () => {
    test.use({ userAgent: device.userAgent, viewport: device.viewport, isMobile: true, hasTouch: true })

    test('launch opens sign-in or the current workspace; the guide matches the phone', async ({ page }) => {
      await page.goto('/launch')
      await expect(page).toHaveURL(/\/signin$/)
      await signIn(page, accounts.frank)
      await page.goto('/launch')
      await expect(page).toHaveURL(/\/volunteer$/)
      await page.getByRole('button', { name: 'Frank', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Install Relay' }).click()
      await expect(page).toHaveURL(new RegExp(`/install/${platform}$`))
      await expect(page.getByRole('heading', { name: platform === 'ios' ? 'Add Relay from Safari' : 'Install Relay from Chrome' })).toBeVisible()
      await fitsPhone(page)
    })

    test('a first accepted ride shows install help once and posts a separate partner update', async ({ context, page: partner }) => {
      test.slow()
      await signIn(partner, accounts.belkin)
      const rideId = await bookRide(partner, { destination: /^St\. Paul's Hospital/, when: 'asap', passenger: 'Private test passenger' })
      const driver = await signInInNewTab(context, accounts.frank)
      await driver.getByRole('link', { name: /Notifications, 1 unread/ }).click()
      const item = driver.getByRole('link', { name: /New ride request/ })
      await expect(item).toBeVisible()
      await expect(driver.getByText('Private test passenger')).toHaveCount(0)
      await fitsPhone(driver)
      await item.click()
      await expect(driver).toHaveURL(/\/volunteer\/opportunities$/)
      const hint = driver.getByRole('region', { name: 'Install Relay after accepting a ride' })
      await expect(hint).toBeHidden()
      await driver.getByRole('article', { name: "St. Paul's Hospital" }).getByRole('button', { name: 'Accept' }).tap()
      await expect(hint).toBeVisible()
      await driver.reload()
      await expect(hint).toBeVisible()
      await driver.goto(volunteerPaths.ride(rideId))
      await expect(driver.getByRole('heading', { level: 1, name: /^Ride to/ })).toBeVisible()
      await fitsPhone(driver)
      await hint.getByRole('button', { name: 'Maybe later' }).tap()
      await driver.reload()
      await expect(hint).toBeHidden()

      await partner.goto('/notifications')
      await expect(partner).toHaveURL(new RegExp(`${paths.notifications}$`))
      const confirmed = partner.getByRole('link', { name: /Driver confirmed/ })
      await expect(confirmed).toHaveAttribute('href', paths.ride(rideId))
      await expect(partner.getByRole('heading', { name: 'Inbox · 1 unread' })).toBeVisible()
      await partner.getByRole('button', { name: 'Mark all as read' }).tap()
      await partner.getByRole('button', { name: 'Unread', exact: true }).tap()
      await expect(partner.getByText('You’re caught up.')).toBeVisible()
      await fitsPhone(partner)
    })
  })
}

test('the worker serves a reconnect screen for an offline launch', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'Playwright only exposes service worker control on Chromium')
  await page.goto('/install/android')
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true))
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await context.setOffline(true)
  await page.goto('/launch')
  await expect(page.getByRole('heading', { name: "You're offline" })).toBeVisible()
  await context.setOffline(false)
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page).toHaveURL(/\/signin$/)
})

test('Android uses the browser install prompt when offered', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'The Chromium install event has no WebKit equivalent')
  await page.goto('/install/android')
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', { cancelable: true })
    Object.assign(event, { prompt: async () => ({ outcome: 'accepted' }) })
    window.dispatchEvent(event)
  })
  await page.getByRole('button', { name: 'Install Relay Collective' }).click()
  await expect(page.getByText('Relay Collective is installed.')).toBeVisible()
})
