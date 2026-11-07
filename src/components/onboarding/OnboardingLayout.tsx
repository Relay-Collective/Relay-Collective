import { LifeBuoy, LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../hooks/useApp'
import { Logo } from '../Logo'
import { focusRing } from '../auth/styles'
import { CompactProgress, OnboardingStepper, type StepItem } from './OnboardingStepper'

interface Props {
  progress?: { steps: StepItem[]; current: number; furthest: number; onSelect: (index: number) => void; disabled?: boolean }
  sidebarIntro?: ReactNode // shown in the sidebar when there are no steps
  help?: ReactNode // a short note in the sidebar about the current step
  children: ReactNode
}

// A dedicated full page for onboarding: progress and context on the left, one focused step on the right.
export function OnboardingLayout({ progress, sidebarIntro, help, children }: Props) {
  return (
    <div className="rc-brand min-h-screen bg-white pt-[var(--safe-top)] pb-[var(--safe-bottom)] lg:grid lg:grid-cols-[minmax(300px,360px)_1fr]">
      <aside className="hidden border-r border-rc-line bg-rc-canvas lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-8 lg:py-8">
        <Logo size="sm" />
        <div className="mt-12 flex-1 overflow-y-auto pr-1">
          {progress ? (
            <nav aria-label="Onboarding progress">
              <OnboardingStepper {...progress} />
            </nav>
          ) : (
            sidebarIntro
          )}
        </div>
        {help && (
          <div className="mt-6 rounded-xl border border-rc-line bg-white p-4 text-sm text-slate-600">
            <p className="mb-1 flex items-center gap-2 font-semibold text-rc-navy">
              <LifeBuoy className="h-4 w-4 text-brand-600" aria-hidden /> Good to know
            </p>
            {help}
          </div>
        )}
        <AccountFooter className="mt-6 border-t border-rc-line pt-5" />
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="border-b border-rc-line px-5 py-4 sm:px-8 lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <Logo size="sm" />
            <SignOutButton />
          </div>
          {progress && (
            <div className="mt-4">
              <CompactProgress steps={progress.steps} current={progress.current} />
            </div>
          )}
        </header>
        <main className="flex flex-1 justify-center px-5 py-10 sm:px-8 lg:py-16">
          <div className="w-full max-w-[640px]">{children}</div>
        </main>
      </div>
    </div>
  )
}

function AccountFooter({ className = '' }: { className?: string }) {
  const { identity } = useApp()
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <p className="min-w-0 text-sm">
        <span className="block text-slate-500">Signed in as</span>
        <span className="block truncate font-semibold text-rc-navy">{identity?.email}</span>
      </p>
      <SignOutButton />
    </div>
  )
}

function SignOutButton() {
  const { signOut } = useApp()
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => void signOut().finally(() => navigate('/signin', { replace: true }))}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-rc-navy ${focusRing}`}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      Sign out
    </button>
  )
}
