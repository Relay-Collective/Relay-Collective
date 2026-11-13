import { ArrowLeft, Download, Ellipsis, Share, Smartphone, SquarePlus } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ghostButton, primaryButton, secondaryButton } from '../components/ui'
import { PageHeader } from '../components/workspace/PageHeader'
import { panel } from '../components/workspace/styles'
import { useApp } from '../hooks/useApp'
import { isNative } from '../native/platform'
import { dismissFirstRideInstall, firstRideInstallState, installPath, preferredInstallPath, promptInstall, watchInstall } from './browser'
import { useCanInstall, useInstalled } from './useInstall'

export function InstallGuide() {
  const { platform } = useParams()
  const { identity } = useApp()
  const installed = useInstalled()
  const direct = useCanInstall()
  const [trying, setTrying] = useState(false)
  if (platform !== 'ios' && platform !== 'android') return <Navigate to={preferredInstallPath()} replace />
  const ios = platform === 'ios'

  return (
    <main className="mx-auto min-h-dvh max-w-2xl pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] pb-[calc(2rem+var(--safe-bottom))] pt-[calc(1rem+var(--safe-top))] sm:px-8">
      <Link to={identity ? '/home' : '/'} className={ghostButton}><ArrowLeft className="size-4" aria-hidden /> Back to Relay</Link>
      <div className="my-5 flex size-16 items-center justify-center overflow-hidden rounded-2xl shadow-[var(--shadow-rest)]">
        <img src="/apple-touch-icon.png" alt="" width="64" height="64" />
      </div>
      <PageHeader title="Install Relay Collective" description="Open your workspace from your Home Screen. Keep CareRide close when you’re on the move." />
      <nav aria-label="Installation platform" className="my-6 grid grid-cols-2 gap-2">
        {(['ios', 'android'] as const).map((target) => (
          <Link key={target} to={installPath(target)} aria-current={platform === target ? 'page' : undefined} className={`${platform === target ? primaryButton : secondaryButton} px-3`}>
            {target === 'ios' ? 'iPhone / iPad' : 'Android'}
          </Link>
        ))}
      </nav>
      <section className={`${panel} space-y-5 p-5 sm:p-7`} aria-label={ios ? 'Safari installation steps' : 'Chrome installation steps'}>
        <h2 className="font-heading text-xl font-bold text-rc-navy">{ios ? 'Add Relay from Safari' : 'Install Relay from Chrome'}</h2>
        {installed && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm font-semibold text-rc-navy">Relay Collective is installed.</p>}
        {!ios && direct && !installed && (
          <button type="button" className={`${primaryButton} max-w-full whitespace-normal text-center`} disabled={trying} onClick={() => {
            setTrying(true)
            void promptInstall().finally(() => setTrying(false))
          }}>
            <Download className="size-4 shrink-0" aria-hidden /> Install Relay Collective
          </button>
        )}
        <ol className="space-y-4">
          {(ios ? [
            [Smartphone, 'Open Relay Collective in Safari.'],
            [Share, 'Tap Share. Depending on your Safari layout, tap More first.'],
            [SquarePlus, 'Choose Add to Home Screen. Turn on Open as Web App if shown, then tap Add.'],
          ] : [
            [Smartphone, 'Open Relay Collective in Chrome.'],
            [Ellipsis, 'Tap More (⋮) beside the address bar.'],
            [SquarePlus, 'Choose Install app or Install and create shortcut → Install. Some versions say Add to Home screen. Follow the on-screen steps.'],
          ] as const).map(([StepIcon, label], index) => {
            return (
              <li key={index} className="flex items-start gap-3 text-sm text-slate-700 sm:text-base">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-rc-mint text-rc-teal-ink"><StepIcon className="size-4" aria-hidden /></span>
                <span className="pt-1">{index + 1}. {label}</span>
              </li>
            )
          })}
        </ol>
        <p className="border-t border-slate-100 pt-4 text-sm text-slate-600">
          Open Relay from your Home Screen and sign in. For CareRide device alerts, open Notifications and choose Allow device alerts.
          {ios && ' Home Screen web push requires iOS or iPadOS 16.4 or later.'}
        </p>
      </section>
    </main>
  )
}

export function FirstRideInstall() {
  const { currentUser } = useApp()
  const id = currentUser?.id ?? ''
  const state = useSyncExternalStore(watchInstall, () => firstRideInstallState(id))
  const installed = useInstalled()
  const direct = useCanInstall()
  if (currentUser?.role !== 'DRIVER' || isNative || installed || state !== 'pending') return null

  return (
    <section aria-label="Install Relay after accepting a ride" className={`${panel} no-print mb-5 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between`}>
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-rc-mint p-2.5 text-rc-teal-ink"><Smartphone className="size-5" aria-hidden /></span>
        <div>
          <h2 className="font-heading font-bold text-rc-navy">Keep CareRide one tap away</h2>
          <p className="mt-0.5 text-sm text-slate-600">Add Relay to your Home Screen to get back to your rides quickly.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        {direct ? (
          <button type="button" className={primaryButton} onClick={() => void promptInstall().then((accepted) => accepted && dismissFirstRideInstall(id))}>Install Relay</button>
        ) : (
          <Link to={preferredInstallPath()} className={primaryButton} onClick={() => dismissFirstRideInstall(id)}>Show me how</Link>
        )}
        <button type="button" className={ghostButton} onClick={() => dismissFirstRideInstall(id)}>Maybe later</button>
      </div>
    </section>
  )
}
