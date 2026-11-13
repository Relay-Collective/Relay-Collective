import { Bell, BellOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { primaryButton, secondaryButton } from '../../../components/ui'
import { panel } from '../../../components/workspace/styles'
import { useApp } from '../../../hooks/useApp'
import { isNative } from '../../../native/platform'
import { useInstalled } from '../../../pwa/useInstall'
import { installPath, mobilePlatform, registerWorker, supportsPush } from '../../../pwa/browser'
import { isDemoBackend } from '../../../services'
import type { PushPreferences } from './model'
import { hasDevice, loadPreferences, registerDevice, removeAllDevices, removeDevice, savePreferences, VAPID_PUBLIC_KEY } from './service'

function currentPermission(): NotificationPermission {
  return supportsPush() ? Notification.permission : 'default'
}

function decodeKey(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

export function PushSettings() {
  const { currentUser } = useApp()
  const installed = useInstalled()
  const iosNeedsInstall = mobilePlatform() === 'ios' && !installed && !isNative
  const configured = !isDemoBackend && !!VAPID_PUBLIC_KEY
  const supported = supportsPush()
  const [permission, setPermission] = useState(currentPermission)
  const [prefs, setPrefs] = useState<PushPreferences>()
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const showsOffers = currentUser?.role === 'DRIVER' || currentUser?.role === 'ORG_ADMIN'

  useEffect(() => {
    if (!configured || !supported) return
    let active = true
    async function load() {
      try {
        const [worker, saved] = await Promise.all([registerWorker(), loadPreferences()])
        const existing = await worker.pushManager.getSubscription()
        const registered = existing ? await hasDevice(existing) : false
        if (active) {
          setRegistration(worker)
          setPrefs(saved)
          setPermission(currentPermission())
          setEnabled(registered && currentPermission() === 'granted')
        }
      } catch {
        if (active) setError('Device settings couldn’t load. Refresh the page to try again.')
      }
    }
    void load()
    window.addEventListener('focus', load)
    return () => {
      active = false
      window.removeEventListener('focus', load)
    }
  }, [configured, supported, currentUser?.id])

  async function act(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setStatus('')
    try { await action() } catch {
      setError('Couldn’t save device settings. Check your connection and try again.')
    } finally { setBusy(false) }
  }

  async function enable() {
    if (!registration || !VAPID_PUBLIC_KEY) return
    // Safari requires the permission request directly from a user gesture.
    const granted = await Notification.requestPermission()
    setPermission(granted)
    if (granted !== 'granted') {
      setStatus(granted === 'denied' ? 'Device alerts are blocked.' : 'Device alerts are still off.')
      return
    }
    let subscription = await registration.pushManager.getSubscription()
    const applicationServerKey = decodeKey(VAPID_PUBLIC_KEY)
    const previousKey = subscription?.options.applicationServerKey
    const sameKey = previousKey && previousKey.byteLength === applicationServerKey.length &&
      new Uint8Array(previousKey).every((value, index) => value === applicationServerKey[index])
    if (subscription && previousKey && !sameKey) {
      await removeDevice(subscription)
      await subscription.unsubscribe()
      subscription = null
    }
    const newSubscription = !subscription
    subscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
    try {
      await registerDevice(subscription)
    } catch (error) {
      if (newSubscription) await subscription.unsubscribe().catch(() => {})
      throw error
    }
    setEnabled(true)
    setStatus('Device alerts are on.')
  }

  async function disable(all: boolean) {
    const subscription = await registration?.pushManager.getSubscription()
    if (all) await removeAllDevices()
    else if (subscription) await removeDevice(subscription)
    await subscription?.unsubscribe()
    setEnabled(false)
    setStatus(all ? 'Alerts are off on all devices.' : 'Alerts are off on this device.')
  }

  return (
    <section className={`${panel} space-y-4 p-5`} aria-labelledby="device-alerts-title">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-rc-mint p-2.5 text-rc-teal-ink"><Bell className="size-5" aria-hidden /></span>
        <div>
          <h2 id="device-alerts-title" className="font-heading text-lg font-bold text-rc-navy">Device alerts</h2>
          <p className="mt-1 text-sm text-slate-600">Hear about CareRide when Relay is closed. Lock screen alerts leave out ride and passenger details.</p>
        </div>
      </div>
      {iosNeedsInstall ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">On iPhone or iPad, install Relay and open it from your Home Screen first.</p>
          <Link className={`${secondaryButton} max-w-full whitespace-normal text-center`} to={installPath('ios')}>Install on iPhone or iPad</Link>
        </div>
      ) : isDemoBackend ? (
        <p className="text-sm text-slate-700">The demo inbox works here. Device alerts are available on the connected site.</p>
      ) : !supported ? (
        <p className="text-sm text-slate-700">Device alerts aren’t available here. Use the Relay web app on a supported browser. You can always use this inbox.</p>
      ) : !configured ? (
        <p className="text-sm text-slate-700">Device alerts haven’t been set up yet. Your inbox is available.</p>
      ) : (
        <>
          {permission === 'denied' && <p className="text-sm text-slate-700">Allow Relay notifications in your browser or device settings, then return here.</p>}
          {(prefs || registration) && (
            <div className="flex flex-wrap gap-2">
              {enabled ? (
                <button type="button" className={secondaryButton} disabled={busy} onClick={() => void act(() => disable(false))}>
                  <BellOff className="size-4" aria-hidden /> Turn off on this device
                </button>
              ) : (
                <button type="button" className={primaryButton} disabled={busy || !registration || permission === 'denied'} onClick={() => void act(enable)}>
                  Allow device alerts
                </button>
              )}
              <button type="button" className={secondaryButton} disabled={busy} onClick={() => void act(() => disable(true))}>Turn off on all devices</button>
            </div>
          )}
          {prefs && (
            <fieldset className="border-t border-slate-100 pt-2" disabled={busy}>
              <legend className="pr-2 text-sm font-semibold text-rc-navy">Send device alerts for</legend>
              {([...(showsOffers ? [['offers', 'New ride requests']] : []), ['updates', 'Ride updates']] as [keyof PushPreferences, string][]).map(([key, label]) => (
                <label key={key} className="flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-700">
                  <input type="checkbox" className="size-5 accent-brand-700" checked={prefs[key]} onChange={(event) => {
                    const next = { ...prefs, [key]: event.target.checked }
                    void act(async () => { await savePreferences(next); setPrefs(next) })
                  }} />
                  {label}
                </label>
              ))}
              <p className="text-xs text-slate-600">These choices apply to all your devices. Your inbox still shows every update.</p>
            </fieldset>
          )}
          {!prefs && !error && <p role="status" className="text-sm text-slate-600">Checking device settings…</p>}
          {status && <p role="status" className="text-sm text-slate-700">{status}</p>}
          {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
        </>
      )}
    </section>
  )
}
