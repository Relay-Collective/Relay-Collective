import type { Page } from '@playwright/test'
import { accounts, expect, signIn, signInInNewTab, test } from './fixtures'
import { bookRide } from './helpers'

// Who a ride request reaches, from the drivers' side.
//
// Stakeholder testing, 2026-11-09: a request showed on one driver account but not on a stakeholder's existing driver
// account with the same settings, nor on a driver account created during the session. Every approved driver a request
// fits must see it: whichever account was used first, whether they have driven before, and whether they were approved
// or changed their availability after the request went out.
//
// The clock is pinned to Monday 2026-10-05, 10:00 Vancouver (fixtures.ts). At that time Frank (any time) and Maya
// (7 AM to 10 PM daily) both take requests in Vancouver and Richmond. Jordan is waiting for review, in Richmond only.

function transportRequests(page: Page) {
  return page.getByRole('region', { name: 'Transportation requests' })
}

async function expectRequest(page: Page, destination: string) {
  await page.goto('/volunteer/opportunities')
  await expect(transportRequests(page).getByRole('article', { name: destination })).toBeVisible()
}

async function approveJordan(admin: Page) {
  await admin.goto('/admin/approvals/drivers/d-jordan')
  const decision = admin.getByRole('region', { name: 'Decision' })
  await decision.getByRole('button', { name: 'Approve' }).click()
  await admin
    .getByRole('dialog')
    .getByRole('button', { name: /^Approve / })
    .click()
  await expect(decision.getByText('Jordan was approved.')).toBeVisible()
}

test.describe('ride requests reach every driver they fit', () => {
  test('two approved drivers with matching settings both see the same request', { tag: '@critical' }, async ({ page: partner, context }) => {
    test.slow()
    await signIn(partner, accounts.belkin)
    await bookRide(partner, { destination: /^Vancouver General Hospital/, when: 'Tomorrow, 9 AM', passenger: 'Quinn Test (Fictional)' })

    // Neither account is the one that happened to be used first: both are asked
    const maya = await signInInNewTab(context, accounts.maya)
    await expectRequest(maya, 'Vancouver General Hospital')
    const frank = await signInInNewTab(context, accounts.frank)
    await expectRequest(frank, 'Vancouver General Hospital')
  })

  test('an existing driver who has already taken a ride still sees new requests', async ({ page: partner, context }) => {
    test.slow()
    await signIn(partner, accounts.belkin)
    await bookRide(partner, { destination: /^Vancouver General Hospital/, when: 'Tomorrow, 9 AM', passenger: 'Quinn Test (Fictional)' })

    const frank = await signInInNewTab(context, accounts.frank)
    await expectRequest(frank, 'Vancouver General Hospital')
    await transportRequests(frank).getByRole('article', { name: 'Vancouver General Hospital' }).getByRole('button', { name: 'Accept' }).click()
    await expect(frank.getByText("Ride accepted. It's in your upcoming rides.")).toBeVisible()

    await partner.bringToFront()
    await bookRide(partner, { destination: /^St\. Paul's Hospital/, when: 'Tomorrow, 1 PM', passenger: 'Drew Test (Fictional)' })
    await frank.bringToFront()
    await expectRequest(frank, "St. Paul's Hospital")
  })

  test('a driver approved after a request went out sees it once approved', { tag: '@critical' }, async ({ page: partner, context }) => {
    test.slow()
    await signIn(partner, accounts.richmond)
    await bookRide(partner, { destination: /^Richmond Hospital/, when: 'Tomorrow, 9 AM', passenger: 'Rowan Test (Fictional)' })

    // Still waiting for review: no requests yet
    const jordan = await signInInNewTab(context, accounts.jordan)
    await jordan.goto('/volunteer/opportunities')
    await expect(transportRequests(jordan)).toHaveCount(0)

    const admin = await signInInNewTab(context, accounts.admin)
    await approveJordan(admin)

    await jordan.bringToFront()
    await jordan.reload()
    await expectRequest(jordan, 'Richmond Hospital')
    // The driver asked first keeps the request too
    const frank = await signInInNewTab(context, accounts.frank)
    await expectRequest(frank, 'Richmond Hospital')
  })

  test('a driver who turns their request hours back on sees a request that is already out', async ({ page: maya, context }) => {
    test.slow()
    await signIn(maya, accounts.maya)
    await maya.goto('/volunteer/availability')
    await maya.getByRole('switch', { name: 'Requests on Monday' }).click()
    await maya.getByRole('button', { name: 'Save changes' }).click()
    await expect(maya.getByText('Changes saved.')).toBeVisible()

    const partner = await signInInNewTab(context, accounts.belkin)
    await bookRide(partner, { destination: /^Vancouver General Hospital/, when: 'Tomorrow, 9 AM', passenger: 'Quinn Test (Fictional)' })

    const asMaya = await signInInNewTab(context, accounts.maya)
    await asMaya.goto('/volunteer/opportunities')
    await expect(transportRequests(asMaya).getByText('There are no transportation requests available to you right now.')).toBeVisible()

    await asMaya.goto('/volunteer/availability')
    await asMaya.getByRole('switch', { name: 'Requests on Monday' }).click()
    await asMaya.getByRole('button', { name: 'Save changes' }).click()
    await expect(asMaya.getByText('Changes saved.')).toBeVisible()
    await expectRequest(asMaya, 'Vancouver General Hospital')
  })
})
