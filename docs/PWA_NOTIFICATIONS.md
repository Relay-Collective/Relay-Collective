# Relay Collective PWA and CareRide notifications

## Database handoff — send this file

Send [20261113120000_careride_notifications.sql](../supabase/migrations/20261113120000_careride_notifications.sql) to the owner of the **Relay Collective Supabase project**. Ask them to run the entire file **once** in **Supabase Dashboard → SQL Editor → New query**, after the existing Relay migrations through `20261110120000_late_driver_dispatch.sql`. It runs in a transaction and needs no secrets. It creates the inbox, preferences, private subscriptions and delivery queue, access rules, and ride triggers. It doesn't import old CareRide accounts, copy ride details, or send alerts for historical rides.

If the team uses Supabase CLI migrations, apply the migration through that workflow instead. If they ran it manually, record it in the migration history before using `db push` again (for a correctly linked project: `supabase migration repair 20261113120000 --status applied`). Don't run the same DDL twice. Apply the database migration before rolling out the connected web build. The install guides and offline screen don't depend on the database; the production inbox does.

Smoke check with two test accounts: a partner books a new ride, an eligible driver sees a new request in Notifications, the driver accepts, and the partner sees Driver confirmed. Verify that marking an update read affects only the signed-in account. The demo backend can exercise the same inbox flow with seeded accounts and does not send device alerts.

## Optional: turn on Web Push

The SQL above is enough for the in-app inbox. To deliver alerts while the app is closed, the project maintainer also needs to:

1. Generate a fresh VAPID key pair (for example, run `npx web-push generate-vapid-keys` on a trusted development machine). In Supabase Edge Function Secrets, set `CARERIDE_VAPID_PUBLIC_KEY`, `CARERIDE_VAPID_PRIVATE_KEY`, and `CARERIDE_VAPID_SUBJECT` (use a real team contact, e.g. `mailto:ops@example.org`). Set `CARERIDE_PUSH_JOB_TOKEN` to a long randomly generated secret used only by this job. Never put the private key or job token in the web build.
2. Deploy the function from the branch: `supabase functions deploy careride-push --no-verify-jwt` on the correctly linked project. It authenticates each invocation with the dedicated job token. It uses the built-in Supabase service-role key, which stays in the function.
3. In Supabase Vault create `careride_push_function_url` (the deployed URL, `https://PROJECT_REF.supabase.co/functions/v1/careride-push`) and `careride_push_job_token` (the same secret from step 1). Run [careride_push_schedule.sql](../supabase/careride_push_schedule.sql) in the SQL Editor. The cron job runs every minute. This uses the project's existing pg_cron and enables pg_net; see [Supabase's scheduling guide](https://supabase.com/docs/guides/functions/schedule-functions). Pause the job with `select cron.unschedule('careride-web-push');`.
4. Set `VITE_WEB_PUSH_PUBLIC_KEY` to the matching **public** key in the Relay web build environment and rebuild. Use HTTPS. On real iPhone/iPad (16.4+), add Relay to the Home Screen, launch it from there, and sign in. [WebKit documents the Home Screen and tap-to-enable requirements](https://webkit.org/blog/13878/). On Android, open or install in Chrome. In Notifications choose **Allow device alerts**. Create a new eligible request from a different account and confirm a generic lock screen alert arrives with Relay closed, then tap it. Verify individual and all-device opt-out. Check the scheduled job and Edge Function logs if no alert arrives.

An alert links to the account's authenticated inbox. No passenger name, address, ride ID, or trip notes go in the push payload. The inbox remains available if a user denies permission. Read items and expired offers are skipped at delivery. Queue entries are retried for transient failures and discarded after an hour; expired endpoints are removed.

## Mobile entry points and test coverage

- `/install/ios`: Safari instructions ([Apple](https://support.apple.com/guide/iphone/iphea86e5236/ios)).
- `/install/android`: Chrome instructions and a browser install button when available ([Google](https://support.google.com/chrome/answer/9658361)).
- `/launch`: installed shortcut; opens the signed-in workspace or sign-in. If the connection is lost while launching or reloading, Relay shows a reconnect screen. It doesn't store signed-in pages or ride records in its service worker.
- `/notifications`: signed-in entry point for push taps; sends CareRide users to their role's inbox.
- The first successful acceptance on a driver's mobile browser offers installation once per driver and browser. The account menu keeps the guide reachable after dismissal.
- Run `npm run test:db` for the SQL access and delivery checks. Run `npm run test:e2e -- e2e/mobile-pwa.spec.ts e2e/responsive.spec.ts` for the phone route sweep and install/inbox flows. With Playwright WebKit installed, also run `RELAY_MOBILE_WEBKIT=1 npm run test:e2e -- e2e/mobile-pwa.spec.ts --project=mobile-webkit`. Browser emulation does not prove physical Home Screen installation or live Web Push; use the device smoke check above.
