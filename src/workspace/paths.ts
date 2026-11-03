import { careRidePaths } from '../modules/careride/paths'

// Every address in a partner organization's workspace, in one place: the shared platform's pages,
// plus each active module's. CareRide owns its own addresses (modules/careride/paths.ts).
const ROOT = '/workspace'

export const paths = {
  overview: ROOT,
  services: `${ROOT}/services`,
  organization: `${ROOT}/organization`,
  team: `${ROOT}/team`,
  teamTab: (tab: 'members' | 'requests' | 'invitations') => `${ROOT}/team?tab=${tab}`,
  help: `${ROOT}/help`,
  feedback: `${ROOT}/feedback`,
  feedbackItem: (id: string) => `${ROOT}/feedback/${encodeURIComponent(id)}`,
  ...careRidePaths,
} as const
