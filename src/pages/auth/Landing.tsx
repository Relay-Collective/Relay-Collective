import { Navigate } from 'react-router-dom'
import { NAV } from '../../components/landing/content'
import { useActiveSection } from '../../components/landing/hooks'
import { LandingNavbar } from '../../components/landing/LandingNavbar'
import { HowItWorks } from '../../components/landing/sections/HowItWorks'
import { ImpactSection } from '../../components/landing/sections/ImpactSection'
import { LandingCTA } from '../../components/landing/sections/LandingCTA'
import { LandingFooter } from '../../components/landing/sections/LandingFooter'
import { LandingHero } from '../../components/landing/sections/LandingHero'
import { PlatformCapabilities } from '../../components/landing/sections/PlatformCapabilities'
import { ProductShowcase } from '../../components/landing/sections/ProductShowcase'
import { useApp } from '../../hooks/useApp'
import { HOME_FOR } from '../../logic/homeFor'

const SECTION_IDS = NAV.map((n) => n.id)

// The public website: what Relay Collective is building, and the way into the app.
// Signed-in people skip it and land on their dashboard.
export function Landing() {
  const { ready, currentUser } = useApp()

  // Wait until we know who's signed in, so someone returning to their dashboard never sees a flash of this page
  if (!ready) return null
  if (currentUser) return <Navigate to={HOME_FOR[currentUser.role]} replace />

  return <PublicSite />
}

function PublicSite() {
  const active = useActiveSection(SECTION_IDS)
  return (
    <div className="rcl-page overflow-x-clip bg-porcelain font-dm text-midnight antialiased">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-midnight px-5 py-3 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <LandingNavbar active={active} />
      <main id="main">
        <LandingHero />
        <PlatformCapabilities />
        <ProductShowcase />
        <HowItWorks />
        <ImpactSection />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  )
}
