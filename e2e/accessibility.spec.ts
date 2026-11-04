import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { accounts, expect, signIn, test, type Account } from './fixtures'

// Automated accessibility checks (axe-core) against WCAG 2.1 A and AA on representative pages.
// Automated checks find only some problems; keyboard and screen-reader testing by a person still matter.

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

// Problems that were already there when these checks were added, as an exact count per page and rule.
// Every rule stays switched on: a new problem fails the test, and so does fixing a known one, so this list
// only ever shrinks. Details and suggested fixes: docs/E2E_TESTING.md#known-accessibility-issues.
//
// label-content-name-mismatch (WCAG 2.5.3, Label in Name): an aria-label that doesn't contain the words on
//   screen. MetricCard and StatTile number tiles, the "What's new" version badge, and the landing hero cards.
// color-contrast on the landing page: the huge faded "Relay Collective" watermark, which is aria-hidden
//   decoration. WCAG 1.4.3 exempts pure decoration, so it stays listed rather than fixed.
const KNOWN_ISSUES: Record<string, Record<string, number>> = {
  'landing page': { 'label-content-name-mismatch': 6, 'color-contrast': 1 },
  'sign-in': { 'label-content-name-mismatch': 1 },
  'organization overview': { 'label-content-name-mismatch': 5 },
  'CareRide overview': { 'label-content-name-mismatch': 3 },
  'booking form': { 'label-content-name-mismatch': 1 },
  'volunteer overview': { 'label-content-name-mismatch': 5 },
  'admin overview': { 'label-content-name-mismatch': 7 },
  'organization overview on a phone': { 'label-content-name-mismatch': 5 },
  'volunteer overview on a phone': { 'label-content-name-mismatch': 5 },
}

async function expectOnlyKnownIssues(page: Page, name: string) {
  // Pages fade in. Measure colour contrast once the animations have finished, not halfway through.
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  const known = KNOWN_ISSUES[name] ?? {}

  // One line per unexpected problem, so a failure says what to fix and where
  const unexpected = violations
    .filter((v) => !(v.id in known))
    .flatMap((v) => v.nodes.map((n) => `[${v.impact}] ${v.id}: ${v.help} — ${n.target.join(' ')}`))
  expect(unexpected, 'new accessibility violations').toEqual([])

  const found = Object.fromEntries(Object.keys(known).map((id) => [id, violations.find((v) => v.id === id)?.nodes.length ?? 0]))
  expect(found, 'known issues changed: if you fixed one, lower its count in KNOWN_ISSUES').toEqual(known)
}

const pages: { name: string; account?: Account; path: string; ready: (page: Page) => Promise<void> }[] = [
  { name: 'landing page', path: '/', ready: (p) => expect(p.getByRole('heading', { level: 1 })).toBeVisible() },
  { name: 'sign-in', path: '/signin', ready: (p) => expect(p.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible() },
  {
    name: 'organization overview',
    account: accounts.belkin,
    path: '/workspace',
    ready: (p) => expect(p.getByRole('region', { name: 'Your modules' })).toBeVisible(),
  },
  {
    name: 'CareRide overview',
    account: accounts.belkin,
    path: '/workspace/transportation',
    ready: (p) => expect(p.getByRole('heading', { level: 1, name: 'Ride overview' })).toBeVisible(),
  },
  {
    name: 'booking form',
    account: accounts.belkin,
    path: '/workspace/transportation/new',
    ready: (p) => expect(p.getByRole('button', { name: 'Request ride' })).toBeVisible(),
  },
  {
    name: 'volunteer overview',
    account: accounts.frank,
    path: '/volunteer',
    ready: (p) => expect(p.getByRole('region', { name: 'CareRide' })).toBeVisible(),
  },
  {
    name: 'admin overview',
    account: accounts.admin,
    path: '/admin',
    ready: (p) => expect(p.getByRole('region', { name: 'Platform metrics' })).toBeVisible(),
  },
]

test.describe('accessibility', () => {
  for (const { name, account, path, ready } of pages) {
    test(`${name} has no new WCAG A/AA violations`, async ({ page }) => {
      if (account) await signIn(page, account)
      await page.goto(path)
      await ready(page)
      await expectOnlyKnownIssues(page, name)
    })
  }

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

    test('the organization overview has no new WCAG A/AA violations', async ({ page }) => {
      await signIn(page, accounts.belkin)
      await expect(page.getByRole('region', { name: 'Your modules' })).toBeVisible()
      // The account menu button keeps its name when the label is hidden on small screens
      await expect(page.getByRole('banner').getByRole('button', { name: 'Belkin House' })).toBeVisible()
      await expectOnlyKnownIssues(page, 'organization overview on a phone')
    })

    // The night surfaces (console 2.0): the tab bar along the foot of the volunteer workspace, and the drawer
    test('the volunteer overview, with its night tab bar, has no new WCAG A/AA violations', async ({ page }) => {
      await signIn(page, accounts.frank)
      await expect(page.getByRole('navigation', { name: 'Quick' })).toBeVisible()
      await expectOnlyKnownIssues(page, 'volunteer overview on a phone')
    })

    test('the open navigation drawer has no new WCAG A/AA violations', async ({ page }) => {
      await signIn(page, accounts.belkin)
      await page.getByRole('button', { name: 'Open navigation' }).click()
      await expect(page.getByRole('dialog', { name: 'Navigation' })).toBeVisible()
      await expectOnlyKnownIssues(page, 'navigation drawer on a phone')
    })
  })
})
