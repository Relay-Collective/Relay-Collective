// Every address in the volunteer workspace, in one place.
// Transportation is the first service a volunteer can take part in, so its pages live under its own prefix.
const ROOT = '/volunteer'
const TRANSPORT = `${ROOT}/transportation`

export const volunteerPaths = {
  overview: ROOT,
  notifications: `${ROOT}/notifications`,
  opportunities: `${ROOT}/opportunities`,
  commitments: `${ROOT}/commitments`,
  transport: TRANSPORT,
  rides: `${TRANSPORT}/rides`,
  ride: (rideId: string) => `${TRANSPORT}/rides/${encodeURIComponent(rideId)}`,
  availability: `${ROOT}/availability`,
  interests: `${ROOT}/interests`, // general volunteers' volunteering interests
  careRideApply: `${ROOT}/careride/apply`, // a general volunteer applies to drive with CareRide (not a driving page)
  profile: `${ROOT}/profile`,
  verification: `${ROOT}/profile/verification`,
  settings: `${ROOT}/settings`,
  help: `${ROOT}/help`,
  feedback: `${ROOT}/feedback`,
  feedbackItem: (id: string) => `${ROOT}/feedback/${encodeURIComponent(id)}`,
} as const
