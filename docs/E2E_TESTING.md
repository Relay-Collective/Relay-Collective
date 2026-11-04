# Browser tests (Playwright)

End-to-end tests that drive Relay Collective in a real browser, the way people use it: signing in, booking a ride, a driver accepting and driving it, an admin approving a driver. They catch what unit and database tests can't: a renamed button, a broken page, a flow that no longer finishes.

They run against the **demo (mock) backend only**, on your machine or on a GitHub runner. They never touch Supabase, send email, or book a real ride.

## Run them

```bash
npm ci
npx playwright install chromium   # once, and again after Playwright is upgraded
npm run test:e2e
```

Nothing else to start: Playwright builds the app and serves it itself. The whole suite takes under a minute on a laptop.

| Command | What it does |
| --- | --- |
| `npm run test:e2e` | Every browser test, headless. |
| `npm run test:e2e:smoke` | Only the quick `@smoke` checks: the app loads, each role signs in, the main pages open. |
| `npm run test:e2e:ui` | Playwright's UI mode: pick tests, watch them run, step through each action. |
| `npm run test:e2e:headed` | Run with the browser window visible. |
| `npm run test:e2e:report` | Open the HTML report from the last run. |
| `npx playwright test e2e/careride.spec.ts` | One file. Add `-g "drop-off"` to pick tests by name. |
| `npx playwright test --trace on` | Record a trace for every test (slower), then open it from the report. |

`npm test` is unchanged and still runs only the unit tests. Browser tests never start from it.

## What's covered

61 tests in [`e2e/`](../e2e). Tags: `@smoke` for fast launch checks, `@critical` for the journeys that matter most.

| File | Scenarios |
| --- | --- |
| [auth.spec.ts](../e2e/auth.spec.ts) | Landing page loads and leads to sign-in · the app is on the mock backend · partner, driver and platform admin each sign in to their own workspace · sign-out ends the session and protects workspace pages · a wrong password and empty fields are refused with clear messages |
| [organization.spec.ts](../e2e/organization.spec.ts) | Overview shows the organization, the person's role and what needs attention · Modules: CareRide is active, planned modules say so and offer nothing to click · opening CareRide · every sidebar link reaches its page and is marked current · an administrator sees every team tab and the visibility setting |
| [careride.spec.ts](../e2e/careride.spec.ts) | Transportation overview totals · booking a scheduled ride, and which drivers are asked · a past ride's details · changing a waiting ride · history lists completed rides only · the form refuses a booking with no destination · **the full lifecycle**: a partner books, a driver accepts, goes through each trip step and drops off, and both see it finish and move to history |
| [volunteer.spec.ts](../e2e/volunteer.spec.ts) | Driver dashboard · a fitting request shows up in Opportunities and accepting it makes a commitment · declining removes it · availability changes are saved and kept after a reload · an unsaved change can be cancelled · verification shows an approved driver's status and requirements |
| [admin.spec.ts](../e2e/admin.spec.ts) | Dashboard totals and every console section · organizations list, filter and detail · approvals list, and approving a pending driver · feedback a partner sends shows up for the admin, with its details · transportation oversight list and ride detail, without private rider details |
| [permissions.spec.ts](../e2e/permissions.spec.ts) | Signed-out visitors are sent to sign-in and back to the page they asked for · partners can't open the admin console · drivers can't open the organization workspace or the console · a driver awaiting review gets no requests · **organization staff** (created by signing up, asking to join and being approved) don't get administrator controls |
| [responsive.spec.ts](../e2e/responsive.spec.ts) | On a 390 × 844 touch screen: landing menu, organization, volunteer and admin navigation drawers open, close and reach their pages · the booking button is reachable · a dialog can be dismissed · no page scrolls sideways |
| [console.spec.ts](../e2e/console.spec.ts) | The console 2.0 look, by what it promises: the greeting's accent word keeps the heading's words · the sidebar marks one current page and it moves · the sidebar collapses to icons, keeps every link named and remembers the choice · the CareRide card opens the module and its drawing stays out of the accessibility tree · CareRide's segmented tabs mark the current page, History included · the admin sidebar reaches its last section · with reduced motion the route is drawn in full and nothing moves · on a phone, the night tab bar and the drawer mark the current page |
| [accessibility.spec.ts](../e2e/accessibility.spec.ts) | axe-core WCAG 2.1 A/AA checks on the landing page, sign-in, organization overview, CareRide overview, booking form, volunteer overview, admin overview, and on a phone the organization overview, the volunteer overview with its night tab bar, and the open navigation drawer |

Browser tests check what people see. They don't replace the database's access rules: `npm run test:db` tests those against the real SQL.

## How it works

### The server

[`playwright.config.ts`](../playwright.config.ts) builds the app with `vite build` into `dist-e2e/` and serves it with `vite preview` on `http://127.0.0.1:5179` (`--strictPort`, so it fails rather than moving to another port).

- **Why a build, not `npm run dev`?** Both were measured with the same tests running in parallel: the dev server took 1.6 minutes at about 260% CPU, the build 58 seconds. The dev server serves hundreds of separate modules to every new browser context, which is too slow on a two-core CI runner. The build is also what actually ships.
- **Why `dist-e2e/`?** So a mock build can never end up in `dist/`, the folder `npm run deploy` uploads to Cloudflare.
- **`reuseExistingServer: false`.** Playwright never attaches to a server you started yourself, which might be pointed at Supabase. If port 5179 is taken, the run stops with an error.

### Never the real backend

Four separate guards:

1. **The build's settings.** The web server sets `VITE_DATA_BACKEND=mock` and empties `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_PUBLIC_SITE_URL` and the Google Maps variables. Environment values beat `.env.local`, so your local Supabase settings can't leak in. You can check: the `dist-e2e/` bundle contains no Supabase address.
2. **A check before every sign-in.** `signIn()` first looks for **Explore with a demo account**, which only the mock backend shows. A build that somehow pointed at Supabase fails there, before any password is typed.
3. **Only the local server is reachable.** [`e2e/fixtures.ts`](../e2e/fixtures.ts) blocks every request that doesn't go to `127.0.0.1`: Supabase, Photon address search, Google Maps, and the hospital wait-time feed (fetched through the server's `/api/wait-times` proxy). The app shows its usual fallbacks.
4. **A test fails if anything even tried to reach Supabase.**

The same fixture also fails a test when the page throws an uncaught error, so a crash on a page fails the test even if what the test checks still looks right.

### The clock

Every test runs at **Monday, October 5, 2026, 10:00 AM in Vancouver** (`FIXED_NOW` in `fixtures.ts`), using Playwright's `clock.setFixedTime`. Without it, greetings ("Good morning"), "last 30 days" counts, which drivers are taking requests, and booking quick picks would change with the time of day. Fixing the time keeps the seeded rides (Sep 28 – Oct 1) recent and every approved driver available. Only the date and time are fixed: timers still run, so the app's polling and cross-tab updates work normally. Tests also run with `timezoneId: 'America/Vancouver'` and `locale: 'en-US'`.

### Isolation and demo data

The mock backend keeps everything in the browser's `localStorage`, with each tab's sign-in also in `sessionStorage`. Playwright gives every test a **new browser context**, with empty storage, so every test starts from the seed data in [`src/services/seed.ts`](../src/services/seed.ts). Nothing carries over between tests, so they run in parallel and nothing needs resetting. A test can make real changes (approve a driver, book a ride) without affecting any other test.

**Two people in one test.** A partner and a driver need to see the same ride, so they share one context, the way two tabs share one browser:

```ts
test('...', async ({ page: partner, context }) => {
  await signIn(partner, accounts.belkin)
  const driver = await signInInNewTab(context, accounts.frank)
  // both tabs see the same demo data; each keeps its own sign-in
})
```

A new tab starts as whoever signed in last, so `signInInNewTab` first uses **Sign in with another account** on that tab. The first tab stays signed in, because each tab keeps its own session copy. Changes reach the other tab through storage events and the app's 4-second refresh. Assertions wait for them; nothing sleeps.

**Never use Reset demo data in a test.** It isn't needed (each test already starts from the seed), and in a two-tab test it would wipe the other person's data.

### Accounts

From the seed. Passwords are read from `src/services/seed.ts`, not copied into tests.

| Key in `accounts` | Who | Signs in to |
| --- | --- | --- |
| `belkin`, `richmond` | Partner organizations (each is its organization's administrator) | `/workspace` |
| `frank` | Driver: approved, any time, Vancouver and Richmond | `/volunteer` |
| `maya` | Driver: approved, 7 AM–10 PM | `/volunteer` |
| `jordan` | Driver: still pending review, Richmond only | `/volunteer` |
| `admin` | Relay Collective platform admin | `/admin` |

The seed has no organization staff member. The staff test creates one the real way: a new person signs up, asks to join Belkin House, and Belkin's administrator approves them as Staff. All new names are marked **(Fictional)** and use `example.org` addresses.

## Reports and debugging

- **Locally:** the list reporter prints progress. The HTML report opens by itself when something fails (`npm run test:e2e:report` opens it any time). Failed tests keep a screenshot in `test-results/`.
- **Traces:** recorded only for a retried test, because recording every test made the suite about five times slower. To debug locally, run with `--trace on`, then open the trace from the report (or `npx playwright show-trace test-results/<test>/trace.zip`). It has every action, DOM snapshot, console message and network request.
- **Step through:** `npm run test:e2e:ui`, or add `await page.pause()` and run `npm run test:e2e:headed`.
- **In CI:** see [CI](#ci) below.

Everything in reports, screenshots and traces is seeded demo data or the fictional names the tests type in. No real account or client appears.

## CI

The `e2e-tests` job in [Relay Collective CI](../.github/workflows/ci.yml) runs on every pull request into `main`, every push to `main`, and from **Run workflow**, alongside `quality` and `database-tests`. It doesn't depend on the other jobs and uses no secrets.

1. `npm ci`, then `npx playwright install --with-deps --only-shell chromium`: the headless browser at the version in `package-lock.json`, plus the system libraries it needs.
2. `npm run test:e2e` with `CI` set, which means 2 workers, one retry for a failed test, and `test.only` refused.
3. A summary on the run page, the **playwright-report** artifact (14 days), and for failures the **playwright-failures** artifact (7 days) with screenshots, plus the trace and video of the retry.

A test that fails and then passes on its retry is reported as **flaky**. The job still passes, but treat that as a bug to fix, not noise.

To make it a required check, see [Branch protection](CI_CD.md#branch-protection). Add `e2e-tests` only after it has passed on GitHub.

## Writing a test

- **Start from the fixtures:** `import { accounts, expect, signIn, test } from './fixtures'`. Never import `test` from `@playwright/test` directly, or you lose the network block, the clock and the page-error check.
- **Find things the way people do:** `getByRole('button', { name: 'Request ride' })`, `getByLabel('Email address')`, `getByRole('region', { name: 'Trip progress' })`. Avoid CSS classes, Tailwind utilities and DOM structure. If something important has no accessible name, give it one in the app rather than adding a `data-testid`.
- **Hidden inputs:** the booking form's and the availability page's radio buttons and checkboxes are cards drawn over a visually hidden input. Use `choose(radio)` from [`helpers.ts`](../e2e/helpers.ts), or `focus()` then `press('Space')`, instead of forcing a click.
- **Never sleep.** No `waitForTimeout`. Use `expect(...)` assertions, which retry until they pass or time out (7.5 seconds).
- **Copy the app's rules, don't restate them:** `rideReference()` comes from the app's own `requestReference`, and passwords from the seed.
- **Long journeys:** call `test.slow()` (three times the 30-second limit) when a test covers a whole multi-person flow.
- **Before pushing a new or changed test,** run it several times in parallel to catch flakiness: `npx playwright test e2e/<file> --repeat-each 5`.

## Troubleshooting

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| `Executable doesn't exist at …ms-playwright…` | The browser isn't installed, or Playwright was upgraded | `npx playwright install chromium` |
| `http://127.0.0.1:5179 is already used` | Something else is on that port, maybe an earlier run that didn't exit | Stop it (`lsof -i :5179`), then run again. The tests never reuse it. |
| The mock-backend check fails before sign-in | The build is using Supabase | Check that nothing changed the `webServer.env` block in `playwright.config.ts` |
| `uncaught errors in the page` | The app threw an exception | A real bug: the message names it. Fix the app, not the test. |
| `strict mode violation … resolved to 2 elements` | The locator matches more than one thing | Narrow it with a parent (`getByRole('region', …)`), or a more exact name |
| A test passes alone but fails with others | Usually it's slow under load, not shared state | Check the time in the report. Use `test.slow()` for genuinely long flows. |
| A time or date assertion is off | The test depends on the real clock | Use the fixtures' `test`, and assert times relative to `FIXED_NOW` |

## Known accessibility issues

The accessibility tests found these. They aren't fixed yet: each changes what screen readers announce on several pages, which is a product decision. [`accessibility.spec.ts`](../e2e/accessibility.spec.ts) lists each one as an exact count per page in `KNOWN_ISSUES`. **Every axe rule stays on**: a new problem fails the test, and fixing a known one also fails it, until its count in `KNOWN_ISSUES` is lowered.

| Rule | Where | Problem | Suggested fix |
| --- | --- | --- | --- |
| `label-content-name-mismatch` (WCAG 2.5.3, Label in Name) | `MetricCard` (organization, volunteer and admin overviews) | The link's `aria-label` ("Need attention: 0. Nothing waiting on you") doesn't contain the text on screen. The visible spans are `aria-hidden` and run together. People using voice control say what they see, and it doesn't match. | Drop the `aria-label` and let the visible text name the link, or start the label with the visible label word for word |
| same | CareRide `StatTile` buttons ("3 Completed. Show past rides") | Same | Same |
| same | `VersionBadge` (every page): visible "What's new v1.7", name "Version 1.7. See what's new" | The visible words aren't in the name, in that order | e.g. `aria-label="What's new, version 1.7 (new updates)"` |
| same | Landing hero cards (`HeroProductEcosystem`) | Same | Same approach |
| `color-contrast` | Landing page: the large faded "Relay Collective" watermark | `aria-hidden` decoration. WCAG 1.4.3 exempts pure decoration, so this one needs no fix. | Leave it; it stays listed so the count is honest |

Fixed while adding these tests (screenshots before and after were compared pixel by pixel and are identical):

- **The account menu button had no name on phones** (`button-name`, critical). Below the `sm` breakpoint the name was `hidden`, which also hides it from screen readers. It's now visually hidden instead (`sr-only sm:not-sr-only`), so the button is called "Belkin House" at every size.
- **The booking form's trip summary had invalid list markup** (`definition-list`, `dlitem`). Each `dt`/`dd` pair was nested two `div`s deep inside the `dl`. The icon now sits inside the `dt`.

Automated checks catch only some problems. Keyboard-only and screen-reader passes by a person are still needed, especially for the booking form and the driver's trip steps.

## Bugs the tests found

- **Landing page crash on phones.** The animated hero (`HeroMesh`) called `drawImage` with a 0 × 0 canvas when the hero collapsed behind the phone menu after a tap, throwing an uncaught error inside its animation frame. The page-error check caught it: 19 of 30 repeated runs failed. It now skips that drawing while the canvas has no size, and the same 30 runs pass.
- **Build date with `en-CA`** (cosmetic, not fixed). With a Canadian English browser, the sign-in footer reads "This build Mon, Oct 5, 10:00 a.m.." with two full stops, because the date already ends in "a.m.". The tests use `en-US`.

## Limits

- **Chromium only.** No Firefox or WebKit (Safari) yet. Android's WebView is Chromium, but iPhone Safari isn't covered.
- **Mock backend only.** The Supabase path (`supabaseService.ts`, Auth emails, Realtime, Edge Functions, `pg_cron` deadlines) isn't exercised in a browser. The database tests cover the SQL. A Supabase staging project would be needed for the rest.
- **Not yet tested in a browser:** organization registration and driver sign-up through admin approval, invitations by link, cancellations and no-shows, offer expiry and "no driver available" (these need the clock to move forward), the return-trip and book-again flows, saved destinations, the "Somewhere else" address search (it needs the live Photon service, which is blocked), screenshots in feedback, account deletion, the `/demo` deck, and the Capacitor Android app itself.
- **Visual changes** aren't checked. These tests check behaviour, not pixels.

## Next steps

1. Run `e2e-tests` on a few pull requests, then make it a required check.
2. Add tests for the flows under [Limits](#limits), starting with cancellation, no-show and offer expiry (with `page.clock` moving time forward).
3. Fix the `label-content-name-mismatch` issues above, and lower the counts in `KNOWN_ISSUES` as each one goes.
4. Add a WebKit project (`devices['iPhone 13']`) for iPhone Safari layouts.
5. A **staging** run: the same tests against a Cloudflare preview build pointed at a separate Supabase project with fictional data, to cover Auth, Realtime and the SQL ride functions in a browser.
6. **Smoke tests after each deploy:** the `@smoke` tests, read-only, against the production URL with no sign-in that changes data. Run on a schedule or after Cloudflare deploys, never from pull requests.
