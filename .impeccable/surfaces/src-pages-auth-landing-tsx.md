---
version: 1
slug: "src-pages-auth-landing-tsx"
primary_target: "src/pages/auth/Landing.tsx"
related_targets: ["src/components/landing"]
---

# Public landing page

Mode: Persuade. Audience: nonprofit leaders deciding whether their organization should join; also staff and volunteer drivers looking for the way in. Action: Get Started (/register) or Log in (/signin). Proof on hand: the working transportation workflow, the pilot with The Salvation Army – Belkin Communities of Hope, open source. No numbers, testimonials or photography.

Scope: `src/pages/auth/Landing.tsx` and `src/components/landing/*`, plus the landing-only `rcl-` CSS and landing tokens in `src/index.css`. The signed-in app is out of scope.

## Direction contract

seed: none (direction pinned by the user's brief, 2026-10-31)

THESIS: The page proves shared infrastructure by showing it. The hero is the Relay Loop: the logo's two hooks scaled into one track around a Relay Collective workspace, with each part of the platform (organizations, volunteers, transportation, community services, community impact) as a station on it, so transportation reads as one module, not the product. It refuses the nonprofit stock-photo hero and the abstract-shape SaaS hero.

OWN-WORLD: Porcelain #F8F9F7 ground, white working surfaces with 1px #E5E9EC edges, midnight ink #111820 type and buttons. One large electric-blue field and a small cantaloupe disc sit behind the product. Space Grotesk display, DM Sans text, one Instrument Serif italic word per heading in cantaloupe-ink. A single blue route line threads through every section.

STORY: First you see what it is, then the idea and the capabilities with honest status labels, then a workspace for every role (tabs for Organizations, Volunteer drivers and Platform admins, each a faithful drawing of that role's current overview with three notes), then one CareRide ride relayed from hand to hand on a midnight band (book → a driver says yes → both sides see it move → dropped off), three steps to join, why it matters, and the close. The drawn workspaces track the real consoles: when the console changes, redraw `ConsoleMock` and retake the README screenshots.

FIRST VIEWPORT: A two-line headline at every width ("Technology that" / "brings us together."), sized from its column with container units so neither line wraps. Then the signature CTA pair (60px pills with a round arrow chamber and a hover handoff), stacked full width on phones. Beside it from xl (below it on smaller screens), the Relay Loop. Cards and workspace sit in a grid, so nothing overlaps. The track is measured from that grid and drawn behind it: the logo's electric and midnight hooks with a white road lane, corners a third of the shorter side, through the middle of the top row and of Community impact. Top track: Organizations (inset, so the electric corner shows) and Volunteers (over the open handoff). Inside: the workspace with a slim icon rail. Bottom track from md: Resource sharing (planned, on the open corner drawn as sleepers), Community impact, Transportation, all stacked cards with one rhythm (icon row with status, title, text). Phones: the same loop, with Transportation and Resource sharing inside it and Community impact on the bottom track. Cards are links to their capability sections; hovering or focusing one lights the matching rail icon, metric and activity row. Honest status: "Drivers today", "Planned".

SIGNATURE: The headline rises line by line, "together." last with a slight settle. The CTA arrows hand off on hover. The track draws (electric, then midnight), the workspace settles inside it, the stations land (all in by about 1.8s). Then, once the picture is half on screen, the relay point, the logo's cantaloupe centre, runs one lap: each station lifts and lights electric as it passes under, it crosses the open handoff at Volunteers, and it arrives at Community impact, whose check fills solid emerald and stays. Everything rests by about 5s. With a mouse, layers drift by depth (track behind, stations in front) as flat translation, so text stays crisp. Reduced motion shows the final state with no relay point and no drift.

GROUND (2026-11-01, user brief): behind the hero, a living network mesh (`HeroMesh.tsx`, Canvas 2D). A hairline midnight grid unrolls from the middle of the Relay Loop as the hero loads, runs up under the header (clear at the top of the page), and fades out into the next section; from xl it steps back behind the headline. The grid never moves: a soft electric light glides after the mouse and picks out the hairlines near it, resting once the pointer has been still for about a second so nothing glows behind copy being read; a tap or click sends a ring of light outward, and a few cantaloupe relay points (the logo's centre on a porcelain ring) hop node to node, lighting each node they hand off at. This is the one ambient loop on the page; it pauses offscreen and in hidden tabs. Reduced motion draws the finished mesh, still. It is a literal mesh, not a gradient: no glows, blobs or colour fields.

RISK: Five stations around a dashboard could read as a network diagram. Mitigation: the track is the logo, not a set of connectors, so the stations read as one loop with one story; a dominant workspace; three tiers of card weight; and real hover links between each station and the workspace.
