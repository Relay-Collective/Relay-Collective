# Organization discovery, join requests and team management

People no longer need an invitation link to join an organization. After signing up they can search for an organization that has chosen to be found, ask to join it, and follow the request until one of that organization's administrators decides. Administrators manage their team under **Organization → Team**. Invitation links keep working as the other way in.

## Where it lives

| Piece | Location |
| --- | --- |
| Shared rules: roles and what they allow, labels, search normalizing and ranking | [`src/logic/membership.ts`](../src/logic/membership.ts) |
| Find your organization (search, request form, invitation link) | [`src/pages/onboarding/JoinOrganization.tsx`](../src/pages/onboarding/JoinOrganization.tsx) |
| Where a request stands (pending, approved, not approved, withdrawn) | [`src/pages/onboarding/JoinRequestStatus.tsx`](../src/pages/onboarding/JoinRequestStatus.tsx) |
| Team & Memberships page (Members, Join Requests, Invitations tabs) | [`src/pages/workspace/Team.tsx`](../src/pages/workspace/Team.tsx) |
| Combobox, member directory, request review, role selector, visibility settings, notices | [`src/components/membership/`](../src/components/membership/) |
| Invitations tab (existing invitation UI, now admin-only) | [`src/components/workspace/TeamInvitations.tsx`](../src/components/workspace/TeamInvitations.tsx) |
| Debounced directory search | [`src/hooks/useOrganizationSearch.ts`](../src/hooks/useOrganizationSearch.ts) |
| The member's current role, pending-request count, removal check | [`src/context/WorkspaceProvider.tsx`](../src/context/WorkspaceProvider.tsx), `useWorkspace()` |
| Backend contract | `DataService` in [`src/services/dataService.ts`](../src/services/dataService.ts) |
| Supabase backend | [`src/services/supabaseService.ts`](../src/services/supabaseService.ts) and [the migration](../supabase/migrations/20261029120000_organization_membership.sql) |
| Demo backend | [`src/services/mockService.ts`](../src/services/mockService.ts) (same rules, in localStorage) |

### Routes

| Route | Who | What |
| --- | --- | --- |
| `/onboarding` | signed in, no role yet | "Join an existing organization" now leads to search. Someone with a pending request goes straight to its status. |
| `/onboarding/join` | signed in, no role yet | Find your organization → Request to join *Organization*. Has a "Have an invitation link instead?" section. |
| `/onboarding/join/status` | the applicant | Status, withdraw, and **Enter Workspace** once the backend confirms the membership. |
| `/workspace/team` | organization members | Members for everyone; Join Requests (`?tab=requests`) and Invitations (`?tab=invitations`) for administrators. |
| `/workspace/organization` | organization members | Adds **Organization Visibility** and a link to Team. |

## The membership model

Membership already existed and is extended, not duplicated. A member of a partner organization is a `profiles` row with `role = 'PARTNER'` and an `org_id`, and every existing access rule keys on that. One identity (`auth.users` row) still has at most one profile, so it belongs to at most one organization.

| Concept | Where |
| --- | --- |
| Identity | `auth.users`. A request belongs to the identity, because an applicant has no profile yet. |
| Membership | `profiles` with `role = 'PARTNER'`, `org_id`, `house_id`. |
| Organization role | `profiles.org_role`: `ADMIN` or `STAFF`. Required for PARTNER profiles, null for everyone else. |
| Platform role | `profiles.role = 'PLATFORM_ADMIN'`. Unchanged; only Relay Collective's own processes set it. |
| Service roles | `drivers` rows, and transport providers' `ORG_ADMIN`. Unchanged and out of scope. |

### Roles

| Role | Can |
| --- | --- |
| Staff | Request and track rides, manage saved destinations, see the member directory (names and roles, no emails). |
| Administrator | Everything staff can, plus: see and decide join requests, choose new members' roles, invite and withdraw invitations, change roles, remove members, set the organization's visibility, and see members' emails. |

- Neither role is a platform role. Approval can only grant `ADMIN` or `STAFF`; the database refuses anything else.
- The applicant never picks their role. "Your role or position" is descriptive only. The reviewer picks the role, with Staff preselected.
- Promoting someone to Administrator asks for confirmation and explains what it allows.
- Administrators can't change their own role or remove themselves; another administrator has to.
- **An organization with active members always has an active administrator.** A trigger enforces this on every path: demotion, removal, and the last administrator closing their own account. See [Concurrency](#concurrency).

### Existing accounts (backfill)

Every existing PARTNER profile becomes `ADMIN`. Until now every member could invite colleagues and manage the organization, so nobody loses anything they could already do. Administrators can make colleagues Staff afterwards. From now on:

- the first member of a new organization (its applicant) is `ADMIN`;
- a colleague who accepts an invitation joins as `STAFF`;
- someone approved through a request gets the role the administrator chose.

A `BEFORE INSERT` trigger on `profiles` fills in the role for the paths that don't pick one (applications, invitations, the legacy `complete_onboarding()`), so those functions are unchanged.

### Removing a member

`remove_member()` sets `is_active = false`, sets `removed_at` and `removed_by`, and clears `auth_user_id`. The profile stays on rides and history. The login is untouched, but nothing links it to the organization any more:

- every access rule looks members up by `auth.uid()`, so access ends on the next request;
- `my_account_state()` returns `NONE` for that login, so the person lands in onboarding and can join another organization or ask to rejoin;
- an open workspace notices on its next data refresh (live update or the 30-second poll): the organization disappears from what the backend returns, and the app reloads the session.

The authentication account is never deleted by removal.

## Database

Migration: [`supabase/migrations/20261029120000_organization_membership.sql`](../supabase/migrations/20261029120000_organization_membership.sql).

### Changes to existing tables

| Table | Column | Notes |
| --- | --- | --- |
| `profiles` | `org_role` | `ADMIN` / `STAFF`. Check: set exactly when `role = 'PARTNER'`. Backfilled to `ADMIN`. |
| `profiles` | `removed_at`, `removed_by` | Set together. Check: a removed profile has no login and isn't active. |
| `organizations` | `discoverability` | `invitation_only` (default) or `discoverable`. |
| `organizations` | `directory_description` | Optional, 1–280 characters, trimmed. Shown in search. |

`org_role` and `removed_at` are added to the browser's column grant on `profiles`; the existing row policies still decide whose profiles a caller can read.

### `organization_join_requests`

| Column | Notes |
| --- | --- |
| `id` | uuid primary key |
| `organization_id` | FK `organizations` |
| `user_id` | FK `auth.users`, `on delete cascade` (deleting a login deletes its requests; the events keep what happened) |
| `requested_position` | optional, 1–120 characters. Descriptive only |
| `message` | optional, 1–1,000 characters |
| `status` | `pending` (default), `approved`, `rejected`, `cancelled` |
| `assigned_role` | the role the reviewer granted |
| `membership_profile_id` | FK `profiles`: the membership approval created |
| `reviewed_by`, `reviewed_at` | FK `profiles`; set on approve and reject |
| `review_note` | optional, ≤500 characters. Administrators only |
| `cancelled_at` | set on withdrawal, or when the person joined another way |
| `created_at`, `updated_at` | `updated_at` kept by trigger |

Constraints:

- `status = 'approved'` exactly when `membership_profile_id` and `assigned_role` are set, so a request can never say approved without a membership.
- `approved`/`rejected` exactly when `reviewed_at` and `reviewed_by` are set; `cancelled` exactly when `cancelled_at` is set.
- **Partial unique index `organization_join_requests_one_pending` on `(user_id) where status = 'pending'`.** One open request per person, enforced by the database. This is stricter than one per person and organization, because an identity can only belong to one organization.

### `organization_membership_events`

The accountability trail: `request_submitted`, `request_cancelled`, `request_approved`, `request_rejected`, `role_changed`, `member_removed`, `visibility_changed`. Each row records the organization, the request (if any), the subject profile and login, the actor profile and login, a small `detail` (for example `{"from":"STAFF","to":"ADMIN"}`) and a timestamp. Written only by the functions below. There was no platform-wide audit table to reuse; `ride_events` and `feedback_status_history` are specific to their features.

### `private.rate_limits`

A small counter per caller and window, in the non-exposed `private` schema.

### Grants and policies

The browser has **no insert, update or delete** on any new table, and no new write access to `profiles` or `organizations`. Every change is a function.

| Table | Browser can read | Row policy |
| --- | --- | --- |
| `organization_join_requests` | every column except `review_note` and `reviewed_by` | own requests (`user_id = auth.uid()`), the caller's administered organization's, or platform admins |
| `organization_membership_events` | all columns | the caller's administered organization's, or platform admins |
| `organization_invitations` | unchanged columns | now the caller's **administered** organization (was any member), or platform admins |

`private.my_admin_org_id()` is the new helper: the organization of an active, signed-in `PARTNER` with `org_role = 'ADMIN'`.

### Functions

All are `SECURITY DEFINER` with `search_path = ''`, schema-qualified names, `EXECUTE` revoked from `public` and `anon` and granted to `authenticated`. Each works out the caller from `auth.uid()` and their organization from their own profile. Messages meant for people are raised with `P0001`.

| Function | Who | What |
| --- | --- | --- |
| `search_organizations(query, limit)` | signed in | Up to 20 (app asks for 8) approved, `discoverable` partner organizations that have a location, whose name contains the query (case-insensitive; `%` and `_` are literal). Names starting with the query come first. Returns only `id, name, city, description`. Under 2 characters returns nothing. 40 searches per minute per caller. |
| `submit_join_request(org, position, message)` | identity with no role, confirmed email | Same answer for unknown, unapproved and invitation-only organizations. Refuses people who already have a role. A retry returns the pending request. Refuses a second pending request elsewhere. At most 5 requests per day. Takes the same per-login advisory lock as every other onboarding path. |
| `cancel_join_request(id)` | the applicant | Pending requests only. Never touches a membership. |
| `my_join_requests()` | signed in | The caller's last 10 requests with organization name and city. No notes, no reviewer. |
| `list_join_requests(status)` | administrator | Their organization's requests with the applicant's name, sign-in email, and whether it's confirmed. |
| `approve_join_request(id, role)` | administrator | Atomic approval: see below. |
| `reject_join_request(id, note)` | administrator | Pending only. Optional note kept for administrators. |
| `list_organization_members(include_former)` | any member | Name, role, status (`active`/`removed`/`closed`), joined date. Emails only for administrators. |
| `set_member_role(profile, role)` | administrator | Another active member of their organization, `ADMIN` or `STAFF`. |
| `remove_member(profile)` | administrator | Another active member of their organization. See [Removing a member](#removing-a-member). |
| `set_organization_visibility(value, description)` | administrator | Only an `APPROVED` organization can become `discoverable`. Existing members are unaffected. |
| `create_invitation`, `revoke_invitation` | administrator | Replaced so that only administrators can invite and withdraw. Otherwise unchanged. |

### Atomic approval

`approve_join_request()` runs in one transaction:

1. Checks the caller is an administrator and the role is `ADMIN` or `STAFF`.
2. Reads the request's login, scoped to the caller's organization (anything else is "wasn't found", so other organizations' requests can't be probed).
3. Takes the applicant's onboarding advisory lock, then locks the request row (`FOR UPDATE`). Every path that creates a profile takes that lock first, in that order, so an approval and an invitation accepted at the same moment can't deadlock.
4. Confirms the request is still `pending`, the organization is approved, the applicant has no profile, and the organization has a location.
5. Inserts the `PARTNER` profile with the chosen role, marks the request approved with the reviewer, time and membership, and records the event.

If any step fails, nothing is kept. A second approval of the same request waits for the first, then gets "This request was already approved". `profiles.auth_user_id` is unique, so a second membership for the same login is impossible regardless.

If someone gets a role another way while a request is waiting (an invitation, registering an organization, driving), a trigger closes their pending request as `cancelled`.

### Concurrency

- **Approvals:** advisory lock + row lock, as above.
- **Last administrator:** `private.keep_an_org_admin()` runs before any update of `org_role`, `is_active`, `auth_user_id`, `org_id` or `role` on `profiles`. When an active administrator would stop being one, it locks the organization row, then checks another active administrator remains (or that nobody else is left). Two administrators demoting each other at once are handled one after the other, and the second sees the first's change. Platform admins and server processes (no signed-in caller) may override, for example to remove an abusive account.
- **Duplicate pending requests:** the partial unique index, plus the advisory lock in `submit_join_request()`.

## Discovery rules

An organization appears in search only when **all** of these hold: `status = 'APPROVED'`, `type = 'PARTNER_ORG'`, `discoverability = 'discoverable'`, and it has a location (members need one). Organizations start `invitation_only`, including every existing one, so nothing becomes searchable until an administrator turns it on.

Search never downloads the organizations table. It returns at most a handful of rows and four public fields. Invitation-only organizations don't show up in results, counts or suggestions, and asking to join one gets the same message as a nonexistent organization. There's no new read access to `organizations`: an applicant reads the name of an organization they asked to join only through `my_join_requests()`.

Logos aren't shown: organizations don't have one yet. Results show initials.

## Invitation compatibility

Invitations work as before (`create_invitation`, `get_invitation`, `accept_invitation`, `revoke_invitation`, `/invite/:token`). Both ways in produce the same kind of membership: a `PARTNER` profile with an `org_role`. The changes:

- Only administrators create, list and withdraw invitations (everyone who could before is an administrator after the backfill).
- Invited colleagues join as `STAFF`.
- The invitation link field moved from the "How would you like to get started?" screen to the bottom of **Find your organization**.

## Notifications

There's no email delivery for these events; everything is in-app, built on the persisted requests.

- **Administrators:** a count beside **Team** in the sidebar and on the Join Requests tab, and a "New team membership request" banner in the workspace linking to Team → Join Requests. The banner never names the applicant, and shows once per request (dismissal is remembered in this browser, like other notices).
- **Applicants:** the status page updates live (Realtime on `organization_join_requests`, plus a 15-second poll, since someone without a role has no app-wide live updates). After approval, a one-time "Membership approved" banner greets them in the workspace. A declined request shows "Your request was not approved" with next steps, never the reviewer's note.

## Deployment

1. Apply the migration to a development project and run `npm run test:db` locally first. Then, with authorization for the target project: `npm run db:status` to check what's pending, and `npm run db:push`.
2. Deploy the frontend **after** the migration. The app now reads `profiles.org_role` and `organizations.discoverability`, which don't exist before it.
3. No Edge Function changes. `delete-my-account` calls `deactivate_my_account()` as the caller, so it now refuses the last administrator of an organization with other members, with a message telling them to make someone else an administrator first.
4. Realtime: the migration adds `organization_join_requests` to the `supabase_realtime` publication.
5. Organizations stay invitation only until an administrator chooses Discoverable under Organization profile → Organization Visibility.

## Testing

| Command | Covers |
| --- | --- |
| `npm run test:db` | [`tests/db/organizationMembership.test.ts`](../tests/db/organizationMembership.test.ts), against every migration in PGlite: discovery and its privacy (F), rate limiting, request rules and duplicates (C), approval and access (A), rejection (B), staff and self-approval refused (D), cross-organization isolation (E), roles limited to `ADMIN`/`STAFF`, double approval (J), all-or-nothing approval, removal (G), last administrator (H), invitations (I). |
| `npm test` | [`tests/membership.test.ts`](../tests/membership.test.ts): the same scenarios against the demo backend, plus search ranking and highlighting. [`tests/onboarding.test.ts`](../tests/onboarding.test.ts) still covers the invitation flow. |

The demo backend's approved partners (Belkin House, Richmond House, Grace Mansion) are discoverable, so the whole flow can be tried locally: sign up, choose **Join an existing organization**, search "house", then sign in as `belkin@careride.demo` and open **Team**.

## Known limitations

- **One organization per identity.** The model doesn't support several memberships yet: every access rule assumes one profile per login, and changing that means a membership table and rewritten policies across the app. Requests are keyed by login (not profile), so they won't need to change. Until then, someone already in an organization can't ask to join another, and there's no workspace switcher.
- **Concurrency is enforced by locks but tested sequentially.** PGlite runs one connection, so the double-approval and last-administrator tests run their calls one after another. True simultaneous calls rely on the row lock, advisory lock, organization-row lock and the unique login on `profiles`.
- **Rate limits are per caller and database-backed.** There's no IP-level limiting; Supabase Auth's own limits still apply to sign-ups. Old counter windows are deleted when the same caller next searches, so a few rows linger for callers who never come back.
- **Platform admins** can read requests and membership events through the row policies, but there's no admin-console screen for them, and organization roles can only be changed by that organization's administrators.
- **No email notifications.** Administrators learn about requests in the workspace; applicants on the status page and on their next sign-in.
- **Transport providers** (`ORG_ADMIN`) are unchanged: they aren't discoverable and have no Team page.
