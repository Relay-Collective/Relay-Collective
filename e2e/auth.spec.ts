import { accounts, expect, signIn, test } from './fixtures'

test.describe('signing in and out', { tag: '@smoke' }, () => {
  test('the landing page loads and leads to sign-in', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Technology that brings us together.' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Technology that brings us together.' }).getByRole('link', { name: 'Get started' })).toBeVisible()

    await page.getByRole('banner').getByRole('link', { name: 'Log in' }).click()
    await expect(page).toHaveURL(/\/signin$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your account' })).toBeVisible()
  })

  test('the app is running on the demo (mock) backend', async ({ page }) => {
    await page.goto('/signin')
    await expect(page.getByText('Explore with a demo account')).toBeVisible()
    await signIn(page, accounts.belkin)
    await expect(page.getByRole('contentinfo').getByText('Demo data only.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset demo data' })).toBeVisible()
  })

  test('a partner organization signs in to its workspace', async ({ page }) => {
    await signIn(page, accounts.belkin)
    await expect(page).toHaveURL(/\/workspace$/)
    await expect(page.getByRole('complementary', { name: 'Sidebar' }).getByText('Belkin House')).toBeVisible()
    await expect(
      page
        .getByRole('main')
        .getByRole('definition')
        .filter({ hasText: /^Belkin House$/ }),
    ).toBeVisible()
  })

  test('a volunteer driver signs in to the volunteer workspace', async ({ page }) => {
    await signIn(page, accounts.frank)
    await expect(page).toHaveURL(/\/volunteer$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Good morning, Frank.' })).toBeVisible()
  })

  test('a platform admin signs in to the admin console', async ({ page }) => {
    await signIn(page, accounts.admin)
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Platform overview' })).toBeVisible()
  })

  test('signing out ends the session and protects workspace pages', async ({ page }) => {
    await signIn(page, accounts.belkin)
    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your account' })).toBeVisible()

    await page.goto('/workspace/transportation')
    await expect(page).toHaveURL(/\/signin$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in to your account' })).toBeVisible()
  })

  test('a wrong password is refused with a clear message', async ({ page }) => {
    await page.goto('/signin')
    await page.getByLabel('Email address').fill(accounts.belkin.email)
    await page.getByLabel('Password', { exact: true }).fill('not-the-password')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByText("That email and password don't match. Please try again.")).toBeVisible()
    await expect(page).toHaveURL(/\/signin$/)
  })

  test('empty fields are caught before anything is sent', async ({ page }) => {
    await page.goto('/signin')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByText('Enter your email.')).toBeVisible()
    await page.getByLabel('Email address').fill('not-an-email')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(page.getByText("That doesn't look like an email. Check for typos.")).toBeVisible()
  })
})
