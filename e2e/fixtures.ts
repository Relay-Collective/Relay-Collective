import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD } from '../src/services/seed'

// Shared setup for every browser test.
//
// Isolation: Playwright gives each test a new browser context, so localStorage and sessionStorage
// start empty and the mock backend loads the seeded demo data (src/services/seed.ts).
// Tabs opened with context.newPage() share that data, like two tabs in one browser.
//
// Safety: only the local Vite server is reachable. Every other request is blocked, and a test fails
// if anything tries to reach Supabase.

// A fixed moment for every test: Monday, October 5, 2026 at 10:00 AM in Vancouver. The seeded rides
// (Sep 28 – Oct 1) are then recent, every approved driver is taking requests, and greetings and
// "last 30 days" counts don't change with the time of day the suite runs. Timers still run normally,
// so polling and cross-tab updates work as usual.
export const FIXED_NOW = new Date('2026-10-05T17:00:00.000Z')

export interface Account {
  name: string
  email: string
  password: string
}

// Seeded demo accounts. Passwords come from the seed, so they can't drift from the app.
export const accounts = {
  belkin: { name: 'Belkin House', email: 'belkin@careride.demo', password: DEMO_PASSWORD },
  richmond: { name: 'Richmond House', email: 'richmond@careride.demo', password: DEMO_PASSWORD },
  frank: { name: 'Frank', email: 'frank@careride.demo', password: DEMO_PASSWORD },
  maya: { name: 'Maya', email: 'maya@careride.demo', password: DEMO_PASSWORD },
  jordan: { name: 'Jordan', email: 'jordan@careride.demo', password: DEMO_PASSWORD }, // driver, still pending review
  priya: { name: 'Priya', email: 'priya@careride.demo', password: DEMO_PASSWORD }, // general volunteer: no driver profile
  alex: { name: 'Alex Morgan', email: 'alex@careride.demo', password: DEMO_PASSWORD }, // general volunteer, interested in Transportation
  admin: { name: 'Relay Collective Admin', email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
} satisfies Record<string, Account>

function isLocal(url: URL): boolean {
  return url.hostname === '127.0.0.1' || url.hostname === 'localhost'
}

export const test = base.extend<{ blockedRequests: string[]; pageErrors: string[] }>({
  blockedRequests: async ({}, use) => use([]),
  pageErrors: async ({}, use) => use([]),

  context: async ({ context, blockedRequests, pageErrors }, use) => {
    await context.clock.setFixedTime(FIXED_NOW)
    // Live services stay out of the tests: Supabase, address search, maps, and the hospital wait-time
    // feed (fetched through the dev server's /api/wait-times proxy). The app falls back gracefully.
    await context.route(
      (url) => !isLocal(url) || url.pathname.startsWith('/api/wait-times'),
      (route) => {
        blockedRequests.push(route.request().url())
        return route.abort('blockedbyclient')
      },
    )
    context.on('weberror', (error) => pageErrors.push(error.error().message))
    await use(context)
    expect(
      blockedRequests.filter((url) => /supabase/i.test(url)),
      'the app tried to reach Supabase',
    ).toEqual([])
    expect(pageErrors, 'uncaught errors in the page').toEqual([])
  },
})

export { expect }

// Signs in through the real form, the way a person does, and opens their workspace.
// The demo-accounts panel only exists on the mock backend, so checking for it first means
// a misconfigured server can never sign in to a real backend.
export async function signIn(page: Page, account: Account): Promise<void> {
  await page.goto('/signin')
  await signInOnThisPage(page, account)
}

async function signInOnThisPage(page: Page, account: Account): Promise<void> {
  // The heading changes with screen size; the form doesn't
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible()
  await expect(page.getByText('Explore with a demo account'), 'the mock backend should be active').toBeVisible()
  await page.getByLabel('Email address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText(`You're signed in as ${account.name}.`)).toBeVisible()
  // "Open your workspace" for most people, "Open the admin console" for platform admins
  await page.getByRole('link', { name: /^Open (your workspace|the admin console)$/ }).click()
  await expect(page).not.toHaveURL(/\/(signed-in|home)$/)
}

// A second tab in the same browser, signed in as someone else. A new tab starts as whoever signed
// in last, so it signs out first ("Sign in with another account"). Each tab keeps its own sign-in,
// and both see the same demo data, so a partner and a driver can work on the same ride.
export async function signInInNewTab(context: BrowserContext, account: Account): Promise<Page> {
  const page = await context.newPage()
  await page.goto('/signin')
  await page.getByRole('button', { name: 'Sign in with another account' }).click()
  // That button signs this tab out and opens the sign-in form itself
  await signInOnThisPage(page, account)
  return page
}
