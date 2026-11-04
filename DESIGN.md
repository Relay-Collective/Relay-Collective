# Relay Collective: Design

Visual and tone guidelines for Relay Collective. **v2.1 (console 2.1, the route rail), shipped with Relay Collective 1.8**, on the v1.0 palette, type and logo from 1.6. One light-first system for the whole product: the public site, sign in and onboarding, the organization and volunteer workspaces, and the admin console.

**In three words:** clear, warm, precise. **One impression to leave:** "technology that brings us together, and gets out of the way."

The public site is a Persuade surface: editorial, expressive, product-led. The consoles are Operate surfaces: dense where that helps, calm, scannable, and since 2.1 the landing page's world at work: a white sidebar whose links are stations on one electric route, the landing's hairline grid behind the top of each page, display-size greetings, and one electric field per overview. They share one palette, one type system, one logo and one component language, so they read as the same product.

## 1. Direction

Relay Collective is an independent third-party platform. The Salvation Army is our pilot partner, not our owner. The design is **inspired by** Salvation Army branding, not a copy of it.

What we borrow is the *spirit*: **warm, humble, practical, and dependable**. Bold primary colours, plain speech, no frills, built to be used by busy people.

What we do not borrow:

- The shield, crest, or any Salvation Army logo or wordmark
- The exact red-and-yellow pairing as our primary identity
- Their typefaces, taglines, or "Salvation Army" voice
- Anything that could read as official endorsement

> Source note: the first linked PDF (ID standards) is a small logo sheet. It gives Pantone 109 (yellow) and Pantone 185 (red), and no typography or voice rules. Everything beyond those two colours below is our own interpretation. Check the full brand standards before using any SA marks in the pilot (e.g. a "Pilot partner" badge on Belkin House screens), and get written permission first.

### What we learn from the Salvation Army brand strategy

A second source ("0202. Branding", PRD Manual extract) is about brand strategy, not visuals. Three ideas are worth echoing:

1. **A brand is emotion and consistency, not just a logo.** Their image is a "sphere": it looks the same from any angle. Every Relay Collective screen, email, SMS, and driver message should feel like the same calm, reliable helper.
2. **The promise must be lived, not just stated.** Their "Giving Hope Today" has three parts: *Giving* (nothing kept back), *Hope* (a better outcome is possible), *Today* (relevant right now). We use the same three-part structure with our own promise: **"Rides that show up. Today."**

   | Their idea | Our version in the product |
   | --- | --- |
   | Giving | Free for residents, no strings. Nothing asked of the client, nothing stored about them. |
   | Hope | A confirmed ride means a resident gets to the appointment that matters. Show that outcome, not the mechanics. |
   | Today | Immediacy. Live status, fast offers, and an unfilled ride is surfaced right away, never silently. |

3. **Lead with "today".** Their point about staying immediately relevant maps to our product: real-time status, clear times, "now" language.

Not borrowed: the faith-based framing. Their brand is explicitly spiritual and mission-led. Relay Collective is secular and serves any organization, so we echo the warmth and structure, never the religious message.

**Rule of thumb:** if someone screenshots a Relay Collective screen, they should say "that's Relay Collective", not "that's the Salvation Army".

## 2. Principles

1. **Clear over clever.** Staff are mid-task, often on a phone. One main action per screen.
2. **Warm, not corporate.** Friendly, human, never clinical or charity-pitying.
3. **Dignity first.** The client is never shown as a "case". Ask only for what the driver needs (an optional first name helps them find the right person), and no sad imagery.
4. **Obvious status.** A ride is booked, offered, accepted, or unfilled. The colour and label say so at a glance.
5. **Accessible by default.** WCAG 2.2 AA minimum. Works outdoors, on old phones, with large text.

## 3. Colour

Light first. Porcelain and white take most of the area; midnight ink carries type and primary actions; electric blue marks what is selected, active or linked; cantaloupe adds warmth in small doses. Semantic colours (green, amber, red) only ever mean what they say.

| Role | Token | Hex | Use |
| --- | --- | --- | --- |
| Porcelain | `canvas`, `porcelain`, `rc-canvas` | `#f8f9f7` | Page background everywhere |
| Surface | `white` | `#ffffff` | Cards, dialogs, sidebars, headers, inputs |
| Soft surface | `slate-100` | `#f1f4f5` | Quiet fills: chips, table heads, hover |
| Border | `slate-200`, `rc-line`, `hairline` | `#e5e9ec` | Card and section edges |
| Midnight ink | `ink`, `midnight`, `rc-navy` | `#111820` | Headings, strong text, primary buttons |
| Body text | `slate-800` / `slate-600` | | Body / secondary |
| Muted text | `slate-500`, `hush` | `#64748b` | Captions and meta. 4.5:1 on porcelain and white, not on `slate-100` |
| Electric | `brand-500`, `electric` | `#0297de` | Brand graphics, focus rings, large shapes. Not for small text |
| Electric ink | `brand-600`, `rc-blue`, `electric-ink` | `#0272a8` | Selected states, active navigation, links. 5.3:1 with white |
| Electric tints | `brand-50` / `brand-100` | `#eef8fd` / `#d9f0fb` | Active nav, selected rows, info panels |
| Cantaloupe | `coral-400`, `cantaloupe` | `#fc734d` | The logo's centre, discs and small warm details. Not for text |
| Cantaloupe text | `coral-700`, `cantaloupe-ink` | `#a83a18` / `#b8441f` | Warm text on light grounds |
| Cantaloupe fill | `coral-600` | `#c9471f` | Volunteer identity (avatar, workspace badge) with white text |
| Success | `emerald-50` / `emerald-700` / `emerald-800` | | Approved, completed, resolved, saved, active. Only these |
| Warning | `sun-100` / `sun-400`, `amber-*` | | Waiting, pending review. Yellow is a fill with ink text, never text |
| Error / urgent | `red-*`, `care-red` | | Errors, destructive actions, "No driver available". Never replaced by cantaloupe |

The older `rc-*` names still work: they point at the 1.6 values. `rc-teal`, `rc-teal-ink` and `rc-mint` are electric, for section icons and progress; success always uses emerald explicitly.

**Role identity** (`tones` and `ROLE_TONE` in `src/components/ui.ts`) shows on avatars and context tiles only. Active navigation is electric in every console.

| Role | Tone |
| --- | --- |
| Partner organization | `brand` (electric) |
| Volunteer driver | `coral` (cantaloupe) |
| Org admin (driver provider) | `amber` |
| Relay Collective admin | `ink` (midnight) |

**Rules**

- Never rely on colour alone for status: icon and words too.
- Small text in a brand hue uses the 600+/`-ink` shade. Display-size cantaloupe words use `cantaloupe-display` `#e85a30` (3.35:1).
- No gradients in UI chrome, no glows, no glass. Large flat discs of electric and cantaloupe are the brand's only decorative shapes, and only on brand surfaces (public site, auth brand panel, What's New header) and, in the consoles, the electric field that carries the CareRide route on the overviews (`RouteField`).

### Ride status colours

Matches `RideStatus` in `src/types/index.ts` and the labels in `StatusBadge.tsx`.

| Status | Colour | Icon | Label |
| --- | --- | --- | --- |
| `SEARCHING` | Blue tint | Clock | "Finding a driver" |
| `OFFERED` | Sun yellow fill, ink text | Bell | "Waiting for driver" |
| `ACCEPTED` | Green tint | Check | "Driver confirmed" |
| `PICKED_UP` | Cyan tint | Car | "Picked up" |
| `COMPLETED` | Slate tint | Check-circle | "Completed" |
| `NEEDS_ATTENTION` | Care red fill, white text | Alert triangle | "No driver available" |
| `NO_SHOW` | Coral tint | User-x | "Client didn't show" |
| `CANCELLED` | Slate, muted | X-circle | "Cancelled" |
| `CANCELLED`, sent on transit | Teal tint | Bus | "Sent on transit" |

Done in v0.2: `StatusBadge` follows this table, with the icon beside the words (`STATUS_ICON`). The short phone label in the ride list uses the same icons. Status is never shown by colour alone.

On a `RideCard`, the badge carries the status. Only a ride that needs someone gets more: a light red strip across the top of the card that says why in words ("The driver hasn't arrived yet. Give them a call"). On the partner dashboard these rides stay in Upcoming, listed first under "Needs action", each with what happened and the next step. Finished rides (completed, no-show, cancelled) turn their route grey, so live rides stand out.

## 4. Typography

Self-hosted with `@fontsource` (loaded once in `src/main.tsx`).

- **Space Grotesk** (`font-display`, `font-heading`, `font-grotesk`), 500–700: page and section titles, numbers in stat tiles, the wordmark. Tracking −0.02 to −0.04em, tighter as it gets larger.
- **DM Sans** (`font-sans`, `font-dm`), 400–700: everything you read or operate: body, labels, buttons, forms, tables, navigation.
- **Instrument Serif italic** (`font-editorial`): one or two accent words in public-site headlines, the auth brand panel and the What's New subtitle, and (2.0) the time of day in the console greetings (`Greeting` in `PageHeader.tsx`: "Good *morning*.", cantaloupe-display, 1.12em). Never in forms, tables, statuses or admin information.

| Style | Size / line | Weight |
| --- | --- | --- |
| Public hero | 44–92px / 0.95 | Space Grotesk 600 |
| Page title (consoles) | 30px phone, 40px from sm / 1.08, −0.035em | Space Grotesk 700 (`PageHeader`, `pageTitle`) |
| Auth title | 30–38px / 1.08 | Space Grotesk 600 (`authTitle`) |
| Section title (on the sheet) | 22px | Space Grotesk 700 (`sectionTitle`) |
| Panel title | 18px | Space Grotesk 700 (`panelTitle`) |
| Metric number | 34px phone, 44px from sm, −0.045em | Space Grotesk 600, tabular |
| Body | 16px / 1.5 | DM Sans 400 |
| Label / button | 14–16px | DM Sans 600 |
| Caption | 13px | DM Sans 500 |

- No weight above 700. Sentence case everywhere, including sidebar group labels and kickers; small all-caps only for table column heads.
- Never below 16px for body on phones. Headings balance (`text-wrap: balance`); running text avoids one-word last lines on the public site.

## 5. Shape, spacing, layout

- **Radius (2.0):** 16px (`rounded-2xl`) for cards and panels, 20px for dialogs, 28px for the sheet's one turned corner. 12px (`rounded-xl`) for inputs, tiles and sidebar items. 9999px (`rounded-full`) for every button, chip, tab pill and avatar. 8px (`rounded-lg`) only for small inline icon buttons.
- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48. Tailwind defaults.
- **Touch targets:** 48×48px minimum. Staff may be wearing gloves or in a hurry.
- **Layout:** mobile-first, single column up to 640px, max content width 960px. Booking flows are step-by-step, one question per step.
- **Elevation (2.0):** three tokens in `index.css`. `--shadow-rest` (a hairline of contact and a soft offset fall) on every card and panel, with a `slate-200/80` edge; `--shadow-lift` on menus and on interactive tiles under hover; `--shadow-press` on primary and danger pills (a light top edge and a short fall). The current sidebar item and the volunteer tab pill are midnight and carry `--shadow-press` like a primary pill. The sidebar's relay point has the one coloured shadow, a short cantaloupe fall under its white ring. No zero-offset glows.
- **Frame and sheet (2.1, the route rail):** from the tablet breakpoint a white sidebar with a `slate-200/80` hairline edge sits beside the porcelain sheet. Behind the top of every page, the landing's still hairline grid (`.rc-grid`: midnight at 6%, 64px cells, 44px on phones) fades out by about 440px, before the work gets dense. The sticky header behaves like the landing navbar: clear over the grid at the top, white with a hairline once the page scrolls. Phones have no sidebar: the drawer and the volunteer tab bar are white with a hairline edge and a soft fall. Still no radial glows, blobs or frosted glass.
- **Public hero mesh:** the one exception to a plain ground. Behind the landing hero only, a still hairline midnight grid that a soft electric light picks out around the pointer (light, never movement, so text never shifts), and that carries cantaloupe relay points from node to node (`components/landing/HeroMesh.tsx`). Lines and dots only: still no glows, blobs or gradient fields.
- **Public site:** may use larger radii (16–28px) on product pictures and a soft offset shadow (`rcl-lift`) on floating product cards. The consoles keep the 12px rule.

### Signature move: the road rule

A solid 4px rule across the top edge, like the road in the logo. It appears in four places only:

1. (Retired in 1.6: the coloured stripe across the top of pages is gone. The public site's hero route line took its place.)
2. The next-pickup panel. One per screen, so it still means "this one matters".
3. The route on every ride card: an open brand-blue dot for pickup, a filled dot for drop-off, joined by a short blue line. It turns grey once the ride is over.
4. The landing "How it works" steps, which sit on one horizontal (or, on phones, vertical) road line.

It replaces the old rainbow `bg-spectrum` bar. Plain cards (audience cards, stat tiles) get no rule; a bar on every card stops meaning anything. Never put the rule on the left side of a card: side stripes are the most recognisable "AI template" tell.

## 6. Components

Shared classes live in `src/components/ui.ts`, `src/components/workspace/styles.ts` (consoles) and `src/components/auth/styles.ts` (sign in and onboarding). Change these before touching a screen.

- **Primary button** (`primaryButton`): midnight ink fill, white text, pill, `--shadow-press`. Hover `brand-700`. One per screen.
- **Secondary button:** white, `slate-300` border, ink text; the border darkens on hover.
- **Signature CTA pair** (public site only, `ctaSignature` / `ctaQuiet` and their chambers in `components/landing/styles.ts`, used by `HeroCTAButtons`): for a page's one main decision. Two 60px pills, label left and a 48px round arrow chamber set 6px inside the right edge. Primary is `electric-ink` with white text and a white chamber, a light top edge, a faint inner base and a short offset shadow; it lifts 1px on hover. Secondary is white with a `midnight/15` hairline and a porcelain chamber that turns midnight on hover. On hover the arrow hands off: one slides out as the next slides in. Full width and stacked 12px apart on phones. Focus is a 3px `electric-ink` outline, offset 3px.
- **Selected state:** electric. Choice cards, chips, toggles, the current onboarding step and active navigation use `brand-600` / `brand-50`.
- **Destructive:** red fill or red outline, always behind the existing confirmation dialogs.
- **Inputs:** 48px tall, `slate-300` border, `brand-600` border and soft `brand-100` halo on focus, red when invalid. Labels above, help below.
- **Cards and panels:** white, `slate-200` edge, 12px radius, no shadow. Shadows only for things that float: menus, dialogs, toasts, the version chip.
- **Status chips:** tinted fill, matching text, icon and words (see the table above).
- **Focus:** 3px `brand-500` ring with a 2px offset. Never removed.
- **Tables** (`DataTable`): scroll inside their own frame on tablets; phones get a card list. Never widen the page.
- **What's New** (`VersionBadge`): a white chip with an electric sparkle and the version; phones show only the icon and version. The dialog leads with the current release on porcelain (title in Space Grotesk, summary in Instrument Serif), then earlier releases, each with "Give feedback on this update".
- **Empty states:** one friendly line and one action. An all-clear ("You're all caught up.") is the compact one-row `EmptyState`: green check when the empty list is good news, grey when the list simply hasn't started. It never takes the space of real work.
- **Console header** (`ShellHeader`): one 56px line, `Organization › Section`, then the page's actions and the account menu. Phones show the section only. The page's h1 stays the only heading.
- **Metric strip** (`MetricGroup` + `MetricCard`): one bordered panel split by hairlines, never a row of separate cards. Each cell is a three-row subgrid (label with a 16px icon, number, hint), so numbers line up when a label wraps. A raised cell is tinted red (something's wrong) or sun (work waiting), with the hint in words.
- **Attention first:** each overview opens with what needs the person. Items lead with care red when someone is waiting (a ride with no driver), sun for queues; urgent items sort first so a list limit can never hide them.
- **Activity:** a day-grouped timeline, icons on one hairline, time of day on the right.
- **Filters and tabs:** filters are pills with the electric selected state (`brand-50`, `brand-700` text, `brand-200` inner edge). Tabs inside a panel are underlined in `brand-600`. A module's page tabs (CareRide) are a segmented bar (2.0): a `slate-200/60` track with the current page a raised white pill and an electric icon. On narrow screens a scrolling strip fades at its right edge.
- **Sidebar (2.1, `SidebarNav`, the route rail):** white. The logo is `LogoMark` in its brand tones with the ink wordmark, as in the landing header. The context card is white with a hairline and `--shadow-rest`; partner organizations show an electric tile, volunteers cantaloupe, admins midnight. The main links are stations on one route: a 2px `brand-300` line through a column of small white rings (`brand-300`, electric on hover), measured from the stations so it holds at any text size. The current page is a midnight pill with white type and a `brand-300` icon (the landing workspace picture's own current item), and the relay point, the logo's cantaloupe centre on a white ring, rests on its station. Moving to another page sends the relay point along the route (360ms, `ease-out-expo`; it lands without travelling on first load, and jumps under reduced motion). Group labels and the footer links line up with the link text, past the stations. Links are `slate-600`, `slate-100` on hover; sign out turns red on hover. The icon rail (tablets, or collapsed) drops the route and keeps the midnight tile; live counts become a dot. The volunteer tab bar marks its current tab with the same midnight pill.
- **Page header meta:** context such as the date or a reference sits under the h1, never above it.
- **Service modules** (`src/workspace/modules.ts`, `components/workspace/ServiceModuleCard.tsx`): Relay Collective is the platform; modules sit on it. One registry describes every module (`active` or `planned`). Active modules get an electric-tint icon tile, an emerald "Active" badge and one midnight "Open …" pill whose arrow steps forward on hover. On the overviews (2.1) the active module leads as a white card holding the landing's one electric field (`RouteField`, 14px corners, a faint white dot grid) beside its words, with its own trip drawn on it: a white road that draws once, a midnight pickup ring and a cantaloupe drop-off on a white ring (`aria-hidden`). On phones the field becomes a short banner above the words. The words, the emerald badge and the midnight "Open …" pill stay on white, with its numbers beneath. The volunteer overview uses the same field beside the CareRide name, over the driver's numbers. Planned modules are dashed, quieter, labelled "Planned" in words, and have no link, button or hover. Only active modules appear in navigation. The org overview leads its "Your modules" section with CareRide (its ride numbers as a bare `MetricGroup` along the card's foot), with two planned modules beside it.
- **CareRide** (the transportation module): mark `CareRideMark` (`modules/careride/brand.tsx`), one trip drawn like a ride card's route: an open midnight pickup ring, an electric road that steps up, a cantaloupe drop-off. It draws in `currentColor` in navigation. CareRide branding lives only inside the module (its header, tabs, nav entry and cards); the Relay Collective logo stays on every shell. Inside the module, `CareRideLayout` shows the module header (mark, name, "Transportation coordination", Active) and underlined tabs: Overview, Requests, New ride, Destinations, History.

## 7. Imagery and iconography

- **Icons:** one set only (e.g. Lucide), 2px stroke, rounded caps. Pair with text.
- **Illustration:** product pictures (real labels, illustrative data, captioned as illustrative) and flat electric and cantaloupe discs. No stock photos of people in distress.
- **Photography (if used):** drivers and everyday journeys, not clients. Never identifiable clients, in line with our no-client-data rule.
- **Logo:** see below. No partner logos in the header. Naming The Salvation Army as pilot partner in text is approved; their marks are not.

### Logo (1.6)

The mark: two hooks that close one loop between them, with the handoff points left open, and the person they come together around at the centre. Electric hook, midnight hook, cantaloupe centre. Built on a 48-unit grid with 8-unit round strokes; it holds from 16px up.

- **In the app:** `LogoMark` (`src/components/brand/LogoMark.tsx`, tones `brand`, `ink`, `white`) and `Logo` (mark plus the Space Grotesk wordmark). Never import an image of the mark.
- **Files** (`public/brand/`): `relay-collective-logo.svg` (horizontal, light backgrounds), `-logo-black.svg`, `-logo-white.svg`, `-logo-compact.svg` (stacked), `relay-collective-mark.svg` with `-black` and `-white`, and `relay-collective-app-icon.svg` (white and midnight on an electric tile). The wordmark in these files is outlined, so they need no font.
- **Icons:** `public/favicon.svg` and `favicon.png` (electric tile), `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (`site.webmanifest`), and the Android launcher icons and splash, generated from `resources/icon.png` and `resources/splash.png` with `npx capacitor-assets generate --android`.
- **Rules:** keep clear space of half the mark's width; never recolour the hooks individually outside the three tones; never add a gradient, shadow or outline; on electric, use the app icon's white and midnight.

## 8. Voice and tone

Plain, kind, and brief. Speak to staff and drivers as capable colleagues.

| Instead of | Say |
| --- | --- |
| "Beneficiary transportation request submitted" | "Ride booked. We're finding a driver." |
| "Error 422: validation failed" | "Add a pickup time to continue." |
| "Needs attention" | "No driver available. Ask drivers again, change the time, or send on transit." |
| "Clients in need" | "Clients" |

- Use "client" or "passenger", as the app does on main. Never "case", "subject", or "the homeless".
- Use active verbs on buttons: "Book ride", "Accept", "Decline".
- Calm under pressure: unfilled rides are urgent, not alarming. State the problem, then the next step.
- No jargon, no exclamation marks, no religious language. Relay Collective serves any organization.

## 9. Accessibility checklist

- [ ] All text meets 4.5:1 contrast (3:1 for large text and UI)
- [ ] Status never conveyed by colour alone
- [ ] Full keyboard operation and visible focus
- [ ] Touch targets 48px+
- [ ] Respects `prefers-reduced-motion` (already in `index.css`)
- [ ] Works at 200% zoom and with large system text
- [ ] Screen-reader labels on icon-only buttons
- [ ] Plain-language copy, reading level around grade 6–8

## 10. Implementation notes

All tokens live in `src/index.css` under `@theme`. 1.6 redefined the existing token names (`ink`, `brand-*`, `canvas`, `coral-*`, `slate-100/200`, `rc-*`) rather than renaming them, so every screen moved to the new system without its components changing. The old per-area remaps (`.workspace`, `.rc-brand`) are gone: there is one palette. The class names stay as hooks.

The public site keeps its own `rcl-` classes for motion and layout, and uses the palette by name (`midnight`, `electric`, `cantaloupe`, `porcelain`).

Motion in the consoles is quick and quiet: hover transitions, the dialog and drawer entrances, and the status ring. The public hero plays one ride once. Everything respects reduced motion.

Console 2.0 adds two moments, both off under reduced motion: each page settles into the sheet as you arrive (`.rc-page`, 320ms, from 40% opacity and 6px, fill `backwards` so nothing lingers), and the CareRide route draws itself once on the overview (`.rc-route-draw`, 0.85s, then the drop-off pops in). `.workspace` themes the browser's own surfaces: electric text selection, an electric-ink caret, and thin palette scrollbars (dark on night).

Console motion tokens (`index.css`): `ease-out-quart` for hovers and presses (150ms; presses scale to 0.97), `ease-out-expo` for things that move into place. The sidebar collapses over 220ms. Every `<dialog>` carries `rc-dialog` (rises 8px and fades in over 240ms, fades out on close, backdrop midnight at 40%); the phone drawer carries `rc-drawer` (slides from the left). Both use `@starting-style` and `allow-discrete`, so the native top layer still owns focus and Escape.

**Delight rules (v0.3).** Delight has to carry information, or it doesn't ship.

- **The road shows progress.** On a `RideCard` the pickup dot fills once a driver confirms, a small dot travels the road while the client is in the car, and the whole route turns green on arrival. The next-pickup panel shows the same stages as four stops (`RideProgress`, `rideStage`).
- **Status changes are seen and heard.** A badge that changes on screen settles in with a soft brand ring, and a polite live region reads the new status. Nothing animates on first load.
- **Confetti on every drop-off.** Milestones (a driver's 1st, 5th, 10th, 25th and every 50th ride) also get their own title, such as "That's 10 rides. Thank you!".
- **Impact in words.** Drivers see how many people they've helped, beside their numbers.
- **A buzz for new requests.** The Android app gives a short vibration when a new request reaches a driver. Not on first load, and never on the web.
- **No names for now.** Messages don't add a driver's or client's name, since the data may not match what is happening on the ground.
- All of it respects reduced motion (see the global rule in `src/index.css`).

## 11. Open questions

1. Should each partner organization be able to apply a light theme (accent colour and logo) later?
2. The `/demo` pitch deck is built for presenting on a large screen and overflows on phones. Does it need a phone layout?
3. Settled in 1.6: the body face (DM Sans), the logo palette (electric, midnight, cantaloupe), and motion (calm in the consoles).

## 12. Slop audit (v0.2, kept for history)

Checked against the `frontend-design-deslop` checklist on 2026-10-03.

- **Artifact:** a mobile-first operations app for partner staff and drivers, plus a public landing page.
- **Positioning:** utilitarian and caring, not corporate. **Adjectives:** warm, humble, practical, dependable.
- **Aesthetic:** sturdy, plain, kind. Flat canvas, white cards with edges, one blue, navy for weight.
- **Type:** Nunito display, Inter body (kept, see §4). **Palette:** brand blue dominant, navy, with care red and sun yellow as seasoning.
- **Signature move:** the road rule (§5).

| Area | Before | After |
| --- | --- | --- |
| Colour | Blue-to-violet gradient buttons, gradient text on the hero and the dashboard greeting, rainbow top bar, violet partner role | Solid fills only; violet removed; gradient kept for the logo wordmark |
| Background | Three radial glows on the body, blurred blobs behind the hero, dashboard and cards | Flat canvas |
| Visual detail | Border plus diffuse shadow on cards, 16 to 40px radii, frosted sticky bars, coloured left edge on ride cards | Border only, 12px max, solid bars, top rule instead of side stripe |
| Type and structure | Pill above the hero headline, all-caps kicker above every section, icon tiles above every card heading, sparkle icons | Headings stand alone, icons inline with headings, demo accounts listed with dividers instead of cards within a card |
| Focus | Pale 4px `brand-100` ring, hard to see | 3px `brand-500` ring with offset |

Still open: Inter as the body face (kept by choice) and motion (left alone by choice).

## Changelog

- **v2.1 (2026-11-04, Relay Collective 1.8):** The route rail replaces the night frame, so the consoles share the landing page's light world. The sidebar, phone drawer and volunteer tab bar are white with hairline edges. The sidebar's links are stations on one electric route, the current page is a midnight pill (as in the landing's workspace picture), and the cantaloupe relay point travels to it as you move. The landing's hairline grid sits behind the top of every page, and the header is clear over it until the page scrolls. The CareRide night card becomes a white card with the landing's electric field carrying its route. Removed: the `night` tokens, `focusRingNight`, `inverseButton`, `AppIconMark` in the sidebar, and the sheet's turned corner.
- **v2.0 (2026-11-04, Relay Collective 1.8):** Console 2.0. Same palette, type and logo; a bolder frame. The sidebar, phone drawer and volunteer tab bar move to night (`#0b1117`), and the workspace becomes a porcelain sheet set into the frame with one 28px turned corner. The current page is a white pill. Greetings are 40px with the time of day in Instrument Serif ("Good *morning*."). Cards and panels move to 16px with a resting shadow (`--shadow-rest`); dialogs 20px; primary pills get `--shadow-press`. The overview's active module becomes a night card with the CareRide route drawn across it, drawing once; the volunteer overview gets the same band. CareRide's tabs become a segmented pill bar. Metric numbers grow to 44px. Pages settle in on arrival. Selection, caret and scrollbars are themed. Rules changed: the 12px card cap, "in-page cards get no shadow", and "sidebars are solid white" (see §5).
- **v1.2.1 (2026-11-03):** The landing intro and the modules section become one section: one statement ("Every nonprofit rebuilds the same tools. Let’s build them once.") with one note beside it, set bottom-aligned to the headline, then the foundation and module cards. The two back-to-back headline-and-note blocks are gone. The landing names CareRide everywhere it shows transportation.
- **v1.2 (2026-11-03):** Modular platform. Transportation becomes CareRide, the first active module, with its own mark and module header. Volunteer coordination, Resource sharing and Cross-organization collaboration are planned. The workspace sidebar groups Workspace (Overview, Organization, Team) and Your modules (CareRide, All modules). The org overview gains "Your modules" and an organization facts line. The requests list and history are CareRide tabs, at their existing addresses. The volunteer and admin consoles name CareRide where they show transportation. The landing modules heading reads "One connected platform. Multiple ways to make an impact."
- **v1.1 (2026-11-02):** The signed-in consoles are refined, with no change to the palette, type or logo. One console header (`ShellHeader`, 56px, breadcrumb) replaces three. The sidebar collapse is animated, and sign out and collapse share the footer row. Workspace navigation groups Transportation and All services under Services. Overviews open with what needs attention, then a hairline metric strip (`MetricGroup`), a day-grouped activity timeline, and a compact services list. The org home shows the next pickup when there is one. Rides with no driver lead the admin attention list in care red. All dialogs share one entrance and exit, and the drawer slides in. Filters use the electric selected state. Page meta moves under the title. The volunteer tab bar marks the current tab with a pill as well as colour. Placeholder dashes and "Not recorded" move from slate-400 to slate-500 for contrast. The account menu button reaches 44px.
- **v1.0.6 (2026-11-01):** Relay Loop re-laid. Stations and workspace now sit in a grid, so nothing overlaps at any width, and the track is measured from that grid with logo-proportioned corners. Bottom stations share one stacked rhythm. The planned station is renamed "Resource sharing". Phones get the same loop in place of the old stacked hook layout. The relay lap is driven by position, so stations light wherever they sit, and it starts once the picture is in view.
- **v1.0.5 (2026-11-01):** The hero becomes the Relay Loop. The logo's two hooks, at 12x, form one track (with a white road lane) around the workspace, which now has a slim icon rail. Each part of the platform is a station on the track: Volunteers in the open handoff, and the planned module on the bottom-left gap, drawn as sleepers. A cantaloupe relay point runs one lap on load, lighting each station, and Community impact's check fills in when it arrives. Pointer parallax by layer (flat translation). The measured connectors are gone.
- **v1.0.4 (2026-11-01):** Landing copy and weighting move from transportation to shared infrastructure. The intro states the thesis ("Every nonprofit rebuilds the same tools. Let's build them once."). The capabilities grid leads with the shared foundation on the midnight surface, and Transportation becomes the first module card. The showcase workspace spans modules: people and roles instead of a single ride, and a planned module marked in the sidebar. The steps, impact points, closing CTA and nav ("Modules") follow. Same visual system throughout.
- **v1.0.3 (2026-11-01):** Hero headline is always two lines ("Technology that" / "brings us together."), sized to its column. Ecosystem given more room: a centred workspace, wider-set upper cards, aligned chips, a slimmer hook. Signature CTAs become pills with a round arrow chamber and a hover handoff.
- **v1.0.2 (2026-11-01):** Hero ecosystem refined: a larger workspace framed by the logo's electric hook; cards in three tiers that link to their sections and light up their part of the workspace on hover or focus; thin cased electric connectors with a one-time relay point; a three-line editorial headline from xl. The hero goes two-column from 1280px.
- **v1.0.1 (2026-11-01):** The landing hero shows the Connected Ecosystem instead of a single ride: a workspace overview with organizations, volunteers, transportation, community services (labelled planned) and community impact joined to it. New signature CTA pair for the hero (see §6).
- **v1.0 (2026-10-31, Relay Collective 1.6):** One light-first system across the whole product. New logo (the loop mark) and brand files, favicon, web manifest and Android icons. DM Sans and Space Grotesk replace Inter, Nunito and Plus Jakarta Sans everywhere. Tokens redefined in place; midnight primary buttons; electric for selection and active navigation; cantaloupe for volunteer identity; emerald only for success; admin identity midnight. Sign-in brand panel rebuilt light. Sentence-case labels. What's New badge and dialog redesigned. Fixes: tables no longer widen the page (absolutely placed screen-reader labels escaped their scroll frame), and the availability editor's week grid responds to its own width.

- **v0.5 (2026-10-31):** The public landing page turns light-first. Porcelain `#F8F9F7` ground, white surfaces with `#E5E9EC` hairlines, midnight ink `#111820` for type and primary buttons; electric blue `#0297DE` and cantaloupe `#FC734D` are graphic colours (large fields, discs, dots, the route line). Text in those hues uses darker shades that pass AA: `electric-ink` `#0272A8` and `cantaloupe-ink` `#B8441F` for small text, `cantaloupe-display` `#E85A30` (3.35:1) for the one serif accent word in headings; secondary text is `midnight-soft` `#3A4553`, meta text `hush` `#64748B`. The ring artwork is gone: the hero is a product picture that plays one ride (request, driver confirmed, completed) along a drawn route, once, then rests; reduced motion shows the final state. No kicker labels above headings. Every product picture is captioned as illustrative, and planned services stay visibly planned.
- **v0.4 (2026-10-31):** The public landing page gets its own identity, scoped to `components/landing` and the `rcl-` classes and `midnight` / `electric` / `cantaloupe` tokens in `index.css`. Midnight `#02070A`, electric blue `#0297DE` and cantaloupe `#FC734D`, with porcelain light sections; small cantaloupe and electric text on porcelain uses the darker `-ink` shades to pass AA. Space Grotesk for display, DM Sans for text, and Instrument Serif italic for one or two accent words per heading, loaded only by the landing page. The hero mark is a ribbon of thin strands (SVG, drawn in CSS). Sections on this page may use larger radii, a soft glow behind the hero and showcase, and a slight tilt on the product picture; the signed-in app, sign-in and onboarding keep the rules above unchanged. Metrics on the page are words, not numbers, and the workspace picture is labelled as illustrative.
- **v0.3 (2026-10-04):** Delight that carries information: the route fills in as the ride goes, a progress road on the next-pickup panel, status changes announced, milestone titles on the drop-off thank-you, a driver impact line, and a buzz for new requests on Android.
- **v0.2.1 (2026-10-04):** Status badges get icons. Ride cards lose the coloured top bar: the route is drawn as a short blue road, and only rides that need action get a red note strip. Decorative bars removed from landing audience cards and the hero preview.
- **v0.2 (2026-10-03):** Applied the draft to the code. Added the canvas and OKLCH accent tokens, the road rule signature, and the role tone table. Removed gradients, glows, blur and violet across the app.
- **v0.1:** First draft for team review.
