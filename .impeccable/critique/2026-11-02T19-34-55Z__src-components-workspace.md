---
target: signed-in workspaces
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/adip/Desktop/Relay-Collective/src/components/workspace"
timestamp: 2026-11-02T19-34-55Z
slug: src-components-workspace
---
Method: dual-agent (A: design review · B: detector + browser)

Target: signed-in consoles (org workspace, platform admin, volunteer) after the 2026-11-02 workspace redesign pass.

Design specificity: disciplined and on-system (palette, type, 12px radius, edge-only cards, focus ring), but the overview shape is a familiar SaaS template shared across all three roles; the road-rule signature lives only on the transportation home.

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of system status | 3 | Org home lacked today's ride (fixed: NextPickup added when one exists) |
| 2 | Match system / real world | 3 | Volunteer vocabulary drifts: Opportunities / Requests / Requests to answer |
| 3 | User control and freedom | 3 | Solid: rail, drawer Escape/backdrop, remembered collapse |
| 4 | Consistency and standards | 2 | Repeated "Request a ride" on Transportation home; label drift |
| 5 | Error prevention | 3 | Destructive actions behind dialogs |
| 6 | Recognition over recall | 3 | Tablet rail relies on title tooltips |
| 7 | Flexibility and efficiency | 2 | No shortcuts; admin search is a separate page below lg |
| 8 | Aesthetic and minimalist | 2 | Quiet days render zeros at full volume; planned modules large on admin |
| 9 | Error recovery | 3 | SectionError with retry |
| 10 | Help and documentation | 3 | Help/feedback everywhere; no contextual admin help |
Total 27/40.

Priority issues
- [P1] Admin "Requires attention" ranked rides with no driver below approvals and could cut them at the limit. FIXED: urgent rides sorted first, care-red chip and count.
- [P1] Partner staff had no single home answering "is today's ride OK?". FIXED on Overview (NextPickup). OPEN: Transportation home still shows Request a ride up to 4 times at 390.
- [P1] Quiet days at full volume: all-zero metric strip under an all-clear line. OPEN.
- [P2] Volunteer vocabulary drift (Opportunities vs Requests). PARTIAL: overview link aligned.
- [P2] Filter rows collide with search at 1440; no scroll cue at 390; panel-head links wrap on phones. FIXED: search on its own row below 2xl, edge fade, panelHead flex basis.

Detector / browser evidence
- CLI: 1 finding, gray-on-color VerificationSummary.tsx:33, false positive (separate map entries on one line).
- In-page (--cdp): low-contrast text-slate-400 placeholders 2.6:1 (FIXED -> slate-500); nested-cards RequestHoursEditor.tsx:111 (open, design call); 2 straggler advisories on availability copy.
- Contrast: RequestHoursEditor preset detail 4.42:1 on brand-50 (FIXED).
- Targets: AccountMenu button 42px tall (FIXED min-h-11).
- No console errors; no horizontal overflow at 390/768/1024/1440 on 9 routes; keyboard focus order and visible rings OK.

Persona red flags: staff on phone — Overview long, activity repeats destination per step; volunteer — no primary verb on Overview, new request below the fold; admin — "No recorded activity" beside pending registrations reads contradictory.

Questions: Should each role's home be built around its one question instead of a shared template? Should the home screen be the road itself (today's rides as routes)?
