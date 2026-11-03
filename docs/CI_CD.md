# CI and deployment

How Relay Collective checks every change, and how that relates to Cloudflare and Android. For local setup, see the [developer guide](DEVELOPMENT.md).

## What runs where

| Workflow | File | Runs on | Does |
| --- | --- | --- | --- |
| **Relay Collective CI** | [ci.yml](../.github/workflows/ci.yml) | Pull requests into `main`, pushes to `main`, **Run workflow** | Lint, unit tests with coverage, type-check and production build, database tests. Never deploys. |
| **Android debug APK** | [android.yml](../.github/workflows/android.yml) | Every pull request, **Run workflow** | Builds the debug APK and uploads it as `careride-debug-apk`. |
| **Cloudflare Workers Builds** | Cloudflare dashboard, not this repository | Pushes to `main` (production) and other branches (preview) | Builds and deploys the website and the Android live-update zip. |

## Relay Collective CI

Two jobs run in parallel on `ubuntu-latest`, each with Node from [`.nvmrc`](../.nvmrc), the npm cache, and `npm ci`:

| Job (status check name) | Steps | Timeout |
| --- | --- | --- |
| `quality` | `npm run lint` → `npm run test:coverage` → `npm run build` | 15 min |
| `database-tests` | `npm run test:db` | 15 min |

- **Every failing step fails its job.** In `quality`, lint, tests and build each run even when an earlier one failed, so one push shows every problem at once. Nothing uses `continue-on-error`.
- **`npm run test:coverage` is the unit test run.** It runs the same files as `npm test`, so CI doesn't run them twice.
- **`npm run build` is the TypeScript check.** `tsc -b` checks the app and the Node config projects before Vite builds. No `VITE_*` variables are set, so CI builds the demo (mock) version.
- **Each job writes a summary** on the run page: the result of each check and, for `quality`, a coverage table. The lcov file is uploaded as the **unit-test-coverage** artifact and kept for 14 days.
- **Superseded runs are cancelled** only on pull requests: a new push to a PR cancels that PR's older run. Each push to `main` and each manual run gets its own group, so none of those is cancelled.

### Security

- The token is read-only (`permissions: contents: read`), and checkout doesn't keep the token (`persist-credentials: false`).
- The workflow uses **no secrets**. It never touches the Supabase project, Cloudflare, or Android signing.
- It runs on `pull_request`, never `pull_request_target`, so code from a fork runs without secrets or write access.
- No `${{ }}` value from the pull request (title, branch name, body) is put into a shell command. The summary steps only read step outcomes, through environment variables.
- Actions are pinned to full commit SHAs, with the version in a comment. Dependabot proposes updates (see [Dependency updates](#dependency-updates)).

### Run the same checks locally

```bash
nvm use          # Node from .nvmrc
npm ci
npm run lint
npm run test:coverage   # or npm test, without coverage
npm run test:db
npm run build
```

**`.env.local` affects only your local build.** CI has no `.env.local`. To build what CI builds, use `VITE_DATA_BACKEND=mock npm run build`.

### When a check fails

| Failing step | Look at | Usual cause |
| --- | --- | --- |
| Install dependencies | The `npm ci` log | `package-lock.json` doesn't match `package.json`. Run `npm install` locally and commit the lockfile. |
| Lint (ESLint) | The file and line in the log | Run `npm run lint` locally. Fix the code; don't disable the rule. |
| Unit tests with coverage | The `✖` lines and the assertion diff | A rule changed without its test, or a test depends on the clock or time zone. Runners use UTC. |
| Type-check and production build | `error TS…` lines | A type error. `npm run build` reproduces it. |
| Database tests | The failing test name and the Postgres error | A migration changed an access rule, or a new migration doesn't apply cleanly after the earlier ones. |

## Unit tests

- **Where:** `tests/*.test.ts`, one file per area (ride rules, ride history, request, volunteer and admin summaries, memberships, onboarding, feedback, account deletion, the CareRide module).
- **How:** Node's built-in test runner, run through `tsx` so tests import TypeScript directly. Use `node:test` and `node:assert/strict`.
- **Add a test:** create `tests/<area>.test.ts`. `npm test` and CI pick it up automatically. Test pure rules directly, and use `src/services/mockService.ts` or `seed.ts` when a test needs data. Don't use real accounts, network calls, or the real clock: pass a fixed `now`, as the existing ride-rule tests do.

### Coverage

`npm run test:coverage` uses Node's built-in coverage (`--experimental-test-coverage`, available in Node 22). It prints a table after the tests and writes `coverage/lcov.info`, which is git-ignored. It counts only `src/` and `supabase/functions/`, so tests and dependencies don't inflate the numbers. **There is no minimum yet.** The numbers below are the baseline to improve on.

**Baseline (Node 22, November 2026), 104 tests:** 82.3% of lines, 83.8% of branches and 81.2% of functions in the **48 files the tests import**. Files no test imports aren't in the report at all, so this isn't coverage of the whole app.

- Covered well (over 90% of lines): driver matching and dispatch (`logic/dispatch.ts`, `matchDrivers.ts`), ride events, request, volunteer and admin summaries, feedback rules, workspace navigation and the module registry, and `seed.ts`.
- Partly covered: `services/mockService.ts` (88%), `logic/accountDeletion.ts` (89%), `logic/membership.ts` (92%), the account-deletion Edge Function workflow (67%), `volunteer/participation.ts` (74%).
- Little coverage: `logic/requestHours.ts` (50%), `logic/driverEta.ts`, `logic/estimateFare.ts`, `logic/validate.ts`, CareRide `pickupTime.ts`, `acceptedMessage.ts` and `rideInsights.ts`, `volunteer/navigation.ts`.
- Not covered by unit tests: `services/supabaseService.ts`, every React page and component, the Cloudflare Worker (`worker/index.ts`), and the Edge Function entry points.

`tsx` keeps type-only `import` lines in its source maps, so the first line of many files shows as uncovered. Line percentages are a little lower than the real figure.

**Next tests to add, most important first:**

1. **Ride functions in SQL.** The database runs the real ride rules (accept, advance, cancel, scheduled dispatch, safeguards), and no database test covers them yet. Only their TypeScript copy in the mock is tested. A change to one side that misses the other goes unnoticed.
2. **Onboarding functions in SQL:** `submit_organization_application`, `register_driver_profile`, `accept_invitation`.
3. **Request hours and pickup times** (`requestHours.ts`, `pickupTime.ts`): which rides can be booked and when.
4. **Input validation** (`validate.ts`) and the account-deletion Edge Function's error paths.

Add a threshold (for example `--test-coverage-lines=80`) once the baseline has held for a few weeks. Raise it after the tests above exist.

## Database tests

`npm run test:db` runs `tests/db/*.test.ts` against **PGlite**, an embedded Postgres compiled to WebAssembly that runs inside Node. No Docker, Supabase CLI, or network access is needed.

How [`tests/db/harness.ts`](../tests/db/harness.ts) builds each test database:

1. Starts an empty in-memory PGlite.
2. Loads [`supabase-stub.sql`](../tests/db/supabase-stub.sql), the parts of Supabase the migrations rely on: the `auth` and `storage` schemas, the `anon`, `authenticated` and `service_role` roles, and `auth.uid()` reading the JWT subject.
3. Applies every file in `supabase/migrations/` in filename order. `pg_cron` lines are removed, because PGlite doesn't have the extension.
4. `as(db, actor, …)` runs a query in its own transaction as `anon` or `authenticated`, with that person's JWT subject, the way PostgREST does. Row-level security and `security definer` functions apply as they do in production.

The tests cover organization membership (discovery, join requests, approval, roles, isolation between organizations, invitations), permanent account deletion (who may delete, safeguards, the retryable job, anonymization), and product feedback (who can send and read it, admin triage).

**Limits compared with real Supabase:** no PostgREST, Auth server, Storage server, Realtime or `pg_cron`; Edge Functions don't run; the stub only imitates the Supabase schemas the migrations use. A migration that passes here can still fail on the hosted project because of something the stub doesn't model. `npm run db:push` against the real project remains a manual, reviewed step, and CI never runs it.

## Android

The two workflows are separate on purpose. Web CI needs no Java or Android SDK, so it finishes in minutes. The APK job keeps its own triggers, because reviewers install a PR's APK to try that branch.

The APK job used to run `npm test` and `npm run lint` too. Relay Collective CI now runs those on every pull request into `main`, so the APK job no longer repeats them. It still type-checks through `npm run build` inside `npm run android:apk`, so a broken build still fails it. Its secrets, live-update setting and signing notes haven't changed.

A pull request into a branch other than `main` gets the APK build but not Relay Collective CI. Every pull request so far has targeted `main`. If stacked PRs become common, remove `branches: [main]` from the `pull_request` trigger in `ci.yml`.

## Deployment

### Today

**Cloudflare Workers Builds deploys the site, and GitHub Actions doesn't deploy at all.** The Cloudflare dashboard is connected to `Relay-Collective/Relay-Collective`:

- A push to `main` runs the dashboard build, then **`npm run deploy`**, which zips `dist/` as the Android live-update bundle (`dist/ota/`) and runs `wrangler deploy`.
- Other branches run `npx wrangler preview` (hence the empty `previews` block in [`wrangler.jsonc`](../wrangler.jsonc)) and don't touch production.
- `VITE_*` values (Supabase URL, publishable key, Maps key) are Workers Builds variables, set in the dashboard.

The old GitHub Actions workflows that mirrored `main` to a fork for deployment were removed in #23.

### Why CI doesn't deploy

- Cloudflare already deploys `main`. A second deploy from Actions would race it and publish two Android live-update bundles for one commit.
- Deploying from Actions needs a Cloudflare API token in GitHub secrets, and this workflow is designed to run untrusted pull-request code with no secrets.
- **Every production deploy is also an Android update.** Installed apps with live updates on download the new `dist/` the next time they open. A deploy that breaks the web app breaks those phones too, until the next deploy.

### Recommended next steps (not implemented)

1. **Make CI the gate in front of Cloudflare.** Turn on branch protection (below). Code then reaches `main`, and so production, only after CI passes, without changing anything in Cloudflare.
2. **Use Cloudflare's preview builds for review.** Workers Builds already builds non-`main` branches with `wrangler preview`. Point those builds at a separate Supabase project, or at the mock, never at production data. Post the preview URL on the PR so reviewers can try it alongside the APK.
3. **If production deploys ever move to GitHub Actions,** use a separate workflow that runs only on `push` to `main` after CI passes, with a GitHub **Environment** named `production` that requires approval and holds the Cloudflare token. Then turn off Cloudflare's own production deploy so only one pipeline publishes.
4. **Separate Android live updates from web deploys.** Today a web deploy is also a phone update. Options: publish `dist/ota/latest.json` only from a tagged release, or have the Worker serve the previous bundle until a release is promoted. Either way, a web hotfix wouldn't immediately reach every installed app.
5. **Handle a failed deploy by rolling back in Cloudflare.** Use **Workers → Deployments → Rollback**, or `wrangler rollback`, and check that `/ota/latest.json` points at the bundle you expect. Database migrations aren't rolled back with the Worker, so keep them backward compatible with the previous web build.

## Branch protection

Not configured by this change: it needs a repository administrator. Under **Settings → Branches → Add branch ruleset** (or **Branch protection rules**) for `main`:

1. **Require a pull request before merging.** Require at least **1 approval**. Turn on **Dismiss stale approvals when new commits are pushed**.
2. **Require status checks to pass.** Add these two checks, which appear in the search box after CI has run once on a pull request:
   - `quality`
   - `database-tests`

   In the PR checks list they appear as **Relay Collective CI / quality** and **Relay Collective CI / database-tests**. Optionally add `apk` (Android debug APK) if a broken APK build should block merging.
3. Turn on **Require branches to be up to date before merging**, so checks run against the latest `main`.
4. Turn on **Require conversation resolution before merging**.
5. **Block force pushes** and **restrict deletions** on `main`.
6. Leave administrator bypass off, or limit it to an emergency role.

GitHub already blocks merging a pull request that has merge conflicts.

## Dependency updates

[`.github/dependabot.yml`](../.github/dependabot.yml) checks every Monday:

- **npm:** one grouped PR for all minor and patch updates, and a separate PR for each major update. At most 5 open at once.
- **GitHub Actions:** one grouped PR that updates the pinned SHAs and their version comments.

Dependabot only opens pull requests. They run Relay Collective CI and the APK build like any other PR, without repository secrets. Nothing merges or deploys until someone approves and merges it. Cloudflare may build a preview of a Dependabot branch, but production only changes when `main` does. Dependabot security alerts and security updates are switched on separately, under **Settings → Code security**.
