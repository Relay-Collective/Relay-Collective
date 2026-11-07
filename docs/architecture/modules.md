# Service modules

Relay Collective is one app: one sign-in, one Supabase project, one data service. Each organization works in a shared workspace, and **service modules** add one kind of work on top of it. **CareRide** (transportation) is the only module that works today. Volunteer coordination, resource sharing and cross-organization collaboration are listed as *planned* in the registry. They have no code, routes or data.

This page explains where code goes and which way imports are allowed to point.

## Layers

```text
                         App.tsx  (routes, role guards, providers)
                        /        \
                       v          v
   Core platform                    CareRide module
   workspace shell, team,           src/modules/careride
   organization, onboarding,               |
   auth, feedback, admin console,          |   consumers use only its public files:
   volunteer workspace  ---------------->  |   index.ts · domain.ts · paths.ts · brand.tsx
                       \                  /
                        v                v
                       Shared infrastructure
        services/ (dataService: mock + Supabase)  context/  hooks/  types/
        components/ (ui, form, workspace kit)  logic/ (shared rules + formatting)
```

The rules:

- **Shared infrastructure never imports a module.** `services/`, `context/`, `hooks/` and `types/` know nothing about `src/modules`. A test enforces this.
- **CareRide never imports the admin console, the volunteer workspace or `src/pages`.** It depends only on shared infrastructure and on the platform contracts listed below. A test enforces this.
- **Everything outside the module uses only CareRide's public files.** A test enforces this, so a deep import such as `modules/careride/logic/rideText` from outside the module fails CI.
- **Inside the module, files import each other directly**, never through `index.ts`.

`tests/careRideModule.test.ts` holds these boundary checks, alongside checks on route and URL compatibility.

## Core platform

These stay outside any module:

- authentication, sessions and identities (`context/AppContext`, `hooks/useApp`, `components/RequireAuth`)
- organizations, memberships, invitations and approvals (`pages/workspace/{Organization,Team}`, `components/membership`, `pages/onboarding`)
- the workspace shell (`components/workspace/WorkspaceShell`, sidebar, header) and its context (`context/WorkspaceProvider`)
- the module registry and workspace navigation (`workspace/modules.ts`, `workspace/navigation.ts`, `workspace/paths.ts`)
- product feedback (`feedback/`, `components/feedback`, `context/FeedbackProvider`)
- the platform admin console (`admin/`, `pages/admin`, `components/admin`)
- the volunteer workspace (`volunteer/`, `pages/volunteer`, `components/volunteer`)
- the design system (`components/ui.ts`, `components/form`, `components/workspace/{styles,states,PageHeader,…}`, `components/shell`)

## The CareRide module

`src/modules/careride/` owns transportation for partner organizations:

| Folder | What it holds |
| --- | --- |
| `components/CareRideLayout.tsx` | The module frame: mark, name, "Transportation coordination", and the Overview / Requests / New ride / Destinations / History tabs |
| `pages/` | `Dashboard` (ride overview), `Requests` (requests and history), `RequestRide` (book, edit, return, ride again), `RideDetail`, `Destinations` |
| `components/` | Booking form pieces, dashboard tiles and lists, `StatusBadge`, `RideCard`, `RideHistory`, the client and transit slips, `RideProgress`, `RideFeedbackCard` |
| `logic/` | Transportation presentation rules: request views and metrics (`requestSummary`), ride insights and alerts, ride wording (`rideText`, `rideEventText`), ride stages, accepted-ride messages, driver match previews, popular destinations, pickup-time parsing, hospital wait times, group-ride grouping (written, not used yet; see the TODOs in `RequestRide` and `RideDetail`) |
| `services/`, `hooks/` | The hospital wait-time feed and its hook, used only by the booking form |

### Public interface

| File | Use it for | Imports |
| --- | --- | --- |
| `index.ts` | the layout and pages (for `App.tsx`), plus `StatusBadge`, `RideCard`, `RideHistory` and `NextPickup` for other screens | React and everything behind the pages |
| `domain.ts` | pure rules and wording: request metrics, action items, activity, `isFinished`, `needsAction`, `isDriverLate`, badge and passenger labels, accepted-ride messages, pickup-time helpers | no React, no data service, so it's safe in `logic/` and in tests |
| `paths.ts` | CareRide's URLs, `inCareRide`, `rideIdFromPath` | nothing |
| `brand.tsx` | `CareRideMark`, `CareRideBrandMark` | nothing |

The registry (`workspace/modules.ts`) and the admin, volunteer and workspace navigation files import only `brand.tsx` and `paths.ts`. If they imported `index.ts` they would form a cycle: `index → CareRideLayout → ServiceModuleCard → modules.ts → index`.

### Data access

CareRide calls the shared `dataService` directly (`requestRide`, `updateRide`, `cancelRide`, `retryRide`, `getRide`, `listRidesForHouse`, `listDestinations`, `giveFeedback`, and so on). There is no CareRide service facade. `dataService` is already the single contract that the mock and Supabase backends both implement, so a facade would only forward calls.

Some ride rules live in shared `src/logic/` because the data layer enforces them too: `dispatch`, `matchDrivers`, `capacity`, `driverEta`, `estimateFare`, `rideEvents`, `feedback` and `requestHours`. The mock backend (`services/mockService.ts`, `services/seed.ts`) mirrors the database's rules, and the shared data layer must not import a module. CareRide imports these rules like any other consumer.

## Routes

Moving files did not change any URL. CareRide's addresses are defined in `modules/careride/paths.ts` and spread into the one `paths` object in `workspace/paths.ts`, so call sites still write `paths.ride(id)` and so on.

| URL | Screen |
| --- | --- |
| `/workspace/transportation` | Ride overview |
| `/workspace/requests` (`?view=attention\|waiting\|confirmed\|past`) | Requests; `?view=past` is History |
| `/workspace/transportation/new` (`?edit=`, `?returnOf=`, `?again=`) | Book, edit, book the return, ride again |
| `/workspace/transportation/rides/:id` | A ride |
| `/workspace/transportation/destinations` | Saved destinations |
| `/partner`, `/partner/request`, `/partner/ride/:id`, `/partner/destinations`, `/partner/*` | Redirects to the routes above, keeping the query string |

The routes stay where they were in `App.tsx`, inside `RequireRole(['PARTNER'])` → `RequireOrgNotRejected` → `WorkspaceShell` → `CareRideLayout`.

## Volunteer drivers

Drivers take part in CareRide through the volunteer workspace (`/volunteer/...`). That workspace owns the driver's side: opportunities, commitments, availability, verification, trip actions, the driver's ride pages and `VolunteerProvider`. These stay in the volunteer workspace. Driver identity, verification and participation (`volunteer/participation.ts`, `volunteer/verification.ts`) are account-level, not transportation-only.

General volunteers (role `VOLUNTEER`) use the same workspace without its driving pages, and their volunteering interests never grant access to CareRide. See [volunteers.md](volunteers.md).

The volunteer workspace uses CareRide's ride wording and status presentation through `domain.ts` and `index.ts`. CareRide never imports the volunteer workspace.

Driver-side trip components such as `components/DriverTripActions`, `components/OfferCard`, `components/maps` and `components/volunteer/TripPanel` are still under `components/`. They belong to the transportation domain, but splitting them from the volunteer workspace was left for later (see below).

## Admin oversight

The admin console (`/admin/transportation`, `/admin/transportation/rides/:id`) stays in the core platform. It reuses CareRide's `StatusBadge` and `RideHistory`, and `requestReference` and the ride labels from `domain.ts`, so nothing is duplicated. Admin access and permissions did not change.

## Contracts CareRide relies on

- `useApp()`: the signed-in user and their role
- `useWorkspace()`: the organization, its house, its rides and `driverOf(ride)` (a `DriverInfo`, defined in `types/`)
- `useData()` and `dataService`: loading and changing records
- `types/`: `Ride`, `Destination`, `Driver`, `House` and the other records
- the workspace design kit: `components/ui`, `components/form`, `components/workspace/{PageHeader,states,styles,ServiceModuleCard}`

`WorkspaceProvider` loads the organization's rides, not CareRide, because the sidebar badge and the workspace overview need them on every workspace page. Changing that would change when data loads, so it was left alone.

## Left for later

- **Ride notices in the shells.** `components/ShellNotices` shows ride accepted, ride cancelled and incoming request notices in every shell, using `RideAcceptedNotice`, `RideCancelledNotice` and `IncomingRequests`. They are CareRide UI hosted by shared shells. Moving them needs a way for modules to put notices into a shell.
- **Driver-side trip components** (see Volunteer drivers above). Move them when a second volunteer service makes the volunteer/transportation split concrete.
- **Legacy transport providers** (`/org`, `pages/org/{OrgHome,Drivers,Bookings}`, `ORG_ADMIN`). Hidden from sign-up but still working. They use CareRide's `RideCard` and `isDriverLate`, and are not part of the module.
- **`adminSummary` and `volunteerSummary`** live in `src/logic/` but belong to the admin console and the volunteer workspace. They use CareRide only through `domain.ts`.
- **The data service is not split per module.** `dataService` covers rides, organizations, accounts and feedback in one interface. Splitting it would change an API contract.
- **One existing import cycle**, `native/buildInfo.ts` ↔ `native/platform.ts`, is unrelated to modules.

## Adding a module

When a second module is defined and built (not before):

1. Give it a folder under `src/modules/<id>/`, laid out like CareRide, with only the folders it needs.
2. Give it a `paths.ts` and spread its paths into `workspace/paths.ts`. Keep URLs stable once published.
3. Change its registry entry in `workspace/modules.ts` from `planned` to `active` with a `route`. The sidebar and module cards follow from the registry. Don't add a second registry.
4. Mount its pages in `App.tsx` inside the existing workspace shell and role guards, through the module's `index.ts`.
5. Add its folder to the boundary tests in `tests/careRideModule.test.ts`: other code uses only its public files, and modules don't import each other's internals. Anything two modules both need moves to shared infrastructure.
6. Use existing platform contracts (`useApp`, `useWorkspace`, `dataService`) and existing database tables and policies. A module that needs new tables, roles or permissions is a separate, reviewed change.
