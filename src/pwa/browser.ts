import { isNative } from '../native/platform'

export type MobilePlatform = 'ios' | 'android'
interface InstallEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' } | undefined>
  userChoice?: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function mobilePlatform(): MobilePlatform | undefined {
  if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/i.test(navigator.userAgent)) return 'android'
}

export const installPath = (platform: MobilePlatform) => `/install/${platform}`
export const preferredInstallPath = () => installPath(mobilePlatform() ?? 'ios')

const displayMode = window.matchMedia('(display-mode: standalone)')
let installed = false
let installEvent: InstallEvent | undefined
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((listener) => listener())

export function isInstalled() {
  return installed || displayMode.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function watchInstall(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const canInstallDirectly = () => !!installEvent && !isInstalled()

export async function promptInstall() {
  const event = installEvent
  if (!event) return false
  installEvent = undefined
  changed()
  try {
    const result = (await event.prompt()) ?? (await event.userChoice)
    if (result?.outcome === 'accepted') {
      installed = true
      changed()
      return true
    }
  } catch { /* The manual instructions remain available. */ }
  return false
}

if (!isNative && window.top === window) {
  displayMode.addEventListener?.('change', changed)
  window.addEventListener('storage', (event) => {
    if (event.key?.startsWith('relay:install-after-first-ride:')) changed()
  })
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installEvent = event as InstallEvent
    changed()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    installEvent = undefined
    changed()
  })
}

let registration: Promise<ServiceWorkerRegistration> | undefined

export function canRegisterWorker() {
  return !isNative && window.top === window && window.isSecureContext && 'serviceWorker' in navigator
}

export function registerWorker(): Promise<ServiceWorkerRegistration> {
  registration ??= navigator.serviceWorker.register('/relay-sw.js', { scope: '/', updateViaCache: 'none' })
    .then(() => navigator.serviceWorker.ready)
    .catch((error: unknown) => {
      registration = undefined
      throw error
    })
  return registration
}

export function supportsPush() {
  return canRegisterWorker() && 'Notification' in window && 'PushManager' in window && (mobilePlatform() !== 'ios' || isInstalled())
}

function firstRideInstallKey(userId: string) {
  return `relay:install-after-first-ride:${userId}`
}

// Keep the offer on the next screen (and after a reload) until the driver chooses.
let firstRide: { userId: string; state: 'pending' | 'done' } | undefined

export function firstRideInstallState(userId: string) {
  try {
    const state = localStorage.getItem(firstRideInstallKey(userId))
    if (state) return state
  } catch { /* Storage may be disabled. */ }
  return firstRide?.userId === userId ? firstRide.state : null
}

function setFirstRide(userId: string, state: 'pending' | 'done') {
  firstRide = { userId, state }
  try { localStorage.setItem(firstRideInstallKey(userId), state) } catch { /* The current tab still works. */ }
  changed()
}

export function suggestInstallAfterAcceptance(userId: string) {
  if (!isNative && window.top === window && mobilePlatform() && !isInstalled() && !firstRideInstallState(userId)) {
    setFirstRide(userId, 'pending')
  }
}

export function dismissFirstRideInstall(userId: string) {
  setFirstRide(userId, 'done')
}
