import { defineConfig, devices } from '@playwright/test'

// Browser tests: a production build with the in-browser mock backend, served by `vite preview`.
// Every test gets a fresh browser context, so it starts from the seeded demo data. See docs/E2E_TESTING.md.

const HOST = '127.0.0.1'
const PORT = 5179
const CI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  // Tests never share a browser context, so they can run in parallel. A test that needs two people
  // opens two tabs in its own context.
  fullyParallel: true,
  workers: CI ? 2 : undefined,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_500 },
  reporter: CI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    baseURL: `http://${HOST}:${PORT}`,
    // The app shows times in the browser's zone; the demo is in Vancouver.
    timezoneId: 'America/Vancouver',
    locale: 'en-US',
    screenshot: 'only-on-failure',
    // Recording every test makes the suite several times slower, so traces and videos are kept for
    // retried tests only. CI retries a failure once. Locally, add --trace on to record.
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    // A separate dist-e2e/ folder, so a mock build never ends up in the dist/ that npm run deploy uploads.
    // --strictPort fails instead of quietly moving to a port the tests don't know about.
    command: `npx vite build --outDir dist-e2e --emptyOutDir --logLevel error && npx vite preview --outDir dist-e2e --host ${HOST} --port ${PORT} --strictPort`,
    url: `http://${HOST}:${PORT}`,
    // Never attach to a server someone already started: it might be pointed at Supabase.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      // Environment values beat .env.local, so a developer's Supabase or Maps settings can't leak in.
      VITE_DATA_BACKEND: 'mock',
      VITE_SUPABASE_URL: '',
      VITE_SUPABASE_PUBLISHABLE_KEY: '',
      VITE_PUBLIC_SITE_URL: '',
      VITE_GOOGLE_MAPS_API_KEY: '',
      VITE_GOOGLE_MAPS_MAP_ID: '',
    },
  },
})
