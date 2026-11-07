# Permanent account deletion

Platform admins can permanently delete one person's account from **Admin console → Users → (person) → Danger Zone**. Deletion removes the person's Supabase login and erases their personal information. Records other people rely on, such as rides an organization booked or ride history, stay in place but no longer carry the person's name.

## Three different operations

| Operation | Who | What happens | Where |
| --- | --- | --- | --- |
| **Remove from organization** | That organization's administrators | The membership ends. The person keeps their login and can join somewhere else. | Organization → Team ([ORGANIZATION_MEMBERSHIP.md](ORGANIZATION_MEMBERSHIP.md)) |
| **Deactivate** | Not offered on its own | `profiles.is_active = false` is how every access check refuses someone, and deletion uses it as its first step. There is no way to switch an account back on, so the admin console doesn't offer deactivation by itself. | n/a |
| **Permanently delete** | Platform admins | The login is hard-deleted and personal data is erased or anonymized, as described on this page. This can't be undone through Relay Collective. | Admin console → Users → Danger Zone |

People can still close their own account with **Delete my account** (`delete-my-account`). That flow is unchanged: it switches the profile off and deletes the login, but keeps the profile's details. See [Known limitations](#known-limitations).

## Where it lives

| Piece | Location |
| --- | --- |
| Schema, workflow functions, cleanup and verification | [`supabase/migrations/20261029150000_account_deletion.sql`](../supabase/migrations/20261029150000_account_deletion.sql) |
| Edge Function (password check, Storage, Auth) | [`supabase/functions/admin-delete-account/index.ts`](../supabase/functions/admin-delete-account/index.ts) |
| Step runner, kept separate so it can be tested | [`supabase/functions/admin-delete-account/workflow.ts`](../supabase/functions/admin-delete-account/workflow.ts) |
| Labels, blocker messages, error guidance | [`src/logic/accountDeletion.ts`](../src/logic/accountDeletion.ts) |
| Danger Zone and dialog | [`src/pages/admin/AccountDangerZone.tsx`](../src/pages/admin/AccountDangerZone.tsx), [`DeleteAccountDialog.tsx`](../src/pages/admin/DeleteAccountDialog.tsx) |
| Backend contract | `previewAccountDeletion`, `startAccountDeletion`, `retryAccountDeletion` and `getAccountDeletion` in [`src/services/dataService.ts`](../src/services/dataService.ts) |
| Demo backend | `mockService` (follows the same rules; every step succeeds at once) |

## How a deletion runs

```text
Admin console                     Edge Function (admin-delete-account)           Database (as the admin)          Service key
──────────────                     ────────────────────────────────────           ───────────────────────          ───────────
preview ───────────────────────────────────────────────────────────────────────▶ admin_account_deletion_preview
confirm (email + own password) ──▶ check password (throwaway session)
                                   begin ───────────────────────────────────────▶ admin_begin_account_deletion
                                                                                   └ blockers, email match, rate limit,
                                                                                     admin_deactivate_account, job row
                                   claim ───────────────────────────────────────▶ admin_claim_account_deletion
                                   storage: remove files ──────────────────────────────────────────────────────────▶ Storage API
                                   advance(storage) ────────────────────────────▶ verifies no file is left
                                   advance(records) ────────────────────────────▶ erase_account_records (1 transaction)
                                   auth: delete login ─────────────────────────────────────────────────────────────▶ auth.admin.deleteUser(id, false)
                                   advance(auth) ───────────────────────────────▶ verifies auth.users has no row
                                   advance(verify) ─────────────────────────────▶ leftovers check, remove placeholders
◀── job (completed / failed) ──────┘
```

Every database call runs **as the admin**, and each function checks `private.is_admin()` again. The service key is used only for the two steps that happen outside the database: Storage and Auth.

### State machine

`private.account_deletion_jobs` holds `status`, one of `pending`, `in_progress`, `completed`, `failed` or `requires_attention`, and `current_step`, one of `storage`, `records`, `auth`, `verify` or `done`.

| Step | Work | Completes only when | On failure |
| --- | --- | --- | --- |
| `storage` | The Edge Function removes the job's files through the Storage API. | None of the job's files is left in `storage.objects`. | `failed` / `STORAGE_DELETE_FAILED`. No records have changed yet. |
| `records` | `erase_account_records()` runs as one transaction. | The transaction commits. | It rolls back, then the job goes to `requires_attention` / `RECORDS_CLEANUP_FAILED`. The cause is in the database log only. |
| `auth` | `auth.admin.deleteUser(id, false)` (hard delete). A 404 counts as done. | `auth.users` has no row for the login. | `failed` / `AUTH_DELETE_FAILED`. The records are already erased and the account stays switched off. |
| `verify` | `account_deletion_leftovers()` checks the result. Placeholder rows that nothing references are then deleted. | Nothing personal is left. | `requires_attention` / `VERIFICATION_FAILED` |

- **Each step can be repeated safely.** A step only advances once the database has seen it done. Removing a missing file or deleting a missing login isn't an error. Advancing a step that isn't current does nothing.
- **Interruptions.** If the Edge Function is cut off, it marks the job `failed` / `INTERRUPTED` when it can. A job left `in_progress` with no update for a minute can be claimed again.
- **One job per account.** A partial unique index allows one open job per profile. The profile row is locked while a deletion starts, so two admins starting at the same moment get one job and one refusal.
- **Execution limits.** A deletion is a few Storage calls, one transaction and one Auth call, which fits easily within an Edge Function invocation. If a run is cut off anyway, the job resumes from its step.

### Access ends first

`admin_begin_account_deletion` calls `admin_deactivate_account` in the same transaction that creates the job. That switches the profile off, moves the driver's pending offers and accepted rides to other drivers, and refuses if a client is in the car. Every access rule and function resolves the caller through `profiles.is_active`, so **tokens issued before the deletion stop working immediately**, even though a JWT stays cryptographically valid until it expires (`jwt_expiry`, 1 hour). `deleteUser` then revokes refresh tokens.

The profile keeps its `auth_user_id` until the login is deleted. Between the records step and the auth step, the person therefore reads as a closed account and can't start onboarding again. Once the login is gone, every onboarding function fails on the `auth.users` foreign key.

## Data inventory and decisions

Everything in the schema that refers to a person:

| Data | Where | Decision | Why |
| --- | --- | --- | --- |
| Login | `auth.users` (with identities, sessions, refresh tokens) | **Delete** (hard) | The identity itself |
| Profile | `profiles` | **Anonymize**, then **delete** if unreferenced | Rides, history, reviews and invitations point at it. The name becomes *Deleted account*; phone, email and `is_active` are cleared; `deleted_at` is set. A check constraint (`profiles_deleted_is_anonymous`) holds this. Deleted outright when no foreign key refers to it. |
| Volunteer profile and interests | `volunteer_profiles`, `volunteer_interests` | **Delete** | The interests a person chose describe them, and nothing else points at them. See [architecture/volunteers.md](architecture/volunteers.md). |
| Organization membership | `profiles.org_id` / `org_role` | **Remove** (profile switched off) | The organization and its other members stay. `org_id` stays on the placeholder so the organization's history reads "a former member". |
| Driver details | `drivers` | **Anonymize**, then **delete** if unreferenced | Finished rides and offers need the row. Vehicle, cities and hours are cleared and `deleted_at` is set. Seats and wheelchair access stay, because they describe nobody and stay locked after approval. The app's driver lists leave erased rows out. |
| Driver documents | `driver_documents` and bucket `driver-documents` | **Delete** (files first) | Personal identity documents |
| Feedback & Suggestions they sent | `feedback_submissions`, `feedback_messages`, `feedback_status_history`, `feedback_attachments`, bucket `feedback-attachments` | **Delete** (files first) | Free text and screenshots may describe the person. Clearing `submitted_by` alone wouldn't anonymize them. |
| Feedback assigned to them (admins) | `feedback_submissions.assigned_to` | **Detach** | The feedback belongs to its submitter |
| Replies they wrote as an admin | `feedback_messages.author_id` | **Keep**, author anonymized | Part of another person's support thread |
| Status changes they made | `feedback_status_history.changed_by` | **Keep**, points at the placeholder | Accountability for feedback triage |
| Join requests | `organization_join_requests` | **Delete** | Their own message and position |
| Invitations to them | `organization_invitations` (by email, or `accepted_by`) | **Delete** | Holds their email |
| Invitations they sent, reviews they made | `invited_by`, `reviewed_by` and similar | **Keep**, points at the placeholder | The organization's or platform's records |
| Membership events | `organization_membership_events.subject_user_id` / `actor_user_id` | **Detach** (login id cleared) | The event stays as the organization's history. `subject_profile_id` points at the placeholder. |
| Rides they booked | `rides.requested_by` | **Keep**, booker anonymized | The organization's operational record |
| Rides they drove | `rides.driver_id` and related | **Keep**. Unfinished rides lose `preferred_driver_id` / `reconfirm_driver_id`. | Completed rides need a driver (`rides_assigned_has_driver`), and the organizations they served keep their records. |
| Open rides | pending offers, accepted rides | **Reassign** (at the start) | Same as when an account is closed |
| Issues they flagged as a driver | `ride_feedback` (author `DRIVER`) | **Delete** | Their own words |
| Ratings they gave for their organization | `ride_feedback` (author `PARTNER`) | **Keep** | The organization's rating of a ride |
| Ride history lines | `ride_events.actor_name` | **Anonymize** | The line still says what happened |
| Organization applications they submitted | `organization_applications.submitted_by` | **Keep** | The organization's record. If `organizations.contact_name` / `contact_phone` or the application's `contact_email` name this person, an admin should update them on the organization. |
| Rate-limit counters | `private.rate_limits` (`…:<login id>`) | **Delete** | Holds the login id |
| Notifications, preferences, settings | none server-side | n/a | "Seen" markers and similar live in the person's own browser storage |
| Deletion record | `private.account_deletion_jobs`, `private.account_deletion_events` | **Keep** | See [Audit record](#audit-record) |

No existing foreign key was changed to `ON DELETE CASCADE`. The cleanup is explicit. The cascades involved are the existing one from `auth.users` to `organization_join_requests`, and the volunteer tables' cascade from `profiles` (added with them). The records step has already emptied both by the time either would fire.

### Storage ownership

Files are found through the rows that own them: a screenshot through its feedback submission, a driver document through its driver row. Files are never found by `storage.objects.owner`, so a document that belongs to an organization is never deleted because its uploader's account is. Files are removed with the Storage API, never by deleting `storage.objects` rows. SQL only reads `storage.objects`, to confirm a file is gone.

## Audit record

The job table is the audit record. No separate admin audit system existed, and organization membership events are scoped to one organization. Each job keeps:

- its id, the admin's profile id (`requested_by`), the target's profile id, and the target's role,
- status, step, attempts, timestamps and a safe error code,
- the plan shown to the admin (category keys and counts only),
- an event trail (`requested`, `claimed`, `retried`, `step_completed`, `step_failed`, `completed`), with the acting admin.

It never stores a name or email. The login id and file paths are kept only while the deletion is in progress and are cleared on completion. The target's profile id is what the placeholder profile keeps, if one remains. The tables live in the `private` schema, so nothing outside the database can read or write them. Admins read a job through `admin_get_account_deletion()`. The Edge Function logs job ids and error codes, never personal details.

## Safeguards

| Safeguard | Where it's enforced |
| --- | --- |
| Platform admins only | Every `admin_*` deletion function checks `private.is_admin()`, the caller's active `PLATFORM_ADMIN` profile. That role is only ever set by Relay Collective's own processes, never by user metadata. Organization administrators get the same refusal as everyone else. |
| Re-authentication | The Edge Function checks the admin's password on a throwaway session, then ends that session (`scope: 'local'`) so the admin's own session continues. Typing the email alone is not enough. |
| Confirmation | The admin types the account's sign-in email. The deletion targets the **profile id**; the email only confirms it. |
| Not yourself | Blocker `SELF` |
| Not the last platform admin | Blocker `LAST_PLATFORM_ADMIN` (and `admin_deactivate_account`) |
| Not an organization's last administrator while it has members | Blocker `LAST_ORG_ADMIN`. The `keep_an_org_admin` trigger lets platform admins through, so it's checked here. |
| Not the last member of an organization with open rides | Blocker `ORG_OPEN_RIDES` |
| Not a transport provider's only administrator while it has active drivers | Blocker `LAST_PROVIDER_ADMIN` |
| Not a driver with a client in the car | Blocker `DRIVER_ON_TRIP` |
| One deletion per account, no conflicting runs | Unique index, row lock, one-minute claim |
| Rate limit | 10 deletions started per admin per hour (`private.take_rate_limit`) |
| Safe errors | The browser sees messages written for people and error codes. Database errors go to the database log, not the response. |

Blockers are re-checked when the deletion starts, not only in the preview.

## Privacy and retention

- **Active systems.** When a job is `completed`, the login is gone, and every category above is deleted or anonymized. The verify step checks this before the job can complete.
- **Kept records.** Shared operational records are kept as listed above, pointing at an anonymous placeholder. The deletion record is kept without a name or email. Nothing else about the person is kept.
- **Backups.** Supabase's backups and point-in-time recovery follow their own retention window and expire on their own schedule. Deletion does not reach into them. Restoring a backup from before a deletion would bring the person's data back, so re-run the deletion after any restore.
- **Logs.** Supabase Auth's own audit log records the login's deletion under Supabase's log retention. Relay Collective writes no names or emails to its logs.

## Recovery procedures

| What the admin sees | Meaning | What to do |
| --- | --- | --- |
| *Deletion needs attention* in the user list | The job is `failed` or `requires_attention`. The account is switched off. | Open the user and choose **Review and retry**. Retrying needs the admin's password and continues from the step that stopped. |
| `STORAGE_DELETE_FAILED` | Storage refused, or is unavailable. | Retry later. Check Storage status if it persists. |
| `AUTH_DELETE_FAILED` | Records are erased, but the login still exists. The person can't use Relay Collective. | Retry. If it persists, check Supabase Auth status and logs. |
| `RECORDS_CLEANUP_FAILED` | The erase transaction failed and rolled back. | Look for `account deletion <job id> records step failed: <sqlstate>` in the database log. |
| `VERIFICATION_FAILED` | Something was left after every step ran. | Run `select private.account_deletion_leftovers(j) from private.account_deletion_jobs j where id = '<job id>'` in the SQL editor to see which category, then retry. |
| *Being deleted* for more than a minute | The request running it was cut off. | **Review and retry**. A stalled job can be claimed again. |

## Deployment

**Don't run any of this against production until someone with authority over the production data has approved it.** Test on a development or staging project with disposable accounts first.

1. **Review** the migration and Edge Function. The migration adds columns and constraints to `profiles` and `drivers`, creates two private tables, and replaces `admin_list_accounts()`. It deletes nothing on its own.
2. **Apply the migration** to the development project: `npm run db:push`, with the CLI linked to that project. Check with `npm run db:status`.
3. **Deploy the function** to the same project: `npx supabase functions deploy admin-delete-account --use-api`. `verify_jwt` stays off in `supabase/config.toml`, because the function checks the caller itself.
4. **Ship the frontend** built from the same commit. The previous frontend's **Delete account** sends a request the new function refuses ("Reload Relay Collective"), so deploy the frontend straight after the function.
5. **Staging run.** Create disposable accounts: a driver with a finished ride, an organization member, and someone with a feedback screenshot. Delete each one, and check the [data inventory](#data-inventory-and-decisions) against the tables, including that other organizations' rides and files are untouched. Then simulate failures: make Storage refuse by revoking the function's access temporarily, or delete a file's object by hand, and confirm a retry completes.
6. **Before production:** confirm backups and point-in-time recovery work, confirm the retention decisions above with whoever owns data protection, and confirm which admins should hold `PLATFORM_ADMIN`.

## Tests

| Command | Covers |
| --- | --- |
| `npm run test:db` ([`tests/db/accountDeletion.test.ts`](../tests/db/accountDeletion.test.ts)) | The real migrations in PGlite. Preview counts, unauthorized callers (B), self-deletion (C), last administrator (D), storage failure and retry (E), auth failure (F), shared rides kept (G), organization member cleanup (H), concurrent starts and claims (I), old tokens refused before and after (J), and no name, email or login id in the job record (K). |
| `npm test` ([`tests/accountDeletionWorkflow.test.ts`](../tests/accountDeletionWorkflow.test.ts)) | The Edge Function's step runner with fake Storage and Auth: failures stop the job, retries resume, interruptions are recorded, and logs carry no personal details. |
| `npm test` ([`tests/accountDeletion.test.ts`](../tests/accountDeletion.test.ts)) | Shared rules, and the demo backend end to end. |

The tests don't call the real Supabase Storage or Auth APIs. The DB tests act out what those APIs do, and the workflow tests fake them. Run step 5 of [Deployment](#deployment) on a real development project before relying on this in production.

## Known limitations

- **Self-service closure is unchanged.** `delete-my-account` still keeps the profile's details. It can move to this workflow later, as a separate flow with its own confirmation, as the admin flow intends.
- **No reactivation.** Because nothing can switch an account back on, deactivation isn't offered on its own.
- **Driver documents are never uploaded today.** Uploading driver documents is a later step, so `driver_documents` is empty and there is no `driver-documents` bucket yet. Deletion already handles both, and will cover them once uploads exist.
- **One organization per identity.** Each person has one profile and so one membership. "Multiple memberships" means past join requests and invitations, which are all removed.
- **Deleting another platform admin** needs the same password re-check as any other deletion, with no extra approval step. A second approver could be added to `admin_begin_account_deletion` if needed.
- **Accounts without a sign-in email** (drivers a transport provider added without a login) can't be confirmed by email, so they can't be deleted here. They aren't in the admin user list either.
- **The admin's password is the step-up check.** MFA isn't enabled on the project. If it is enabled later, checking the token's `aal` claim in the Edge Function would be a stronger step-up.
