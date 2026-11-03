// CareRide's transportation rules and wording that other parts of Relay Collective rely on: the
// workspace overview and sidebar, the volunteer workspace, the admin console and the shell notices.
// Pure functions only (no React, no data service), so logic modules and tests can import it freely.
// See index.ts for the rest of the module's public interface.

export { acceptedMessage } from './logic/acceptedMessage'
export { describePickup, parseLocalInput, quickPicks } from './logic/pickupTime'
export {
  ACTIVITY_TEXT,
  actionItems,
  COMPLETED_WINDOW_DAYS,
  recentActivity,
  requestMetrics,
  requestReference,
  type ActionItem,
  type ActivityItem,
  type ActivityKind,
} from './logic/requestSummary'
export { isDriverLate } from './logic/rideAlerts'
export { byPickup, finishedAt, isFinished, needsAction } from './logic/rideInsights'
export { driverRideStatusLabel, passengersLabel, rideBadgeLabel, riderLabel, SENT_ON_TRANSIT_LABEL } from './logic/rideText'
