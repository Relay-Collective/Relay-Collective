import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RequireAccount, RequireAuth, RequireOrgNotRejected, RequireRole } from './components/RequireAuth'
import { VersionBadge } from './components/VersionBadge'
import { FeedbackProvider } from './context/FeedbackProvider'
import { WorkspaceShell } from './components/workspace/WorkspaceShell'
import { useApp } from './hooks/useApp'
import { useLoadable } from './hooks/useLoadable'
import { HOME_FOR } from './logic/homeFor'
import { homePath, onboardingPaths } from './onboarding/routing'
import { dataService } from './services'
import { WebAppChrome } from './pwa/WebAppChrome'
import { InstallGuide } from './pwa/Install'
import { isInstalled } from './pwa/browser'
import { NativeBridge } from './native/NativeBridge'
import { isNative } from './native/platform'
import { adminPaths } from './admin/paths'
import { AdminShell } from './components/admin/AdminShell'
import { Activity } from './pages/admin/Activity'
import { AdminOverview } from './pages/admin/AdminOverview'
import { AdminSearch } from './pages/admin/AdminSearch'
import { AdminServices } from './pages/admin/AdminServices'
import { AdminSettings } from './pages/admin/AdminSettings'
import { Approvals } from './pages/admin/Approvals'
import { Feedback as AdminFeedback } from './pages/admin/Feedback'
import { FeedbackDetail as AdminFeedbackDetail } from './pages/admin/FeedbackDetail'
import { Issues } from './pages/admin/Issues'
import { OrganizationDetail } from './pages/admin/OrganizationDetail'
import { Organizations } from './pages/admin/Organizations'
import { Review } from './pages/admin/Review'
import { RideOversight } from './pages/admin/RideOversight'
import { Transportation } from './pages/admin/Transportation'
import { UserDetail } from './pages/admin/UserDetail'
import { Users } from './pages/admin/Users'
import { AuthLanding } from './pages/auth/AuthLanding'
import { ForgotPassword } from './pages/auth/ForgotPassword'
import { FullPageLoader } from './pages/auth/FullPageLoader'
import { Landing } from './pages/auth/Landing'
import { ResetPassword } from './pages/auth/ResetPassword'
import { SignedIn, signedInPath } from './pages/auth/SignedIn'
import { SignIn } from './pages/auth/SignIn'
import { SignUp } from './pages/auth/SignUp'
import { GetStarted } from './pages/onboarding/GetStarted'
import { InviteAcceptance } from './pages/onboarding/InviteAcceptance'
import { JoinOrganization } from './pages/onboarding/JoinOrganization'
import { JoinRequestStatus } from './pages/onboarding/JoinRequestStatus'
import { OrganizationOnboarding } from './pages/onboarding/organization/OrganizationOnboarding'
import { PendingApproval } from './pages/onboarding/PendingApproval'
import { ProviderOnboarding } from './pages/onboarding/ProviderOnboarding'
import { VolunteerOnboarding } from './pages/onboarding/VolunteerOnboarding'
import { Demo } from './pages/demo/Demo'
import { MyFeedback } from './pages/feedback/MyFeedback'
import { MyFeedbackDetail } from './pages/feedback/MyFeedbackDetail'
import { Bookings } from './pages/org/Bookings'
import { CareRideLayout, Dashboard, Destinations, Notifications, NotificationsEntry, RequestRide, Requests, RideDetail } from './modules/careride'
import { Drivers } from './pages/org/Drivers'
import { OrgHome } from './pages/org/OrgHome'
import { Help } from './pages/workspace/Help'
import { OrganizationProfile } from './pages/workspace/Organization'
import { Overview } from './pages/workspace/Overview'
import { Services } from './pages/workspace/Services'
import { Team } from './pages/workspace/Team'
import { paths } from './workspace/paths'
import { VolunteerShell } from './components/volunteer/VolunteerShell'
import { Availability } from './pages/volunteer/Availability'
import { CareRideApplication } from './pages/volunteer/CareRideApplication'
import { Commitments } from './pages/volunteer/Commitments'
import { Help as VolunteerHelp } from './pages/volunteer/Help'
import { Interests as VolunteerInterests } from './pages/volunteer/Interests'
import { MyRides } from './pages/volunteer/MyRides'
import { Opportunities } from './pages/volunteer/Opportunities'
import { Overview as VolunteerOverview } from './pages/volunteer/Overview'
import { Profile } from './pages/volunteer/Profile'
import { RideDetail as VolunteerRideDetail } from './pages/volunteer/RideDetail'
import { Settings as VolunteerSettings } from './pages/volunteer/Settings'
import { Transportation as VolunteerTransportation } from './pages/volunteer/Transportation'
import { Verification } from './pages/volunteer/Verification'
import { volunteerPaths } from './volunteer/paths'

// "/home" always lands on the right main page for whoever is signed in, from what the backend says:
// their role, and for organization staff whether the organization is approved yet.
function RoleHome() {
  const { currentUser } = useApp()
  const orgId = currentUser?.role === 'PARTNER' ? (currentUser.orgId ?? '') : ''
  const orgs = useLoadable(() => (orgId ? dataService.listOrganizations() : Promise.resolve([])), orgId)
  if (!currentUser) return <Navigate to="/signin" replace />
  // Couldn't check the organization: fall back to the role's home, where the workspace explains its status
  if (orgId && !orgs.data && !orgs.error) return <FullPageLoader />
  return <Navigate to={orgs.error ? HOME_FOR[currentUser.role] : homePath(currentUser, orgs.data?.find((o) => o.id === orgId))} replace />
}

// The website keeps the marketing page at "/". The app skips it: signed-in people
// go to their role home, everyone else to sign-in. Native RequireAuth also uses
// /signin so unsigned users are not bounced back to "/" and into a redirect loop.
function AppEntry() {
  const { ready, identity } = useApp()
  if (!ready) return <FullPageLoader />
  return <Navigate to={identity ? '/home' : '/signin'} replace />
}

// Partner pages used to live under /partner. Old links and bookmarks still land on the same page.
function MovedTo({ to }: { to: string }) {
  const { search } = useLocation()
  return <Navigate to={`${to}${search}`} replace />
}

function MovedRide() {
  const { id = '' } = useParams()
  return <Navigate to={paths.ride(id)} replace />
}

// Only the two kinds of application have review pages
function ReviewRoute() {
  const { kind } = useParams()
  return kind === 'organizations' || kind === 'drivers' ? <Review /> : <Navigate to={adminPaths.approvals} replace />
}

export default function App() {
  // The demo is a full-screen walkthrough, so the badge stays out of it.
  const { pathname } = useLocation()

  return (
    // Feedback & Suggestions is one dialog for the whole signed-in app, so every page (and What's New) can open it
    <FeedbackProvider>
      <NativeBridge />
      <WebAppChrome />
      <Routes>
        <Route path="/" element={(isNative || isInstalled()) ? <AppEntry /> : <Landing />} />
        <Route path="/launch" element={<AppEntry />} />
        <Route path="/install/:platform" element={<InstallGuide />} />
        <Route path="/install" element={<InstallGuide />} />
        <Route path="/signin" element={<SignIn />} />
        {/* Right after sign-in: says so plainly, then one way into the workspace */}
        <Route path={signedInPath} element={<SignedIn />} />
        <Route path="/register" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/welcome" element={<AuthLanding />} />
        {/* Handles signed-out visitors itself: they sign in or sign up first, then come back here */}
        <Route path="/invite/:token" element={<InviteAcceptance />} />
        <Route path="/demo" element={<Demo />} />

        <Route element={<RequireAuth />}>
          {/* Signed in, no role yet: choose a path. Each path ends in admin review or a checked invitation. */}
          <Route path={onboardingPaths.start} element={<GetStarted />} />
          <Route path={onboardingPaths.organization} element={<OrganizationOnboarding />} />
          <Route path={onboardingPaths.provider} element={<ProviderOnboarding />} />
          <Route path={onboardingPaths.volunteer} element={<VolunteerOnboarding />} />
          <Route path={onboardingPaths.join} element={<JoinOrganization />} />
          {/* Also reached once approved: the backend's answer decides when the workspace opens */}
          <Route path={onboardingPaths.joinStatus} element={<JoinRequestStatus />} />

          <Route element={<RequireAccount />}>
            <Route path="/notifications" element={<NotificationsEntry />} />
            <Route path="/home" element={<RoleHome />} />
            {/* Partner organizations: the organization workspace, with CareRide (transportation) as its first module */}
            <Route element={<RequireRole roles={['PARTNER']} />}>
              <Route path={onboardingPaths.application} element={<PendingApproval />} />
              <Route element={<RequireOrgNotRejected />}>
                <Route element={<WorkspaceShell />}>
                  <Route path={paths.overview} element={<Overview />} />
                  <Route path={paths.services} element={<Services />} />
                  <Route path={paths.organization} element={<OrganizationProfile />} />
                  <Route path={paths.team} element={<Team />} />
                  <Route path={paths.help} element={<Help />} />
                  <Route path={paths.feedback} element={<MyFeedback />} />
                  <Route path={`${paths.feedback}/:id`} element={<MyFeedbackDetail />} />
                  {/* CareRide, the transportation module. Its requests list keeps its old address, so links and bookmarks still work. */}
                  <Route element={<CareRideLayout />}>
                    <Route path={paths.requests} element={<Requests />} />
                    <Route path={paths.transport}>
                      <Route index element={<Dashboard />} />
                      <Route path="new" element={<RequestRide />} />
                      <Route path="rides/:id" element={<RideDetail />} />
                      <Route path="notifications" element={<Notifications />} />
                      <Route path="destinations" element={<Destinations />} />
                    </Route>
                  </Route>
                </Route>
              </Route>
              <Route path="/partner" element={<MovedTo to={paths.transport} />} />
              <Route path="/partner/request" element={<MovedTo to={paths.newRide} />} />
              <Route path="/partner/ride/:id" element={<MovedRide />} />
              <Route path="/partner/destinations" element={<MovedTo to={paths.destinations} />} />
              <Route path="/partner/*" element={<MovedTo to={paths.overview} />} />
            </Route>

            {/* Platform admins: the console for the whole Relay Collective network */}
            <Route element={<RequireRole roles={['PLATFORM_ADMIN']} />}>
              <Route element={<AdminShell />}>
                <Route path={adminPaths.overview} element={<AdminOverview />} />
                <Route path={adminPaths.organizations} element={<Organizations />} />
                <Route path={`${adminPaths.organizations}/:id`} element={<OrganizationDetail />} />
                <Route path={adminPaths.users} element={<Users />} />
                <Route path={`${adminPaths.users}/:id`} element={<UserDetail />} />
                <Route path={adminPaths.approvals} element={<Approvals />} />
                <Route path={`${adminPaths.approvals}/:kind/:id`} element={<ReviewRoute />} />
                <Route path={adminPaths.services} element={<AdminServices />} />
                <Route path={adminPaths.transportation} element={<Transportation />} />
                <Route path={`${adminPaths.transportation}/rides/:id`} element={<RideOversight />} />
                <Route path={adminPaths.activity} element={<Activity />} />
                <Route path={adminPaths.issues} element={<Issues />} />
                <Route path={adminPaths.feedback} element={<AdminFeedback />} />
                <Route path={`${adminPaths.feedback}/:id`} element={<AdminFeedbackDetail />} />
                <Route path={adminPaths.settings} element={<AdminSettings />} />
                <Route path={adminPaths.search} element={<AdminSearch />} />
              </Route>
              <Route path="/admin/accounts" element={<MovedTo to={adminPaths.users} />} />
              <Route path="/admin/*" element={<MovedTo to={adminPaths.overview} />} />
            </Route>

            <Route element={<Layout />}>
              {/* Transport providers: hidden from sign-up for now, but existing ones still work */}
              <Route element={<RequireRole roles={['ORG_ADMIN']} />}>
                <Route path="/org" element={<OrgHome />} />
                <Route path="/org/notifications" element={<Notifications />} />
                <Route path="/org/drivers" element={<Drivers />} />
                <Route path="/org/bookings" element={<Bookings />} />
                <Route path="/org/feedback" element={<MyFeedback />} />
                <Route path="/org/feedback/:id" element={<MyFeedbackDetail />} />
              </Route>
            </Route>

            {/* The volunteer workspace, for everyone who volunteers. It adapts to how each person takes part
                (src/volunteer/workspace.ts). Drivers have CareRide (transportation) in it; general volunteers have no
                driver profile, so CareRide's pages send them back to their home. */}
            <Route element={<RequireRole roles={['DRIVER', 'VOLUNTEER']} />}>
              <Route element={<VolunteerShell />}>
                <Route path={volunteerPaths.overview} element={<VolunteerOverview />} />
                <Route path={volunteerPaths.interests} element={<VolunteerInterests />} />
                {/* A general volunteer applies to drive, on the same account. The page sends anyone already enrolled home. */}
                <Route path={volunteerPaths.careRideApply} element={<CareRideApplication />} />
                <Route path={volunteerPaths.profile} element={<Profile />} />
                <Route path={volunteerPaths.settings} element={<VolunteerSettings />} />
                <Route path={volunteerPaths.help} element={<VolunteerHelp />} />
                <Route path={volunteerPaths.feedback} element={<MyFeedback />} />
                <Route path={`${volunteerPaths.feedback}/:id`} element={<MyFeedbackDetail />} />
                {/* CareRide driving (CARERIDE_PATHS in src/volunteer/navigation.ts) */}
                <Route element={<RequireRole roles={['DRIVER']} />}>
                  <Route path={volunteerPaths.notifications} element={<Notifications />} />
                  <Route path={volunteerPaths.opportunities} element={<Opportunities />} />
                  <Route path={volunteerPaths.commitments} element={<Commitments />} />
                  <Route path={volunteerPaths.transport} element={<VolunteerTransportation />} />
                  <Route path={volunteerPaths.rides} element={<MyRides />} />
                  <Route path={`${volunteerPaths.rides}/:id`} element={<VolunteerRideDetail />} />
                  <Route path={volunteerPaths.availability} element={<Availability />} />
                  <Route path={volunteerPaths.verification} element={<Verification />} />
                </Route>
              </Route>
              {/* Driver pages used to live under /driver. Old links and bookmarks still land on the same page. */}
              <Route element={<RequireRole roles={['DRIVER']} />}>
                <Route path="/driver" element={<MovedTo to={volunteerPaths.transport} />} />
                <Route path="/driver/my-rides" element={<MovedTo to={volunteerPaths.rides} />} />
                <Route path="/driver/settings" element={<MovedTo to={volunteerPaths.availability} />} />
                <Route path="/driver/*" element={<MovedTo to={volunteerPaths.overview} />} />
              </Route>
              <Route path={`${volunteerPaths.overview}/*`} element={<MovedTo to={volunteerPaths.overview} />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {/* After the page in the DOM, so keyboard users reach Skip to content first */}
      {pathname !== '/demo' && !pathname.startsWith('/install') && <VersionBadge />}
    </FeedbackProvider>
  )
}
