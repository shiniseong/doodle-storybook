import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { ensureAuthStorageLifecycle } from '@shared/lib/supabase/auth-storage-lifecycle'

interface SupabaseCredentials {
  readonly url: string
  readonly publishableKey: string
}

const SUPABASE_URL_ENV_KEYS = [
  'VITE_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const

const SUPABASE_PUBLISHABLE_KEY_ENV_KEYS = [
  'VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const

let cachedSupabaseClient: SupabaseClient | null | undefined

function resolveFirstDefinedEnvValue(keys: readonly string[]): string | undefined {
  const env = import.meta.env as Record<string, unknown>

  for (const key of keys) {
    const value = env[key]

    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }

  return undefined
}

export function resolveSupabaseCredentials(): SupabaseCredentials | null {
  const url = resolveFirstDefinedEnvValue(SUPABASE_URL_ENV_KEYS)
  const publishableKey = resolveFirstDefinedEnvValue(SUPABASE_PUBLISHABLE_KEY_ENV_KEYS)

  if (!url || !publishableKey) {
    return null
  }

  return {
    url,
    publishableKey,
  }
}

export function resolveSupabaseClient(): SupabaseClient | null {
  if (cachedSupabaseClient !== undefined) {
    return cachedSupabaseClient
  }

  const credentials = resolveSupabaseCredentials()
  if (!credentials) {
    cachedSupabaseClient = null
    return cachedSupabaseClient
  }

  ensureAuthStorageLifecycle()

  cachedSupabaseClient = createClient(credentials.url, credentials.publishableKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  })

  return cachedSupabaseClient
}

export const supabase = resolveSupabaseClient()
