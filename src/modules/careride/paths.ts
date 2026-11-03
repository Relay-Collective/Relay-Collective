// CareRide's addresses inside the organization workspace. These are public URLs: bookmarks, deep links,
// notification links and the edit/return/again query strings all depend on them, so they never change
// when the module's files move. workspace/paths.ts folds them into the one `paths` object the app uses.
//
// The requests list sits at /workspace/requests, outside the /transportation prefix, because that's where
// it was first published. It still counts as a CareRide page.
const TRANSPORT = '/workspace/transportation'
const REQUESTS = '/workspace/requests'

export const careRidePaths = {
  transport: TRANSPORT,
  requests: REQUESTS,
  newRide: `${TRANSPORT}/new`,
  destinations: `${TRANSPORT}/destinations`,
  ride: (rideId: string) => `${TRANSPORT}/rides/${rideId}`,
  // The booking form also edits a ride, books its return, or starts again from an old one
  editRide: (rideId: string) => `${TRANSPORT}/new?edit=${rideId}`,
  returnRide: (rideId: string) => `${TRANSPORT}/new?returnOf=${rideId}`,
  rideAgain: (rideId: string) => `${TRANSPORT}/new?again=${rideId}`,
} as const

// Every address prefix that belongs to CareRide
export const CARERIDE_PAGES = [TRANSPORT, REQUESTS]

export function inCareRide(pathname: string): boolean {
  return CARERIDE_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

// The ride id on a ride's page, if that's where we are
export function rideIdFromPath(pathname: string): string | undefined {
  const prefix = `${TRANSPORT}/rides/`
  return pathname.startsWith(prefix) ? pathname.slice(prefix.length).split('/')[0] || undefined : undefined
}
