// Illustrative data for the product pictures on the public website. Every organization, person, place and number
// here is made up. The labels (navigation, metrics, statuses) are the ones the app really uses.

export const DEMO_ORG = 'Northside Community Services'
export const DEMO_STAFF = { first: 'Alex', last: 'Lee', initials: 'AL', role: 'Organization admin' }

// Ride status words, exactly as StatusBadge shows them
export type DemoStatus = 'Finding a driver' | 'Driver confirmed' | 'Picked up' | 'Completed'

// The hero workspace's activity feed: one line from each part of the platform that works today
export type DemoArea = 'organizations' | 'volunteers' | 'transport' | 'impact'

export const DEMO_ACTIVITY: { area: DemoArea; text: string; when: string }[] = [
  { area: 'volunteers', text: 'Maya R. joined as a volunteer driver', when: '2h ago' },
  { area: 'transport', text: 'Ride to Downtown Health Clinic confirmed', when: '4h ago' },
  { area: 'organizations', text: 'Eastside Food Bank accepted your invite', when: 'Yesterday' },
]

// The role showcase: a volunteer driver's and a platform admin's view of the same made-up network
export const DEMO_DRIVER = { first: 'Maya', initials: 'MR', detail: 'Volunteer driver' }

export const DEMO_OFFER = { from: `${DEMO_ORG}, Vancouver`, to: "St. Paul's Hospital", when: 'Today, 2:30 PM', answerBy: '1:30 PM' }

export const DEMO_REVIEWS: { kind: string; name: string }[] = [
  { kind: 'Organization registration', name: 'Eastside Food Bank' },
  { kind: 'Driver verification', name: 'Sam T.' },
]

export const DEMO_PLATFORM_ACTIVITY: { text: string; when: string }[] = [
  { text: 'Harbour Youth Services was approved', when: '9:12 AM' },
  { text: 'Dev O. verified as a volunteer driver', when: 'Yesterday' },
]
