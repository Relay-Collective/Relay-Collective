import { accounts, expect, signIn, signInInNewTab, test } from './fixtures'

// What each kind of account can open in the browser. These check the screens only: the database's
// row-level security is what protects data, and npm run test:db tests it against the real SQL.

test.describe('role-based access', () => {
  test('a signed-out visitor is sent to sign-in, then back to the page they asked for', async ({ page }) => {
    for (const path of ['/workspace', '/workspace/transportation/new', '/volunteer', '/admin/users']) {
      await page.goto(path)
      await expect(page, `${path} should need sign-in`).toHaveURL(/\/signin$/)
    }
    // Signing in from a protected link returns there
    await page.goto('/workspace/team')
    await page.getByLabel('Email address').fill(accounts.belkin.email)
    await page.getByLabel('Password', { exact: true }).fill(accounts.belkin.password)
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await page.getByRole('link', { name: 'Continue where you left off' }).click()
    await expect(page).toHaveURL(/\/workspace\/team$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Team and memberships' })).toBeVisible()
  })

  test('a partner organization cannot open the admin console', async ({ page }) => {
    await signIn(page, accounts.belkin)
    for (const path of ['/admin', '/admin/users', '/admin/approvals']) {
      await page.goto(path)
      await expect(page, `${path} should send a partner home`).toHaveURL(/\/workspace$/)
    }
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Approvals' })).toHaveCount(0)
  })

  test('a driver cannot open the organization workspace or the admin console', async ({ page }) => {
    await signIn(page, accounts.frank)
    for (const path of ['/workspace/team', '/workspace/transportation/new', '/admin']) {
      await page.goto(path)
      await expect(page, `${path} should send a driver home`).toHaveURL(/\/volunteer$/)
    }
  })

  test('a driver awaiting review gets no ride requests', async ({ page }) => {
    await signIn(page, accounts.jordan)
    await page.goto('/volunteer/profile/verification')
    await expect(page.getByRole('region', { name: 'Review status' }).getByRole('status')).not.toHaveText('You’re approved to drive.')
    await page.goto('/volunteer/opportunities')
    await expect(page.getByRole('region', { name: 'Transportation requests' }).getByRole('button', { name: 'Accept' })).toHaveCount(0)
  })

  // Every seeded partner account is its organization's administrator, so the staff member is made the
  // way a real one is: they sign up, ask to join, and the administrator approves them as Staff.
  test('organization staff do not get administrator controls', { tag: '@critical' }, async ({ page: staff, context }) => {
    test.slow()
    await staff.goto('/register')
    await staff.getByLabel('Full name').fill('Robin Test (Fictional)')
    await staff.getByLabel('Email address').fill('robin.test@example.org')
    await staff.getByLabel('Password', { exact: true }).fill('a-long-test-password')
    await staff.getByRole('button', { name: 'Create account' }).click()
    await expect(staff.getByRole('heading', { level: 1, name: 'How would you like to get started?' })).toBeVisible()

    await staff.goto('/onboarding/join')
    await staff.getByRole('combobox', { name: 'Organization name' }).fill('Belkin')
    await staff.getByRole('option', { name: /^Belkin House/ }).click()
    await staff.getByRole('button', { name: 'Continue' }).click()
    await expect(staff.getByRole('heading', { level: 1, name: 'Request to join Belkin House' })).toBeVisible()
    await staff.getByRole('button', { name: 'Request to Join' }).click()
    await expect(staff.getByRole('heading', { level: 1, name: 'Your request has been sent.' })).toBeVisible()

    // Belkin House's administrator approves, as Staff
    const admin = await signInInNewTab(context, accounts.belkin)
    await admin.goto('/workspace/team?tab=requests')
    await admin.getByRole('button', { name: 'Review request from Robin Test (Fictional)' }).click()
    const review = admin.getByRole('dialog', { name: 'Request from Robin Test (Fictional)' })
    await expect(review.getByRole('radio', { name: /^Staff/ })).toBeChecked()
    await review.getByRole('button', { name: 'Approve Request' }).click()
    await admin.getByRole('dialog', { name: 'Approve this request?' }).getByRole('button', { name: 'Approve as Staff' }).click()
    await expect(admin.getByRole('dialog')).toHaveCount(0)

    // The status page checks every 15 seconds; reloading shows the decision straight away
    await staff.bringToFront()
    await staff.reload()
    await staff.goto('/workspace/team')
    await expect(staff.getByText('Your request to join Belkin House has been approved. Welcome to the workspace.')).toBeVisible()

    // Staff see the members, but not join requests, invitations, or anyone's email
    await expect(staff.getByRole('tablist', { name: 'Team' }).getByRole('tab')).toHaveText(['Members'])
    const members = staff.getByRole('table', { name: 'Members of Belkin House' })
    await expect(members.getByRole('row', { name: /Robin Test \(Fictional\) You Staff/ })).toBeVisible()
    await expect(members.getByRole('columnheader', { name: 'Email' })).toHaveCount(0)

    // and can't change who can find the organization
    await staff.goto('/workspace/organization')
    const visibility = staff.getByRole('region', { name: 'Organization Visibility' })
    await expect(visibility.getByRole('radio', { name: /^Invitation Only/ })).toBeDisabled()
    await expect(visibility).toContainText('Only your organization’s administrators can change this.')
    await expect(visibility.getByRole('button', { name: 'Save visibility' })).toHaveCount(0)

    // Booking rides is part of a staff member's job
    await staff.getByRole('banner').getByRole('link', { name: 'Request a ride' }).click()
    await expect(staff.getByRole('heading', { level: 1, name: 'Request a ride' })).toBeVisible()
  })
})
