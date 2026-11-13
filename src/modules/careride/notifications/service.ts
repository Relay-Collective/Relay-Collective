import { getSupabase } from '../../../services/supabaseClient'
import { DEFAULT_PREFERENCES, type PushPreferences } from './model'

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY?.trim()

async function rpc(name: string, args?: Record<string, unknown>) {
  const { error, data } = await getSupabase().rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}

export async function loadPreferences(): Promise<PushPreferences> {
  const { data, error } = await getSupabase().from('careride_notification_preferences').select('offers,updates').maybeSingle<PushPreferences>()
  if (error) throw new Error('Device preferences couldn’t load.')
  return data ?? DEFAULT_PREFERENCES
}

export async function savePreferences(prefs: PushPreferences) {
  await rpc('careride_save_notification_preferences', { p_offers: prefs.offers, p_updates: prefs.updates })
}

export async function hasDevice(subscription: PushSubscription) {
  return (await rpc('careride_has_push', { p_endpoint: subscription.endpoint })) === true
}

export async function registerDevice(subscription: PushSubscription) {
  const { endpoint, keys } = subscription.toJSON()
  await rpc('careride_register_push', { p_endpoint: endpoint, p_p256dh: keys?.p256dh, p_auth: keys?.auth })
}

export async function removeDevice(subscription: PushSubscription) {
  await rpc('careride_remove_push', { p_endpoint: subscription.endpoint })
}

export async function removeAllDevices() {
  await rpc('careride_remove_push', { p_endpoint: null })
}
