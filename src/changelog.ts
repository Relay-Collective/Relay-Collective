// What's new in Relay Collective, newest first. The first entry is the version the badge shows,
// so add a new entry at the top whenever a release goes out.

export interface Release {
  version: string
  date: string // YYYY-MM-DD
  title?: string // a headline for a major release, shown at the top of What's New
  summary?: string
  changes: string[]
}

export const RELEASES: Release[] = [
  {
    version: '1.7',
    date: '2026-11-03',
    title: 'Relay Collective 1.7',
    summary: 'One connected platform, built from modules.',
    changes: [
      'Relay Collective is now organized into modules that all share your organization, team and access. Transportation is the first, and it is called CareRide.',
      'Your overview has a new Your modules section. CareRide shows how your rides are going, with one button to open it. Volunteer coordination and Resource sharing are shown as planned. They can’t be used yet.',
      'The sidebar now has two groups. Workspace holds Overview, Organization and Team. Your modules holds CareRide and All modules. The count of rides that need attention now shows beside CareRide.',
      'CareRide has its own header and tabs: Overview, Requests, New ride, Destinations and History. Requests and History are now inside CareRide. Old links and bookmarks still open the same pages.',
      'The organization name at the top of every page now takes you back to your overview.',
      'Your overview also shows your organization, your pickup location and your role at a glance, and Quick actions has a link to your team.',
      'Volunteer drivers will see CareRide in their sidebar and on their overview. Rides, requests and availability work the same as before.',
      'Nothing about how rides are booked, matched, accepted or cancelled has changed.',
    ],
  },
  {
    version: '1.6',
    date: '2026-10-31',
    title: 'Introducing Relay Collective 1.6',
    summary: 'A new experience, built around you.',
    changes: [
      'Relay Collective has a new logo: two parts that close one loop, with the person they come together around at its centre. It is on every screen, the browser tab and the Android app icon.',
      'A new light look across the whole platform, with one set of colours and type everywhere: the public site, sign in and sign up, onboarding, organization and volunteer workspaces, and the admin console.',
      'The public site leads with one ride from request to drop-off, so it is clear what Relay Collective does before you scroll.',
      'Sign in and sign up have a new brand panel that shows a ride the way staff see it.',
      'Colours mean the same thing everywhere: green is done or approved, red needs attention, and electric blue marks what is selected.',
      'Buttons, forms, navigation and status labels share one style, with clearer focus outlines for keyboard users.',
      'What’s New has a new look, and the version chip is smaller on phones so it covers less of the page.',
    ],
  },
  {
    version: '1.5',
    date: '2026-10-29',
    changes: [
      'Joining an organization no longer needs an invitation link: search for your organization, ask to join, and follow your request until an administrator decides. Invitation links still work too.',
      'Organizations have a new Team page under Organization, with Members, Join Requests and Invitations. New requests show as a count beside Team.',
      'Organization members now have a role: administrators manage the team, staff use the organization’s services. Everyone who could manage the team before is an administrator, and anyone invited joins as staff.',
      'Administrators approve or decline requests and pick each new member’s role, change roles, and remove people. Removing someone ends their access but keeps their sign-in and your ride history. An organization always keeps at least one administrator.',
      'Choose whether people can find your organization in search, and what search says about it, under Organization profile > Organization Visibility. Organizations start as invitation only.',
    ],
  },
  {
    version: '1.4',
    date: '2026-10-28',
    changes: [
      'Send feedback from anywhere in the app: report a bug, ask for a feature, suggest an improvement, or tell us what you think. Choose Send feedback at the bottom of the sidebar or in your account menu.',
      'You can add one screenshot to your feedback (PNG, JPEG or WebP, up to 5 MB). Only you and the Relay Collective team can see it.',
      'My feedback lists everything you’ve sent, where each piece stands, and any replies from the Relay Collective team. Anything with news is marked Updated.',
      'Each update in What’s New now has a “Give feedback on this update” link.',
      'Admins have a new Feedback page under Operations: search and filter every submission, set its status, priority and owner, reply to the person who sent it, and keep internal notes only admins can see. Every status change is recorded.',
    ],
  },
  {
    version: '1.3',
    date: '2026-10-25',
    changes: [
      'A new Relay Collective look: a new logo, and a public site that shows transportation as the first of several services, with the others marked as planned.',
      'Signing up now creates a personal account first. From there you can register an organization, join one by invitation, or sign up as a volunteer driver.',
      'Organizations apply in five steps, and your progress is saved on this device until you submit. You can check where your application stands at any time.',
      'Organization staff can invite teammates from Organization > Team. Each invitation works once, for one email address, for 7 days.',
      'Partner organizations have a new workspace with an overview, every request in one searchable list, and an organization profile. Transportation lives inside it.',
      'Drivers have a new volunteer workspace with their trips, rides, availability, profile and verification status. On phones it has a tab bar along the bottom.',
      'Driver impact now counts completed rides and passengers carried, in place of the bus-fare estimate.',
      'Changing your password now asks for your current one first.',
      'When a staff member closes their account, their organization’s rides are only cancelled if they were its last active member.',
      'Admins have a new console covering organizations, users, approvals, transportation, issues and activity, with search. Approval decisions are confirmed first and can’t overwrite another admin’s decision.',
    ],
  },
  {
    version: '1.2',
    date: '2026-10-21',
    changes: [
      'CareRide is now Relay Collective. Same free rides, same drivers, and your account and rides carry over unchanged.',
      'A new name for what the platform has become: staff, community organizations and volunteer drivers getting people there together.',
    ],
  },
  {
    version: '1.1',
    date: '2026-10-18',
    changes: [
      'Staff can give a finished ride a thumbs up or down, with an optional note. Only Relay Collective sees it, not the driver.',
      'Drivers can flag an issue on a past ride. Only Relay Collective sees it, not the front desk.',
      'Each ride has a change history showing who booked, changed, accepted, picked up, dropped off or cancelled it, and when.',
      'Admins see each account’s feedback and its recent rides’ history in the account details.',
    ],
  },
  {
    version: '1.0',
    date: '2026-10-04',
    changes: [
      'Drivers add a mobile number with their account, and no longer pick taxi, rideshare or volunteer.',
      'Professional drivers can finish sign-up without uploading identity papers.',
      'Bookings need a real, picked address, and bus slips can list transfers.',
      'Scheduled rides say whether the driver is early or late.',
      'Live hospital wait times show while booking a ride.',
      'Requests show the route before a driver accepts.',
      'Rides with no driver get a printable transit slip.',
      'Completed trips count the $2.58 Vancouver bus fare saved.',
    ],
  },
]

export const CURRENT_VERSION = RELEASES[0].version
