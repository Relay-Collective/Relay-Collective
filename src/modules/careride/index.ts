// CareRide's public interface: what the rest of Relay Collective may use from the module.
// Anything not exported here (or from domain.ts, paths.ts or brand.tsx) is internal to CareRide.
//
//   index.ts   screens and ride presentation (React). For the app's routes and other workspaces.
//   domain.ts  pure transportation rules and text. Safe to import from logic and tests.
//   paths.ts   CareRide's public URLs. Folded into workspace/paths.ts.
//   brand.tsx  the CareRide mark. Imported directly by the module registry and the navigation files,
//              which must not import this file (it pulls in every CareRide screen).
//
// Files inside the module import each other directly, never through this file.

// The module's frame and screens, mounted by App.tsx under the existing /workspace routes
export { CareRideLayout } from './components/CareRideLayout'
export { Dashboard } from './pages/Dashboard'
export { Destinations } from './pages/Destinations'
export { RequestRide } from './pages/RequestRide'
export { Requests } from './pages/Requests'
export { RideDetail } from './pages/RideDetail'

// Ride presentation the workspace overview, volunteer and admin screens, and the legacy provider pages reuse
export { NextPickup } from './components/dashboard/NextPickup'
export { RideCard } from './components/RideCard'
export { RideHistory } from './components/RideHistory'
export { StatusBadge } from './components/StatusBadge'
