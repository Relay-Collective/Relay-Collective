import { ArrowRight, CheckCircle2, ClipboardCheck, Mail, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusScreen } from '../../../components/auth/StatusScreen'
import { OnboardingLayout } from '../../../components/onboarding/OnboardingLayout'
import { primaryButton, secondaryButton } from '../../../components/ui'
import { onboardingPaths } from '../../../onboarding/routing'
import { paths } from '../../../workspace/paths'

const NEXT = [
  { icon: ClipboardCheck, text: 'The Relay Collective team reviews your application.' },
  { icon: Mail, text: 'If we need anything else, we’ll write to the contact email you gave.' },
  { icon: MapPin, text: 'Meanwhile, you can add the places your clients often go. Ride requests open once you’re approved.' },
]

export function Submitted({ orgName, contactEmail }: { orgName: string; contactEmail: string }) {
  return (
    <OnboardingLayout
      sidebarIntro={
        <p className="text-sm leading-relaxed text-slate-600">
          Thank you for bringing <strong className="text-rc-navy">{orgName}</strong> to Relay Collective.
        </p>
      }
    >
      <StatusScreen
        icon={<CheckCircle2 className="h-7 w-7" />}
        tone="teal"
        title="Your application has been submitted."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to={onboardingPaths.application} className={primaryButton}>
              View application status <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <Link to={paths.destinations} className={secondaryButton}>
              Add destinations
            </Link>
          </div>
        }
      >
        <p>
          We've received <strong className="text-rc-navy">{orgName}</strong>'s application. Your organization's access stays limited until our team
          approves it. You can check its status here any time by signing in.
        </p>
        <ol className="mt-6 space-y-3 text-left text-[15px]">
          {NEXT.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rc-canvas text-rc-navy" aria-hidden>
                <Icon className="h-4 w-4" />
              </span>
              <span className="pt-1 text-slate-700">{text}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-slate-500">Contact email on file: {contactEmail}</p>
      </StatusScreen>
    </OnboardingLayout>
  )
}
