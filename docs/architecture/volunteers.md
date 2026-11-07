# Volunteers: identity, interests, and CareRide driving

Relay Collective treats volunteering as a platform-level identity. Driving for CareRide is one specific
transportation capability that a person may also hold. Someone can volunteer without a vehicle, and choosing
an interest never grants access to anything.

Phase 1 covers the identity, the data model, registration and interest editing. Phase 2 is the adaptive workspace.
Phase 3 lets an existing general volunteer apply to drive with CareRide on the same account
([CareRide enrollment for volunteers](#careride-enrollment-for-volunteers-phase-3)). None of this includes volunteer
opportunities, matching or scheduling. CareRide is still the only operational service.

## The model

```text
auth.users  (the login: identity)
    │  1:1
    ▼
profiles  (the Relay Collective account: name, phone, email, role)
    │
    ├── role = 'VOLUNTEER'  a general volunteer (new)
    ├── role = 'DRIVER'     a CareRide driver (unchanged; every existing driver)
    ├── role = 'PARTNER' / 'ORG_ADMIN' / 'PLATFORM_ADMIN'  (unchanged)
    │
    ├── volunteer_profiles   0..1 per profile, any role       platform-level volunteering (new)
    │       └── volunteer_interests   1..n, each code once    descriptive only (new)
    │
    └── drivers              0..1 per profile, DRIVER only    CareRide: vehicle, cities, hours,
                                                              verification status (unchanged)
```

Three concepts stay separate:

| Concept | Where | Grants access? |
| --- | --- | --- |
| Volunteer identity | `profiles.role = 'VOLUNTEER'` | Only to the person's own volunteer data and the volunteer workspace's general pages |
| Volunteering interests | `volunteer_interests` | **Never** |
| CareRide driver | `drivers` row, `status`, and role `DRIVER` | Rides, only once a platform admin sets `status = 'APPROVED'` |

The Transportation interest, CareRide driver enrollment, driver verification, and permission to accept rides
are four different things. Only the last two, both decided by the database, affect what anyone can do.

## Why this design (Approach C)

The brief compared three options: a new role, a separate participation record, or both. Phase 1 uses both,
for reasons that come from the existing schema:

- **`profiles.auth_user_id` is unique.** One login has exactly one profile and one role. Every RLS helper
  (`private.my_role()`, `my_managed_org_id()`, `my_driver_id()`) and every onboarding function relies on
  that. A login without a profile reads as "still onboarding", so a general volunteer needs a profile, and
  every profile needs a role. Reusing `DRIVER` would have made every volunteer look like a driver to the
  admin console, the feedback inbox, and `deactivate_my_account()`. That's the problem this work fixes.
- **`VOLUNTEER` is a new value, not a rename.** `DRIVER` keeps its exact meaning, so no existing row,
  constraint, policy or function changes behaviour for drivers. Nothing is migrated or rewritten.
- **`volunteer_profiles` is keyed by profile, not by role.** Any profile can hold one. A driver who also
  volunteers keeps role `DRIVER` and gains a volunteer profile (`register_volunteer()` already supports
  this; the app doesn't show it yet). That keeps the model open to one person in several service modules,
  instead of fixing each account to one kind of participation.
- **Interests are a normalized table, not an array column.** The primary key `(volunteer_profile_id, interest)`
  makes a duplicate impossible, a check constraint allows only known codes, and future features can query or
  join on interests directly.

## Interests

The codes, words and "what's available today" text live in one place: `src/volunteer/interests.ts`
(`VOLUNTEER_INTERESTS`). The UI, the mock backend and the tests all read from there. The database accepts the
same five codes:

| Code | Label | Operational today |
| --- | --- | --- |
| `TRANSPORTATION` | Transportation | CareRide runs, but driving is a separate enrollment with verification |
| `FOOD_DISTRIBUTION` | Food distribution | No |
| `COMMUNITY_OUTREACH` | Community outreach | No |
| `RESOURCE_COORDINATION` | Resource coordination | No |
| `GENERAL` | General volunteering | No |

Rules, enforced by `private.volunteer_interests_from()` and mirrored by `interestsError()`: at least one
interest, only known codes (an unknown value is refused, not silently dropped), and each code once.

**Adding an interest** takes a migration (the `volunteer_interests` check constraint and
`private.volunteer_interests_from()`) and an entry in `VOLUNTEER_INTERESTS`. The `VolunteerInterest` type and
the `Record<VolunteerInterest, …>` icon map then fail the type check until the new code is handled.

## Database objects

Two migrations. The enum value has to be committed before anything can use it, so it's in its own file:

1. `20261104120000_volunteer_role.sql` runs `alter type public.user_role add value 'VOLUNTEER'`.
2. `20261104120100_general_volunteers.sql` adds everything else:

| Object | Kind | Purpose |
| --- | --- | --- |
| `profiles_volunteer_no_org` | check constraint | A `VOLUNTEER` profile has no `org_id` or `house_id`, so organization-scoped policies can never match it |
| `volunteer_profiles` | table | `profile_id` unique, FK to `profiles` (`on delete cascade`), timestamps |
| `volunteer_interests` | table | PK `(volunteer_profile_id, interest)`, FK `on delete cascade`, check on `interest` |
| `volunteer_profiles_select`, `volunteer_interests_select` | RLS policies | Your own rows, or every row for a platform admin. There are no insert, update or delete policies or grants. |
| `private.my_volunteer_profile_id()` | helper | The caller's volunteer profile (active accounts only) |
| `private.volunteer_interests_from(jsonb)` | helper | Validates and normalizes a list of interests |
| `public.register_volunteer(jsonb)` | RPC | Joins as a volunteer. The identity always comes from `auth.uid()`. Idempotent. Never creates a `drivers` row. |
| `public.set_my_volunteer_interests(jsonb)` | RPC | Replaces the caller's own interests. Changes nothing else. |
| `private.feedback_volunteer_workspace()` | trigger | Files a volunteer's Feedback & Suggestions under `volunteer` (`submit_feedback()` would say `organization`) |
| `deactivate_my_account()` | redefined | Lets a volunteer close their own sign-in. Driver and partner branches are unchanged. |
| `account_deletion_plan()`, `erase_account_records()`, `account_deletion_leftovers()` | redefined | Lists, erases and verifies the volunteer profile and interests. Everything else is unchanged. |

The four redefined functions are copies of their latest versions with the volunteer lines added. Their
signatures and grants are unchanged.

## Authorization

General volunteers can't reach CareRide, enforced in the database:

- **No driver row, no rides.** Every ride, offer and driver policy, and every ride function
  (`respond_to_offer()` and the rest), goes through `private.my_driver_id()` or `acts_for_driver()`. Both need
  a `drivers` row, and no volunteer path creates one. `register_driver_profile()` refuses a login that
  already has a `VOLUNTEER` profile.
- **No organization, no organization data.** `profiles_volunteer_no_org` keeps `org_id` null, so
  `my_managed_org_id()` is null.
- **No escalation.** The browser has no write grant on `profiles.role`, `drivers` or either volunteer table.
  The two RPCs take the profile from the session, never from an argument.
- **Interests are never read for access.** No policy, function or app guard looks at `volunteer_interests`
  to decide anything.

In the app, `RequireRole` keeps general volunteers on the general volunteer pages. Any driving page sends
them back to `/volunteer`. This is for usability only: the database rules above protect the data.

Tests: `tests/db/volunteers.test.ts` (RLS, ownership, escalation attempts, ride access, deletion),
`tests/volunteers.test.ts` (rules and the mock backend), and `e2e/generalVolunteer.spec.ts` (screens).

## The app

| Where | What |
| --- | --- |
| `/onboarding` | New choice, **Join as a volunteer**, next to **Drive with CareRide** (the existing driver sign-up, renamed from "Become a service provider") |
| `/onboarding/volunteer` | About you (name from sign-up, optional phone), interests, review, then confirmation. No vehicle questions. |
| `/volunteer/...` | One workspace for drivers and general volunteers, adapted to each person. See [The adaptive workspace](#the-adaptive-workspace). |
| Admin → Users | Role filter **Volunteer**. Account details show "Takes part as" (general volunteer, volunteer driver, professional provider, organization driver) and any saved interests. |

## The adaptive workspace

The volunteer workspace shows each person what fits how they actually take part. The design is the same for
everyone: the sidebar with its identity card, the breadcrumb header, the greeting with its serif accent, and
the panels. Only the content changes.

**The presentation model.** `src/volunteer/workspace.ts` turns what the backend already says about the
signed-in person into a `VolunteerWorkspace`:

| Field | From | Means |
| --- | --- | --- |
| `experience` | `profiles.role` | `CARERIDE_DRIVER` for `DRIVER` accounts, `GENERAL_VOLUNTEER` for `VOLUNTEER` |
| `hasVolunteerProfile`, `interests` | `volunteer_profiles` / `volunteer_interests` | What they'd like to do. Never used for access. |
| `careRide` | the `drivers` row's `status` | `NOT_ENROLLED`, `PENDING`, `APPROVED` or `REJECTED` |
| `driverKind` | the `drivers` row | Volunteer driver, professional provider or organization driver |
| `approvedToDrive` | `canDrive()` | The existing eligibility rule, unchanged |

`VolunteerProvider` loads the volunteer profile once for the whole workspace, next to the driver profile it
already loaded. Every page reads `workspace` and `volunteer` from `useVolunteer()`. The model is
presentation only. Routes are still guarded in `App.tsx`, and the database refuses every ride action to an
account without an approved driver profile. A driver profile only counts on a `DRIVER` account, so even a
stray `drivers` row can't change a general volunteer's workspace.

**The three experiences.**

| | General volunteer | CareRide driver (approved / in review) | Volunteer with several interests |
| --- | --- | --- | --- |
| Identity card | "Volunteer" | "Volunteer · CareRide" (volunteer driver), "Professional transportation provider" or "Organization-affiliated driver" | Whichever of the two they are |
| Overview | Greeting, interests, **Your services** ("Your volunteering journey starts here.", with CareRide shown as running but *not enrolled*), volunteer profile, next steps | Unchanged: action required, the CareRide card and its four metrics, commitments, opportunities, request hours, impact. Plus their interests in the side column. In review: verification, "While you wait", and their interests. | Every interest listed. Each says what it means for *them*: Transportation reads "You drive with CareRide." only with an approved driver profile. |
| Navigation | Workspace: Overview, My interests · Personal: My profile, Settings · Help, My feedback | As before, with **My interests** added under Personal. Opportunities and My commitments appear once approved. | — |
| Phone tabs | Overview, Interests, Profile | Unchanged: Overview, Requests, Rides, Availability, Profile | — |
| Profile | Personal information, interests, service participation ("not enrolled") | The same, plus transportation details and verification | — |
| Help | Their workspace's layout and how to get help | Unchanged (safety, ride statuses) | — |

**Routes.** These are shared by `DRIVER` and `VOLUNTEER`: `/volunteer` (Overview), `/volunteer/interests`,
`/volunteer/profile`, `/volunteer/settings`, `/volunteer/help` and `/volunteer/feedback`. CareRide's pages
are `DRIVER` only and listed in `CARERIDE_PATHS` (`src/volunteer/navigation.ts`): opportunities,
commitments, transportation and rides, availability, and verification. A general volunteer who opens one
is sent to `/volunteer`. A driver in review can open them, and each explains why there's nothing to act on yet.

**Drivers from before interests existed** have no volunteer profile. Nothing is created when a page opens:
their Overview and profile show "No interests saved yet". Their first save on **My interests** calls
`register_volunteer()`, which adds a volunteer profile and leaves the role, driver profile, verification and
rides untouched. Removing Transportation from a driver's interests changes nothing about driving.

**Components.**

| Component | Where | Used by |
| --- | --- | --- |
| `InterestsSection`, `InterestItem` | `components/volunteer/InterestsSection.tsx` | Overview (both experiences), Profile |
| `ServiceParticipation` | `components/volunteer/ServiceParticipation.tsx` | General Overview ("Your services"), Profile |
| `InterestPicker`, `InterestIcon` | `components/volunteer/InterestPicker.tsx` (Phase 1) | Onboarding, My interests |
| `volunteerNav()`, `volunteerTabs()`, `isCareRidePath()` | `volunteer/navigation.ts` | The workspace shell |
| `volunteerWorkspace()`, `identityLabel()`, `overviewDescription()`, `interestStatus()` | `volunteer/workspace.ts` | The shell and pages |

Phase 1's separate general volunteer home (`VolunteerHome`) and its `useMyVolunteerProfile` hook were folded
into `Overview` and the provider.

## CareRide enrollment for volunteers (Phase 3)

A general volunteer applies to drive from their own workspace, on the account they already have. They don't sign up
again, and they don't give an email or password again. Their volunteer profile, interests and history stay as they
are. Applying never grants driving: only a platform admin's approval does, through the existing driver review.

### The decision: enrollment changes the role, approval grants driving

```text
Before                               After applying                        After approval
profiles.role = VOLUNTEER            profiles.role = DRIVER                (unchanged)
volunteer_profiles + interests       volunteer_profiles + interests        (unchanged)
no drivers row                       drivers row, status = PENDING,        status = APPROVED
                                     applied_as_volunteer = true           (review_driver(), admins only)
can't see or take rides              can't see or take rides               rides, like every driver
```

`apply_to_careride()` inserts the driver row and changes the role to `DRIVER` in one transaction. The profile id,
login, name, email, volunteer profile and interests aren't touched. This is the smallest change that keeps
authorization exactly as it was:

- **Every CareRide rule already reads "DRIVER + driver row" as enrolled and `status = 'APPROVED'` as allowed to
  drive.** That includes `private.my_driver_id()`, `acts_for_driver()`, `respond_to_offer()` (which refuses any
  driver that isn't approved), dispatch (approved drivers only), RLS, and the app's `RequireRole` and
  `RequireApprovedDriver` guards. A volunteer who has applied looks exactly like someone who signed up at
  `/onboarding/provider`: pending, with nothing to act on. No ride function had to learn a second way of being a driver.
- **General volunteering never depended on the role.** `volunteer_profiles` is keyed by profile, any role may hold
  one, and Phase 2 already shows interests, My interests and the profile to `DRIVER` accounts. So the change loses
  nothing. `VOLUNTEER` means "volunteers, not enrolled in a service". `DRIVER` means "enrolled in CareRide, at
  whatever verification status".
- **Changing the role on approval instead** would have left a `VOLUNTEER` account with a driver row, which every
  rule today treats as inconsistent (`serviceRoles()` ignores it on purpose). Each ride rule and screen would have
  needed a second check, and a later rejection would have needed a role change back. A generic permissions
  framework wasn't needed for one service.

Interest selection still plays no part. Transportation is neither needed to apply nor removed, added or read at
any point. A driver can drop it and keep driving.

### Database

One migration, `20261105120000_careride_volunteer_enrollment.sql`. It's additive and changes no existing function:

| Object | Kind | Purpose |
| --- | --- | --- |
| `drivers.applied_as_volunteer` | column, `boolean not null default false` | Tells the admin console that this driver enrolled from the volunteer workspace. Descriptive only, never read for access. Existing rows are `false`. It isn't in the drivers column update grant. |
| `public.apply_to_careride(jsonb)` | RPC, `security definer` | Applies for the signed-in account. Returns `{driverId, status, created}`. Execute is granted to `authenticated` only. |

What `apply_to_careride()` does:

- **Identity.** It uses `auth.uid()` only. The profile, status, background and organization never come from the browser. Any `status`, `background` or `orgId` sent is ignored, and a volunteer driver is always `INDEPENDENT`.
- **Validation.** It calls `private.insert_driver()`, the same function as every driver sign-up: vehicle (required, up to 80 characters), seats (1–20), cities (Vancouver or Richmond, at least one), request hours (`private.valid_request_hours`). Driving needs a phone. One already on the profile is kept as it is. Otherwise the one sent is checked with `private.valid_phone` and saved.
- **Who.** An active `VOLUNTEER` applies. A `DRIVER` with a driver row gets that application back unchanged (`created: false`), whatever its status. A `DRIVER` without one is refused with "contact the team", and nothing is made up. A login with no profile, organization staff, admins and closed accounts are refused.
- **Repeats and races.** It takes the same per-login advisory lock as every onboarding path, then locks the profile row `FOR UPDATE`, and `drivers.profile_id` is unique. A double tap, a second tab or a retry after a dropped response all get the first application back. A decision (approved or rejected) is never reset.

Approval is unchanged: `review_driver()` (platform admins only) sets the status. Nothing else is needed, because the
role is already `DRIVER`.

**Closing and deleting** need no changes. `deactivate_my_account()` takes the `DRIVER` branch (open offers expire,
accepted rides go back to dispatch). Permanent deletion already lists, erases and verifies both `driver_profile`
and `volunteer_profile` for any account (tested in `tests/db/careRideEnrollment.test.ts`).

### The app

| Where | What |
| --- | --- |
| Overview (general volunteer) | **Drive with CareRide** card: "Help people reach essential services.", **Apply to drive**, and **Learn about CareRide** (expands in place). With a draft on this device it reads **Continue application** and shows "Application not submitted yet". |
| Your services / Service participation | An "Apply to drive with CareRide" link while not enrolled. |
| `/volunteer/careride/apply` | The application, inside the workspace shell. Six steps: About CareRide, Your details (from the account; only a missing phone is asked for), Vehicle, Service area, Driving availability, Review (with the licence acknowledgement driver sign-up uses). Then a confirmation: "Your CareRide application has been submitted." Anyone who can't apply (already enrolled, or not a general volunteer) is sent to `/volunteer`. |
| Overview / Profile after applying | The CareRide driver workspace in review, as for any pending driver. The panel reads **CareRide application under review** (or **CareRide application** once decided). Interests, My interests, the profile and Settings are all still there. |
| Admin → Approvals | The existing driver queue. Volunteers who applied show as "Driver verification · existing volunteer". The review page adds **Applied through**: existing volunteer from their workspace, driver sign-up, or added by a transport provider. Approve and Reject are the existing actions. |

**Reused, not copied.** The vehicle, cities and request-hours fields are `DriverVehicleFields`, `DriverCityFields`
and `DriverRequestFields`. The step rules (`driverVehicleErrors`, `driverAreaErrors`, `driverRequestErrors`,
`driverAboutErrors`) moved out of `ProviderOnboarding` into `components/driverDraft.ts`, and both flows use them.
`ReviewCard` moved to `components/onboarding/ReviewCard.tsx`. The enrollment rules (`canApplyToCareRide`,
`careRideApplicationErrors`, `toApplication`, `careRideEnrollmentView`) live in `src/volunteer/enrollment.ts`. Both
backends and the page use them.

**Session.** After the backend confirms, the page calls `reloadSession()`. The same signed-in account now has role
`DRIVER`, so `VolunteerProvider` loads the driver profile and the workspace becomes the CareRide one by itself. No
sign-out, no redirect loop. The confirmation stays on screen because it's held in the page, not derived from the
role. An admin's approval reaches the volunteer through the app's usual data refresh, and no new session is needed.

**Drafts.** The existing onboarding drafts (`onboarding/drafts.ts`, kind `careride`) are kept per signed-in
identity in localStorage. They hold only the form answers (phone, vehicle, seats, accessibility, cities, hours),
never a password, token or document, and the acknowledgement is always asked again. Nothing is saved for just
reading the introduction. The draft is cleared after a confirmed submission, as soon as the account is enrolled
(so a stale draft can't be sent), and on sign-out. If a submission fails (network, expired session), the error is
shown, the draft stays, and nothing claims the application was sent.

**States**, from `careRideEnrollmentView()`:

| State | Shown |
| --- | --- |
| Not enrolled | Apply to drive |
| Application incomplete (draft on this device) | Continue application |
| Pending | CareRide application under review. Requests and commitments aren't in the navigation, and opening them directly explains why. |
| Approved | The full CareRide dashboard: opportunities, commitments, availability, verification, rides, impact |
| Rejected | "Your driver application wasn't approved." No ride actions. General volunteering is unchanged. |
| Existing driver | Their workspace as before. No enrollment card, and the apply page sends them home. |

### Mock backend

`mockService.applyToCareRide()` applies the same rules with the same shared validators. It takes the account from
the session, always creates a `PENDING` `INDEPENDENT` driver with `appliedAsVolunteer`, changes the role, keeps
the volunteer profile and returns an existing application unchanged. Two related demo gaps were closed so the mock
matches the database: `setDriverStatus()` now refuses anyone but a platform admin (like `review_driver()`), and
`respondToOffer()` refuses an offer to a driver who isn't approved (like `respond_to_offer()`). Priya and Alex,
the seeded general volunteers, have no phone, so the demo shows the phone step.

### Tests

- `tests/careRideEnrollment.test.ts`: eligibility, the shared validation (vehicle, cities, hours, phone), identity, interest and session continuity, duplicates, pending, approved and rejected, existing drivers, admin-only review, workspace navigation per state, drafts, deletion.
- `tests/db/careRideEnrollment.test.ts` (PGlite, real migrations): creation, identity and interest preservation, always pending, refusals leave nothing, the browser can't pick a status, background or organization, repeats and simultaneous submissions make one driver row, the unique constraint, no self-approval or role change, data isolation between volunteers, pending and rejected drivers can't accept rides, approved ones can, existing drivers unaffected, closing and permanent deletion.
- `e2e/careRideEnrollment.spec.ts`: apply and land in review, the account reused, validation, draft resume, admin approval and the driver workspace afterwards, rejection, two tabs making one application, driver pages closed while pending, existing drivers, a full ride from request to drop-off by a newly approved volunteer driver, and the whole flow on a phone. `e2e/accessibility.spec.ts` checks the application page too.

### Rolling out Phase 3 to staging

1. `npm run test:db` locally.
2. Link the CLI to **staging**. `npm run db:status` should list exactly `20261105120000` as pending (after Phase 1's two files).
3. `npm run db:push`. It's additive: one defaulted column and one new function.
4. Deploy the frontend to staging. **Order matters:** the new frontend reads `drivers.applied_as_volunteer` in every driver query, so apply the migration first.
5. Smoke test: as a general volunteer, apply and see "under review", with interests intact and requests closed. As an admin, find them in Approvals ("existing volunteer") and approve. As the volunteer, see the CareRide dashboard and take a ride. Also check that an existing driver is unchanged.
6. **Rollback:** roll the frontend back first, because the old one never calls the function or reads the column. Then, if needed, `drop function public.apply_to_careride(jsonb)` and `alter table public.drivers drop column applied_as_volunteer`. Accounts that already applied stay valid pending or approved `DRIVER` accounts with their volunteer profiles.

## Existing drivers

Nothing about an existing `DRIVER` account changes. The role, driver row, verification status, offers, rides,
history, routes, navigation, and closing or deleting the account all work as before. Driver onboarding
(`/onboarding/provider`, `register_driver_profile()`) is unchanged. Drivers are never given a volunteer
profile automatically. Since the adaptive workspace, their dashboard also lists any interests they choose to
add, and their navigation has **My interests**. Every other part of their workspace is as it was.

## Mock backend

`src/services/mockService.ts` mirrors the database rules: `registerVolunteer`, `getVolunteerProfile` (your own,
or anyone's for an admin), and `updateMyVolunteerInterests`, plus self-close and deletion. The seed adds
**Priya** (`priya@careride.demo`, Food distribution and Community outreach) and **Alex Morgan**
(`alex@careride.demo`, Transportation and Community outreach). Both are general volunteers with no driver
profile. **Maya**, an approved driver, has saved interests (Transportation, Food distribution). **Frank** and
the other drivers have none, as for every driver from before interests existed. Demo data saved in a browser
before volunteers existed gets these added once, on its first load. After that, an account deleted on purpose
stays deleted.

## Rolling out to staging

Nothing has been applied to any hosted project. Production isn't touched by this branch.

1. Run `npm run test:db` locally. It applies every migration to an embedded Postgres and runs the RLS tests.
2. Link the Supabase CLI to the **staging** project and check what's pending with `npm run db:status`. Expect
   exactly `20261104120000` and `20261104120100`.
3. Apply them with `npm run db:push`. The CLI applies the files one after another, in order. Because the
   enum value is in a file of its own, it's committed before the second file uses it. (The test harness
   applies them the same way.) Both are additive. The only constraint added to
   an existing table (`profiles_volunteer_no_org`) is satisfied by every existing row, since no row has
   role `VOLUNTEER` yet.
4. Deploy the frontend to staging with `VITE_DATA_BACKEND=supabase` pointed at staging.
5. Smoke test: sign up and register as a volunteer, edit interests and refresh, check that a volunteer is
   sent home from `/volunteer/opportunities`, sign in as an existing driver and see rides, and preview a
   volunteer's deletion as an admin.
6. **Rollback:** the frontend can be rolled back on its own, because the old frontend never calls the new
   functions. The schema changes are additive and can stay. If they must go: drop the two tables, the four
   new functions, the trigger and the constraint, and restore the four redefined functions from
   `20261024120000` and `20261029150000`. An enum value can't be dropped in Postgres, but an unused one is
   harmless.

## Known limitations and technical debt

- **One profile per login.** A volunteer can't also join an organization on the same login
  (`submit_join_request()` refuses an account that already has a role). Driving is open to them since Phase 3
  through `apply_to_careride()`. `register_driver_profile()` still refuses them, on purpose: it's the sign-up for
  a new identity.
- **No resubmission after a rejection.** The existing driver review has no "apply again" path for anyone, and
  Phase 3 keeps that policy: `apply_to_careride()` returns the rejected application unchanged. The team can still
  change its decision on the review page. A self-service resubmission (with a cool-down, or a request to
  reconsider) is a product decision still to be made.
- **Professional providers and organization drivers** don't enroll this way. A volunteer is always enrolled as
  `INDEPENDENT` (a volunteer driver). Taxi and rideshare drivers still use driver sign-up.
- **Driver documents** still aren't uploaded in the app, for anyone. The team checks the licence directly, as the
  application says.
- **A pending applicant sees the driver workspace in review**, including CareRide's Rides and Availability pages.
  That's the same as every pending driver. Pages with ride actions explain that they open after approval.
- **Name and phone can't be edited** by a volunteer in the app, the same as for drivers. The Relay Collective
  team changes them.
- **Copied functions.** Four functions were redefined by copying their latest version. A later change to
  any of them must start from `20261104120100_general_volunteers.sql`.
- **Two places list the interest codes**: the SQL check and validator, and `VOLUNTEER_INTERESTS`. Each points
  to the other.
- **Availability is CareRide's.** It's when a driver may be sent ride requests, so general volunteers don't
  have it. Wider volunteering availability belongs to a future Volunteer Coordination module.
- **A general volunteer with no interests** can't be made through the app or the database (at least one is
  required). The workspace still handles it, for data from an older or partial save.

## Future extension

- **Done in Phase 2:** the adaptive workspace above, with drivers' interests shown and editable.
- **Done in Phase 3:** optional CareRide enrollment for general volunteers
  ([above](#careride-enrollment-for-volunteers-phase-3)). It followed this outline, as a separate
  `apply_to_careride()` rather than a change to `register_driver_profile()`, so new-identity sign-up stayed as it was.
  The outline, as planned:
  1. **Database.** `register_driver_profile()` refuses a login that already has a profile. Let an active
     `VOLUNTEER` call it: insert a `PENDING` `drivers` row through `private.insert_driver()`, and change the
     role to `DRIVER` in the same transaction, keeping `volunteer_profiles`. Every CareRide policy and ride
     function then works unchanged, because they key off the driver row and its approval. Add PGlite tests:
     a pending driver still can't see rides, and an admin's approval opens them.
  2. **App.** An "Enroll in CareRide" path from the Transportation interest and the Service participation
     panel, reusing the driver onboarding's vehicle, area and availability steps (`DriverFields`), without
     asking again for what the profile already has. After `reloadSession()`, the workspace becomes the
     `CARERIDE_DRIVER` experience on its own, and the existing verification screens take over.
  3. **Wording.** Change Transportation's availability text in `src/volunteer/interests.ts` ("isn't open to
     volunteer accounts yet").
- **Later: Volunteer Coordination module.** Organization-posted opportunities, matching and scheduling.
  Interests become a filter for suggestions. Enrollment and permissions for each service stay in that
  service's own tables, following the `drivers` pattern, never in `volunteer_interests`.
