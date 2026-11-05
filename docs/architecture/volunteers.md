# Volunteers: identity, interests, and CareRide driving

Relay Collective treats volunteering as a platform-level identity. Driving for CareRide is one specific
transportation capability that a person may also hold. Someone can volunteer without a vehicle, and choosing
an interest never grants access to anything.

This is Phase 1. It covers the identity, the data model, registration, interest editing, and a small home
screen. It doesn't include volunteer opportunities, matching or scheduling. CareRide is still the only
operational service.

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

- **One profile per login.** A volunteer can't also join an organization or enrol as a driver on the same
  login: `register_driver_profile()` and `submit_join_request()` refuse an account that already has a role.
  Optional CareRide enrollment for volunteers is Phase 2.
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
- **Next: optional CareRide enrollment for general volunteers.** It needs:
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
