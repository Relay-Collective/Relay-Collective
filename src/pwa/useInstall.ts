import { useSyncExternalStore } from 'react'
import { canInstallDirectly, isInstalled, watchInstall } from './browser'

export const useInstalled = () => useSyncExternalStore(watchInstall, isInstalled)
export const useCanInstall = () => useSyncExternalStore(watchInstall, canInstallDirectly)
