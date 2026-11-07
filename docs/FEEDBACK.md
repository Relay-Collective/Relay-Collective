# Feedback & Suggestions

Anyone signed in with a role (organization staff, volunteer drivers, transport providers, platform admins) can send product feedback from any page. They can follow it on **My feedback**. Platform admins review, prioritize and answer it under **Admin console → Operations → Feedback**.

This is separate from ride feedback (`ride_feedback`), which is the thumbs up/down or issue flag on one finished ride.

## Where it lives

| Piece | Location |
| --- | --- |
| Shared rules, limits, labels, route sanitizing | [`src/feedback/rules.ts`](../src/feedback/rules.ts) |
| Screenshot checks and metadata stripping | [`src/feedback/screenshot.ts`](../src/feedback/screenshot.ts) |
| Send flow (feedback first, then screenshot, with retry) | [`src/feedback/submit.ts`](../src/feedback/submit.ts) |
| One dialog for the whole app, plus the person's own list | [`src/context/FeedbackProvider.tsx`](../src/context/FeedbackProvider.tsx), `useFeedback()` |
| Dialog and form components | [`src/components/feedback/`](../src/components/feedback/) |
| My feedback pages | [`src/pages/feedback/`](../src/pages/feedback/) |
| Admin inbox and detail | [`src/pages/admin/Feedback.tsx`](../src/pages/admin/Feedback.tsx), [`FeedbackDetail.tsx`](../src/pages/admin/FeedbackDetail.tsx) |
| Backend contract | `DataService` in [`src/services/dataService.ts`](../src/services/dataService.ts) |
| Supabase backend | [`src/services/supabaseService.ts`](../src/services/supabaseService.ts) and [the migration](../supabase/migrations/20261028120000_product_feedback.sql) |
| Demo backend | [`src/services/mockFeedback.ts`](../src/services/mockFeedback.ts); screenshots in IndexedDB via [`demoFiles.ts`](../src/services/demoFiles.ts) |

### Entry points

- **Sidebar footer**, next to Help, in the organization workspace, the volunteer workspace and the admin console: **My feedback** (with a count of items that have news) and **Send feedback**. On phones it is in the menu drawer. No floating button is added, so nothing covers trip controls.
- **Account menu** on every signed-in page, including the transport-provider layout: Send feedback and My feedback.
- **Help pages**: a Feedback and suggestions section.
- **What's New**: "Give feedback on this update" under each release. It opens the form with the type set to *Feedback on an update* and the release's version filled in.

### Routes

| Who | My feedback | One item |
| --- | --- | --- |
| Organization staff (`PARTNER`) | `/workspace/feedback` | `/workspace/feedback/:id` |
| Drivers (`DRIVER`) | `/volunteer/feedback` | `/volunteer/feedback/:id` |
| Transport providers (`ORG_ADMIN`) | `/org/feedback` | `/org/feedback/:id` |
| Platform admins | `/admin/feedback` (everyone's) | `/admin/feedback/:id` |

## Database

Migration: [`supabase/migrations/20261028120000_product_feedback.sql`](../supabase/migrations/20261028120000_product_feedback.sql).

### `feedback_submissions`

| Column | Notes |
| --- | --- |
| `id` | uuid primary key |
| `reference` | identity, shown as `FB-1042`, searchable |
| `client_request_id` | one per form; unique with `submitted_by`, so a retried send returns the first row |
| `submitted_by` | `profiles.id` of the caller, set by the database |
| `organization_id` | the caller's `profiles.org_id` when they sent it, set by the database |
| `feedback_type` | `bug`, `feature_request`, `improvement`, `release_feedback`, `general` |
| `title` | 1–150 characters, trimmed |
| `description` | 1–5,000 characters, trimmed |
| `source_page` | app route only, matching `^/[A-Za-z0-9/_.:-]{0,199}$`; ids become `:id` |
| `source_workspace` | `organization`, `volunteer`, `driver`, `admin`, decided from the role |
| `related_release` | a What's New version such as `1.4.0`; only on `release_feedback` |
| `status` | `new` (default), `under_review`, `planned`, `in_progress`, `resolved`, `closed` |
| `priority` | null until an admin sets `low`, `medium`, `high` or `critical` |
| `assigned_to` | an active platform admin's profile, or null |
| `created_at`, `updated_at`, `resolved_at` | `timestamptz`. `resolved_at` is set on entering resolved/closed and cleared on reopening. A check constraint keeps it consistent with `status` |

Indexes cover the submitter, creation time, status, type, priority, workspace, organization, assignee and release.

### `feedback_messages`

`id`, `feedback_id`, `author_id`, `message` (1–5,000), `visibility` (`public` or `internal`), `created_at`. A public reply bumps the submission's `updated_at`, so the submitter's list shows it as updated.

### `feedback_attachments`

`id`, `feedback_id` (unique: one screenshot per submission), `uploaded_by`, `storage_path` (unique, `<feedback id>/<uuid>.<png|jpg|webp>`, must sit in the feedback's folder), `file_name` (display only, ≤120), `mime_type`, `file_size` (≤ 5 MB), `created_at` (when the upload grant was last issued), `uploaded_at` (when the file was confirmed in Storage).

### `feedback_status_history`

`id`, `feedback_id`, `previous_status` (null for the submission itself), `new_status`, `changed_by`, `changed_at`. A trigger on `feedback_submissions` writes it on insert and on every status change, so no screen can skip it.

### Relationships and deletion

All foreign keys use the default `NO ACTION`. Nothing cascades. Closing an account sets `is_active = false` and drops the Auth login, so feedback, replies and history survive a closed account; the admin console shows the submitter as *Account closed*. A platform admin's **permanent deletion** deletes the person's own submissions with their replies, history and screenshot, and keeps replies they wrote as an admin under an anonymous author (see [ACCOUNT_DELETION.md](ACCOUNT_DELETION.md)).

## Access control

**Grants.** The migration first revokes everything on the four tables from `anon` and `authenticated`. Supabase's default privileges grant everything on new tables, and RLS alone can't hide columns. It then grants `SELECT` on these columns only:

| Table | Readable columns | Withheld |
| --- | --- | --- |
| `feedback_submissions` | everything a submitter needs | `priority`, `assigned_to`, `client_request_id` |
| `feedback_messages` | `id, feedback_id, message, visibility, created_at` | `author_id` |
| `feedback_attachments` | path, name, type, size, times | `uploaded_by` |
| `feedback_status_history` | `id, feedback_id, previous_status, new_status, changed_at` | `changed_by` |

There is no `INSERT`, `UPDATE` or `DELETE` grant on any of them. Every write goes through a `SECURITY DEFINER` function that checks the caller.

**Row policies** (RLS on all four tables):

- Submissions: platform admin, or `submitted_by = private.my_profile_id()`.
- Messages: platform admin, or `visibility = 'public'` on the caller's own submission. Internal notes are filtered by the database, whatever the client asks for.
- Attachments and history: platform admin, or the caller's own submission.

Organization roles get nothing extra. A colleague in the same organization, an organization admin and a transport provider can't read each other's feedback. Platform admin is `profiles.role = 'PLATFORM_ADMIN'` on an active profile (`private.is_admin()`), never user-editable metadata. `private.feedback_is_mine()` is `SECURITY DEFINER`, so policies don't re-enter each other's RLS.

**Functions** (execute granted to `authenticated` only, revoked from `anon` and `public`):

| Function | Who | What |
| --- | --- | --- |
| `submit_feedback(...)` | any active profile | validates, sanitizes the route, picks submitter/org/workspace, idempotent per `client_request_id`, at most 20 per hour |
| `begin_feedback_attachment(...)` | the submitter, within 24 h | checks type/size, cleans the name, issues (or renews) the one upload grant and its path |
| `confirm_feedback_attachment(id)` | the uploader | checks the object exists in Storage, then sets `uploaded_at` |
| `update_feedback_triage(id, field, expected, value)` | platform admins | changes `status`, `priority` or `assigned_to`. Refuses if the current value isn't `expected` (another admin changed it). Assignees must be active platform admins |
| `add_feedback_message(id, message, visibility)` | platform admins | public reply or internal note |
| `admin_feedback_summary()` | platform admins | counts by status |
| `admin_list_feedback(filters, limit, offset)` | platform admins | filtering, search (title, description, `FB-n`; `%` and `_` are literal) and paging in the database |
| `admin_get_feedback(id)` | platform admins | everything about one submission, with names, email, notes and history |
| `admin_feedback_assignees()` | platform admins | active platform admins |

## Storage

The migration creates (or corrects) the private bucket **`feedback-attachments`**: `public = false`, `file_size_limit = 5242880`, `allowed_mime_types = image/png, image/jpeg, image/webp`.

Upload flow:

1. The browser checks the file's declared type, size and magic bytes, then redraws it on a canvas to drop embedded metadata (camera, location). It keeps the checked original if the redraw would be bigger than 5 MB.
2. `begin_feedback_attachment` returns the exact path, chosen by the database.
3. The browser uploads with `upsert: false`. The `storage.objects` insert policy allows only a path named by a fresh (under 1 hour), unconfirmed grant owned by the caller.
4. `confirm_feedback_attachment` checks the object really exists and marks it uploaded.

There are no update or delete policies, so nobody can overwrite or remove a file from the browser. Reads (signed URLs) are allowed for the submitter and platform admins. Screens use 5-minute signed URLs, show the file as an `<img>`, and download it under its cleaned name.

**Partial failures.** The feedback is saved before the screenshot is uploaded. If the upload fails, the success screen says so and offers **Try uploading again**, which reuses the same grant and path. If the person leaves instead, the feedback stays without a screenshot, and admins see "upload didn't finish".

## Lifecycle

```text
sent ─▶ new ─▶ under_review ─▶ planned ─▶ in_progress ─▶ resolved ─▶ closed
              (admins can move between any two statuses; each move is recorded)
```

- Submitters see the status, a plain-language meaning, status history (without who changed it), public replies signed "Relay Collective team", and their screenshot. They never see priority, assignment or internal notes.
- Admins change status, priority and assignment from the detail page. Each control saves on change against the value the screen showed. If another admin got there first, nothing is overwritten, the screen explains why and reloads the latest.
- Freshness: the app's existing refresh (live-update debounce, a 30-second poll, and refresh on returning to the tab) reloads lists and counts. Items with a reply or status change the submitter hasn't opened show **Updated**, with a count in the sidebar. That "seen" state is kept in the browser.

## Deploying

1. Review the migration, then apply it to a development project first: `npm run db:status`, then `npm run db:push` with the CLI linked to that project.
2. Check **Storage → Buckets** shows `feedback-attachments` as private with the 5 MB / image-only limits.
3. Apply to production only with authorization. Nothing else needs configuring: no new environment variables, Edge Functions or secrets.

The migration doesn't change any existing table. It only adds tables, functions, triggers, policies, one bucket and two `storage.objects` policies.

## Testing

| Command | Covers |
| --- | --- |
| `npm test` | rules, send flow (including a failed screenshot and its retry), and the full lifecycle on the demo backend for staff and drivers (`tests/productFeedback.test.ts`) |
| `npm run test:db` | the real migrations in an embedded Postgres ([PGlite](https://pglite.dev)) with a Supabase stub (`tests/db/`): anonymous denial, identity spoofing, column privileges, cross-user and cross-organization isolation, organization admins, internal notes, triage conflicts, assignment rules, status history, and the Storage upload/read policies |

`tests/db/supabase-stub.sql` stands in for Supabase's `auth` and `storage` schemas and API roles. It mirrors Supabase's default privileges, so a missing `revoke` fails the tests. Supabase Cron is skipped. The stub doesn't run the Storage API itself, so the bucket's size and type limits are checked as configuration, not by uploading.

## Known limitations

- **Release links are versions, not ids.** There is no releases table, so `related_release` holds a What's New version string (`1.4.0`) instead of the `related_release_id uuid` the spec suggested. Filtering by update works on that string.
- **No email or push notifications.** Updates show in the app only (Updated markers and sidebar counts). No notification system existed to reuse, and feedback content shouldn't go out over email without a review.
- **Submitters can't reply yet.** Conversation is admin to submitter only.
- **Abandoned uploads.** An upload grant that is never used leaves a metadata row with no file, and a file uploaded but never confirmed leaves an unconfirmed object. Neither is visible to anyone but admins. Cleaning them up needs a scheduled job with the Storage API (service role), which isn't built.
- **`confirm_feedback_attachment` reads `storage.objects`** as the function owner. On hosted Supabase that's `postgres`, which can read Storage metadata. If a project restricts that, confirmation fails safely (the screenshot is reported as not uploaded).
- **Search is substring matching** (`ILIKE`). That's fine at today's volumes. Add `pg_trgm` or full-text search if the inbox grows large.
- **Retention.** Feedback is deleted with its submitter's account when a platform admin permanently deletes it ([ACCOUNT_DELETION.md](ACCOUNT_DELETION.md)); otherwise there is no deletion workflow. Feedback can include personal details despite the warnings. A retention policy (for example, purge closed feedback after N months) should be agreed. A purge has to delete messages, history and the attachment row, and remove the Storage object through the Storage API, before deleting the submission.
- **Demo backend.** Screenshots are kept in this browser's IndexedDB, so another browser or device doesn't have them.
