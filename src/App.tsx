import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAuth, RequireRole } from './components/RequireAuth'
import { VersionBadge } from './components/VersionBadge'
import { useApp } from './hooks/useApp'
import { HOME_FOR } from './logic/homeFor'
import { NativeBridge } from './native/NativeBridge'
import { isNative } from './native/platform'
import { Landing } from './pages/auth/Landing'
import { SignIn } from './pages/auth/SignIn'
const Accounts = lazy(() => import('./pages/admin/Accounts').then((m) => ({ default: m.Accounts })))
const Approvals = lazy(() => import('./pages/admin/Approvals').then((m) => ({ default: m.Approvals })))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword })))
const Register = lazy(() => import('./pages/auth/register/Register').then((m) => ({ default: m.Register })))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword').then((m) => ({ default: m.ResetPassword })))
const Demo = lazy(() => import('./pages/demo/Demo').then((m) => ({ default: m.Demo })))
const DriverHome = lazy(() => import('./pages/driver/DriverHome').then((m) => ({ default: m.DriverHome })))
const Settings = lazy(() => import('./pages/driver/Settings').then((m) => ({ default: m.Settings })))
const Bookings = lazy(() => import('./pages/org/Bookings').then((m) => ({ default: m.Bookings })))
const Destinations = lazy(() => import('./pages/org/Destinations').then((m) => ({ default: m.Destinations })))
const Drivers = lazy(() => import('./pages/org/Drivers').then((m) => ({ default: m.Drivers })))
const OrgHome = lazy(() => import('./pages/org/OrgHome').then((m) => ({ default: m.OrgHome })))
const Dashboard = lazy(() => import('./pages/partner/Dashboard').then((m) => ({ default: m.Dashboard })))
const RequestRide = lazy(() => import('./pages/partner/RequestRide').then((m) => ({ default: m.RequestRide })))
const RideDetail = lazy(() => import('./pages/partner/RideDetail').then((m) => ({ default: m.RideDetail })))

// "/home" always lands on the right main page for whoever is signed in.
function RoleHome() {
  const { currentUser } = useApp()
  return <Navigate to={currentUser ? HOME_FOR[currentUser.role] : '/signin'} replace />
}

// The website keeps the marketing page at "/". The app skips it: signed-in people
// go to their role home, everyone else to sign-in. Native RequireAuth also uses
// /signin so unsigned users are not bounced back to "/" and into a redirect loop.
function NativeEntry() {
  const { ready, currentUser } = useApp()
  if (!ready) return null
  return <Navigate to={currentUser ? '/home' : '/signin'} replace />
}

export default function App() {
  // The demo is a full-screen walkthrough, so the badge stays out of it.
  const { pathname } = useLocation()

  return (
    <>
      <NativeBridge />
      {pathname !== '/demo' && <VersionBadge />}
      <Suspense fallback={<div className="min-h-screen" role="status" aria-label="Loading" />}>
      <Routes>
        <Route path="/" element={isNative ? <NativeEntry /> : <Landing />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/demo" element={<Demo />} />

        <Route element={<RequireAuth />}>
          <Route path="/home" element={<RoleHome />} />
          <Route element={<Layout />}>
            <Route element={<RequireRole roles={['PLATFORM_ADMIN']} />}>
              <Route path="/admin" element={<Approvals />} />
              <Route path="/admin/accounts" element={<Accounts />} />
            </Route>
            {/* Transport providers: hidden from sign-up for now, but existing ones still work */}
            <Route element={<RequireRole roles={['ORG_ADMIN']} />}>
              <Route path="/org" element={<OrgHome />} />
              <Route path="/org/drivers" element={<Drivers />} />
              <Route path="/org/bookings" element={<Bookings />} />
            </Route>
            <Route element={<RequireRole roles={['PARTNER']} />}>
              <Route path="/partner" element={<Dashboard />} />
              <Route path="/partner/request" element={<RequestRide />} />
              <Route path="/partner/ride/:id" element={<RideDetail />} />
              <Route path="/partner/destinations" element={<Destinations />} />
              <Route path="/partner/drivers" element={<Navigate to="/partner" replace />} />
              <Route path="/partner/bookings" element={<Navigate to="/partner" replace />} />
            </Route>
            <Route element={<RequireRole roles={['DRIVER']} />}>
              <Route path="/driver" element={<DriverHome />} />
              <Route path="/driver/my-rides" element={<Navigate to="/driver" replace />} />
              <Route path="/driver/settings" element={<Settings />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </>
  )
}
