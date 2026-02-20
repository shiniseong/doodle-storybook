const TAB_REGISTRY_STORAGE_KEY = '__doodle_storybook_active_tabs__'
const TAB_ID_SESSION_STORAGE_KEY = '__doodle_storybook_tab_id__'
const BROWSER_SESSION_MARKER_KEY = '__doodle_storybook_browser_session__'
const REGISTRY_STALE_THRESHOLD_MS = 1000 * 60 * 60 * 24

let lifecycleInitialized = false

function resolveStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window[kind]
  } catch {
    return null
  }
}

function parseTabRegistry(rawValue: string | null): Record<string, number> {
  if (typeof rawValue !== 'string' || rawValue.length === 0) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }

    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, number] => typeof entry[0] === 'string' && typeof entry[1] === 'number' && Number.isFinite(entry[1]),
    )

    return Object.fromEntries(entries)
  } catch {
    return {}
  }
}

function writeTabRegistry(storage: Storage, registry: Record<string, number>): void {
  storage.setItem(TAB_REGISTRY_STORAGE_KEY, JSON.stringify(registry))
}

function pruneStaleTabs(registry: Record<string, number>, now: number): Record<string, number> {
  return Object.fromEntries(Object.entries(registry).filter(([, lastSeenAt]) => now - lastSeenAt <= REGISTRY_STALE_THRESHOLD_MS))
}

function resolveCurrentTabId(storage: Storage): string {
  const existingTabId = storage.getItem(TAB_ID_SESSION_STORAGE_KEY)
  if (typeof existingTabId === 'string' && existingTabId.length > 0) {
    return existingTabId
  }

  const generatedTabId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`

  storage.setItem(TAB_ID_SESSION_STORAGE_KEY, generatedTabId)
  return generatedTabId
}

function isSupabaseAuthStorageKey(key: string): boolean {
  if (key === 'supabase.auth.token') {
    return true
  }

  return key.startsWith('sb-') && key.includes('-auth-token')
}

function clearSupabaseAuthStorage(localStorage: Storage, sessionStorage: Storage): void {
  const removeAuthEntries = (storage: Storage): void => {
    const keys: string[] = []

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (typeof key !== 'string') {
        continue
      }

      if (isSupabaseAuthStorageKey(key)) {
        keys.push(key)
      }
    }

    for (const key of keys) {
      storage.removeItem(key)
    }
  }

  removeAuthEntries(localStorage)
  removeAuthEntries(sessionStorage)
}

export function ensureAuthStorageLifecycle(): void {
  if (lifecycleInitialized) {
    return
  }

  const localStorage = resolveStorage('localStorage')
  const sessionStorage = resolveStorage('sessionStorage')
  if (!localStorage || !sessionStorage) {
    return
  }

  lifecycleInitialized = true

  const tabId = resolveCurrentTabId(sessionStorage)
  const now = Date.now()
  const hasExistingBrowserSessionMarker = sessionStorage.getItem(BROWSER_SESSION_MARKER_KEY) === '1'

  const registry = pruneStaleTabs(parseTabRegistry(localStorage.getItem(TAB_REGISTRY_STORAGE_KEY)), now)
  const hasOtherActiveTab = Object.keys(registry).some((key) => key !== tabId)

  if (!hasExistingBrowserSessionMarker && !hasOtherActiveTab) {
    clearSupabaseAuthStorage(localStorage, sessionStorage)
  }

  sessionStorage.setItem(BROWSER_SESSION_MARKER_KEY, '1')
  registry[tabId] = now
  writeTabRegistry(localStorage, registry)

  const unregisterCurrentTab = () => {
    const nextRegistry = parseTabRegistry(localStorage.getItem(TAB_REGISTRY_STORAGE_KEY))
    delete nextRegistry[tabId]
    writeTabRegistry(localStorage, nextRegistry)
  }

  window.addEventListener('beforeunload', unregisterCurrentTab)
  window.addEventListener('pagehide', unregisterCurrentTab)
}

export function clearAllBrowserStorage(): void {
  const localStorage = resolveStorage('localStorage')
  const sessionStorage = resolveStorage('sessionStorage')

  localStorage?.clear()
  sessionStorage?.clear()
}
