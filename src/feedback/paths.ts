import { adminPaths } from '../admin/paths'
import type { UserRole } from '../types'
import { volunteerPaths } from '../volunteer/paths'
import { paths } from '../workspace/paths'

// Where someone's own feedback lives, in the workspace they use. Admins manage everyone's in the console.
const ORG_FEEDBACK = '/org/feedback'

export function myFeedbackPaths(role: UserRole): { list: string; item: (id: string) => string } {
  switch (role) {
    case 'PARTNER':
      return { list: paths.feedback, item: paths.feedbackItem }
    case 'DRIVER':
    case 'VOLUNTEER':
      return { list: volunteerPaths.feedback, item: volunteerPaths.feedbackItem }
    case 'ORG_ADMIN':
      return { list: ORG_FEEDBACK, item: (id) => `${ORG_FEEDBACK}/${encodeURIComponent(id)}` }
    case 'PLATFORM_ADMIN':
      return { list: adminPaths.feedback, item: adminPaths.feedbackItem }
  }
}
