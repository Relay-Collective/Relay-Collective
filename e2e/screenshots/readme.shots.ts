import type { Page } from '@playwright/test'
import { accounts, signIn, signInInNewTab, test } from '../fixtures'
import { bookRide } from '../helpers'
// Run with npm run docs:screenshots. Writes the README pictures to docs/images at 2x, from the demo data
// with a few rides booked and one accepted, so every overview has something on it.
const O = 'docs/images'
test.use({ reducedMotion: 'reduce', deviceScaleFactor: 2 })
// Hide the floating What's new chip so screenshots show the page itself
const clean = (p: Page) => p.addStyleTag({ content: '[aria-label^="Version "]{visibility:hidden !important}' })

test('home', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 856 })
  await page.goto('/')
  await clean(page)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: O + '/home.png' })
  await page.locator('#ride').screenshot({ path: O + '/ride.png' })
})
test('mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await clean(page)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: O + '/mobile.png' })
})
test('workspaces', async ({ page, context }) => {
  test.slow()
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, accounts.belkin)
  await bookRide(page, { destination: /^St\. Paul's Hospital/, when: 'In 2 hours', passenger: 'Morgan' })
  await bookRide(page, { destination: /^Vancouver General Hospital/, when: 'Tomorrow, 9 AM', passenger: 'Avery' })
  await bookRide(page, { destination: /^St\. Paul's Hospital/, when: 'Tomorrow, 1 PM', passenger: 'Jamie' })
  const d = await signInInNewTab(context, accounts.frank)
  await d.setViewportSize({ width: 1440, height: 900 })
  await d.goto('/volunteer/opportunities')
  await d.getByRole('article').first().getByRole('button', { name: 'Accept' }).click()
  await d.waitForTimeout(500)
  await d.goto('/volunteer')
  await clean(d)
  await d.waitForTimeout(800)
  await d.screenshot({ path: O + '/volunteer.png' })

  await page.bringToFront()
  await page.goto('/workspace')
  await page.waitForTimeout(600)
  const close = page.getByRole('button', { name: /^Dismiss|^Close/ })
  if (await close.count()) await close.first().click()
  await clean(page)
  await page.waitForTimeout(500)
  await page.screenshot({ path: O + '/workspace.png' })
  await page.goto('/workspace/transportation')
  await clean(page)
  await page.waitForTimeout(800)
  await page.screenshot({ path: O + '/careride.png' })

  const a = await signInInNewTab(context, accounts.admin)
  await a.setViewportSize({ width: 1440, height: 900 })
  await a.goto('/admin')
  await clean(a)
  await a.waitForTimeout(800)
  await a.screenshot({ path: O + '/admin.png' })
})
