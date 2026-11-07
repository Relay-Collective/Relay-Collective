# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Responsive web app, also shipped as an Android app through Capacitor (`android/`, `capacitor.config.ts`). The Android build wraps the website and updates over the air, so its design language is the web's, not Material.

## Users

Every role is a primary user. Design work does not rank one above another; each surface serves the role that uses it.

- **Partner organization staff:** front-line nonprofit workers who book rides to appointments and services for the clients they support. Often mid-task, often on a phone.
- **Volunteer drivers:** verified drivers who receive ride offers, accept or decline them, and take the client from pickup to drop-off.
- **Org admins (driver providers):** run an organization that supplies drivers. They manage their drivers, bookings and destinations.
- **Relay Collective admins:** approve organizations and drivers, oversee rides, handle issues and feedback.
- **Nonprofit leaders evaluating the platform:** the audience of the public website, deciding whether their organization should join.

## Product Purpose

Relay Collective is shared digital infrastructure for nonprofits. It connects nonprofit organizations, volunteers and community resources so they can coordinate services, work across organizations and reach the people who need support.

Transportation is the first module and a working MVP: staff request a ride, a verified driver accepts it, and the ride stays in view until drop-off. Getting there is often the first barrier between a person and help that already exists. Success means a client gets to the appointment that matters, and staff spend less time on calls and follow-ups.

## Positioning

**Shared infrastructure.** One open-source foundation (organization management, role-based access, requests, coordination workflows, communication, visibility) shared by many nonprofits, with service modules on top. Transportation is first. Volunteers, Resources and Collaboration are planned to build on the same base. A single-purpose ride or volunteer app cannot truthfully claim this.

## Operating Context

- Began at FaithTech HACKVAN 2026, built with The Salvation Army – Belkin Communities of Hope in Vancouver, BC. That program is the pilot partner.
- Ride lifecycle: searching → offered → accepted → picked up → completed, plus needs attention, no-show and cancelled / sent on transit (`RideStatus` in `src/types/index.ts`).
- Every organization and driver is reviewed before their first ride.
- A public pitch walkthrough at `/demo` shows the real transportation screens step by step.
- Deployed on Cloudflare Workers, with Supabase as the backend.

## Capabilities and Constraints

- **Live:** transportation (booking, offers, live status, oversight); organization management with invitations and role-based access; volunteer driver sign-up.
- **Partial:** volunteer coordination (drivers today, more roles planned).
- **Planned, not product:** resource sharing and cross-organization services. Always label these as planned.
- **Client data:** the person riding needs no account, phone or money. Ask only for what the driver needs (an optional first name), and never present a client as a "case".
- **Terminology:** "client" or "passenger", never "case", "subject" or "the homeless". "Partner organization", "driver", "org admin".
- Secular and open to any organization: no religious language, even though the project began at a faith-based hackathon.

## Brand Commitments

- Name: Relay Collective. Tagline: "Stronger communities. Built together." Logo: the heart-road mark (`src/assets/logo-mark.svg`).
- Voice: plain, kind and brief. Speak to staff and drivers as capable colleagues. Active verbs, no jargon, no exclamation marks. Calm under pressure: state the problem, then the next step.
- An independent platform. The Salvation Army is the pilot partner, not the owner. Written approval covers naming them as pilot partner. Their logo, shield, wordmark, typefaces and taglines are not cleared, and nothing may imply official endorsement.
- Public copy states what exists today as fact and labels everything else as planned (rule recorded in `src/components/landing/content.ts`).

## Evidence on Hand

- Pilot partnership with The Salvation Army – Belkin Communities of Hope (approved for naming).
- Working transportation MVP, with web and Android builds.
- Open source under the MIT license on GitHub.
- Team: Noah Hamm, Aditya Padmarajan, Gilbert Fung.
- README imagery in `docs/images/` (banner, home, mobile, platform diagram).
- **None on hand:** usage numbers, ride counts, testimonials, quotes, case studies, press, or legal or charitable status. Do not invent them.

## Product Principles

1. **Shared before bespoke.** Every module builds on the common foundation, and each new module starts from what the others already proved.
2. **Dignity first.** Collect and show only what the job needs. The client is a person, never a case.
3. **Nothing goes quiet.** An unfilled or stuck request is surfaced right away, with a next step, never left silent.
4. **Honest about what's real.** Working today is stated as fact. Everything else is labelled planned.
5. **Built with the front line.** Decisions are grounded in what partner staff and drivers actually do.

## Accessibility & Inclusion

WCAG 2.2 AA minimum. Must work outdoors, on old phones, with large system text and at 200% zoom. Status is never shown by colour alone. Touch targets are 48px or larger. Respect reduced motion. Plain-language copy, around a grade 6–8 reading level.
