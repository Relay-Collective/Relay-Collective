import type { ReactNode } from 'react'
import { BuildStamp } from '../../native/BuildStamp'
import { Logo } from '../Logo'
import { BrandPanel } from './BrandPanel'

interface Props {
  // The brand side's message. Without it the page is a single centred column (e.g. "check your email").
  brand?: { title: string; body: string }
  aside?: ReactNode // top-right link, e.g. "New here? Create an account"
  children: ReactNode
}

// The frame for every signed-out screen: brand on the left (wide screens), one focused form on the right.
export function AuthLayout({ brand, aside, children }: Props) {
  return (
    <div className="rc-brand min-h-screen bg-white pt-[var(--safe-top)] pb-[var(--safe-bottom)] lg:grid lg:grid-cols-[minmax(0,6fr)_minmax(0,7fr)]">
      {brand && (
        <aside className="hidden lg:sticky lg:top-0 lg:block lg:h-screen">
          <BrandPanel title={brand.title} body={brand.body} />
        </aside>
      )}

      <div className={`flex min-h-screen flex-col ${brand ? '' : 'lg:col-span-2'}`}>
        <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
          {/* The brand panel carries the logo on wide screens */}
          <div className={brand ? 'lg:invisible' : ''}>
            <Logo size="sm" />
          </div>
          {aside && <div className="text-sm text-slate-600">{aside}</div>}
        </header>

        <main className="flex flex-1 items-center justify-center px-5 pb-12 pt-2 sm:px-8">
          <div className="w-full max-w-[440px] animate-fade-up">{children}</div>
        </main>

        <footer className="px-5 pb-6 text-center text-xs text-slate-500 sm:px-8">
          <p>Relay Collective is an independent platform for nonprofit organizations.</p>
          <BuildStamp className="mt-1" />
        </footer>
      </div>
    </div>
  )
}
