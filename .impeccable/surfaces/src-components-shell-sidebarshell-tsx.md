---
version: 1
slug: "src-components-shell-sidebarshell-tsx"
primary_target: "src/components/shell/SidebarShell.tsx"
related_targets: ["src/components/shell","src/components/workspace/ServiceModuleCard.tsx","src/components/volunteer/VolunteerShell.tsx"]
---

# Signed-in consoles (frame)

Mode: Operate. Audience: partner staff, volunteer drivers, org admins and Relay Collective admins, mid-task, often on a phone. Task: get to the page they need and see what needs them. Scope: the console frame shared by the organization, volunteer and admin workspaces (`SidebarShell`, `SidebarNav`, `ShellHeader`, the phone drawer and volunteer tab bar) and the module band on the overviews. Page content keeps its components.

## Direction contract

seed: none (direction pinned by the user's brief, 2026-11-04: "match the landing's light theme of blue, orange and a bit of black"; user chose "Route rail")

THESIS: The console is the landing page's world at work: porcelain and white, midnight ink, one electric route, one cantaloupe relay point. It refuses the dark admin sidebar and the generic grey SaaS rail.

OWN-WORLD: White sidebar with a hairline edge beside a porcelain sheet. Real logo mark and ink wordmark as on the landing header. A still hairline midnight grid behind the top of each page, fading out, as under the landing hero. The overview module band is a white card holding one electric field with the trip drawn in white road, midnight pickup ring and cantaloupe drop-off.

STORY: Know whose space this is, see where you are, move. The page's own work leads.

FIRST VIEWPORT: Sidebar: logo and wordmark, context card, then navigation strung on one thin electric route line; every link is a station (small ring on the line), the current page a midnight pill with white type and a brand-300 icon (as in the landing's workspace picture), and a cantaloupe relay point on its station. Header: porcelain, transparent over the grid at the top, solid with a hairline once the page scrolls.

FORM: Route rail (option 1 of 3, user-chosen). SIGNATURE: when you move between pages, the relay point travels along the route to the new station (320ms, ease-out-expo); reduced motion jumps. Collapsed rail and tablets: no line, the current page is the midnight tile.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
