import { getSupabase } from './supabaseClient'

// Unsubscribe locally before dropping the authenticated session. Even offline, this
// browser should stop accepting alerts for the account that just signed out.
export async function unlinkPushOnSignOut() {
  if (!('serviceWorker' in navigator)) return
  try {
    const registration = await navigator.serviceWorker.getRegistration('/')
    const subscription = await registration?.pushManager?.getSubscription()
    if (!subscription) return
    // Start the authenticated cleanup before sign-out; don't wait on a slow network.
    const remote = Promise.resolve(getSupabase().rpc('careride_remove_push', { p_endpoint: subscription.endpoint }))
    await Promise.race([
      Promise.allSettled([subscription.unsubscribe(), remote]),
      new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    ])
  } catch { /* A browser restriction must not block sign-out. */ }
}
