export interface SupabaseEnv {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
}

export interface SupabaseConfig {
  baseUrl: string
  serviceRoleKey: string
  schema: string
}

export interface SupabaseFailure {
  status: number
  message: string
}

export interface SupabaseSuccess<T> {
  ok: true
  value: T
}

export interface SupabaseError {
  ok: false
  failure: SupabaseFailure
}

export type SupabaseResult<T> = SupabaseSuccess<T> | SupabaseError

export const STORYBOOK_DB_SCHEMA = 'doodle_storybook_db'

export function resolveSupabaseConfig(env: SupabaseEnv, schema: string = STORYBOOK_DB_SCHEMA): SupabaseConfig | null {
  const rawBaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim()
  const serviceRoleKey = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

  if (rawBaseUrl.length === 0 || serviceRoleKey.length === 0) {
    return null
  }

  return {
    baseUrl: rawBaseUrl.replace(/\/+$/, ''),
    serviceRoleKey,
    schema,
  }
}

interface CreateSupabaseHeadersOptions {
  includeJsonBody?: boolean
  preferMinimal?: boolean
  mergeDuplicates?: boolean
  ignoreDuplicates?: boolean
  authorizationToken?: string | null
}

export function createSupabaseHeaders(config: SupabaseConfig, options: CreateSupabaseHeadersOptions = {}): Headers {
  const authorizationToken =
    typeof options.authorizationToken === 'string' && options.authorizationToken.trim().length > 0
      ? options.authorizationToken.trim()
      : config.serviceRoleKey

  const headers = new Headers({
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${authorizationToken}`,
    'Content-Profile': config.schema,
    'Accept-Profile': config.schema,
  })

  if (options.includeJsonBody) {
    headers.set('Content-Type', 'application/json')
  }

  const preferValues: string[] = []
  if (options.mergeDuplicates) {
    preferValues.push('resolution=merge-duplicates')
  }
  if (options.ignoreDuplicates) {
    preferValues.push('resolution=ignore-duplicates')
  }
  if (options.preferMinimal) {
    preferValues.push('return=minimal')
  }

  if (preferValues.length > 0) {
    headers.set('Prefer', preferValues.join(','))
  }

  return headers
}

export async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    try {
      const text = await response.text()
      return { raw: text }
    } catch {
      return null
    }
  }
}

export function resolveSupabaseErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const candidate = payload as {
    message?: unknown
    error?: unknown
    details?: unknown
    hint?: unknown
  }

  const parts = [candidate.message, candidate.error, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value, index, list) => list.indexOf(value) === index)

  if (parts.length === 0) {
    return fallback
  }

  return parts.join(' | ')
}
