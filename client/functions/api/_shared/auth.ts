import { readResponseBody, resolveSupabaseConfig, type SupabaseEnv } from './supabase'

export interface AuthenticatedUser {
  userId: string
  userEmail: string | null
  accessToken: string
}

interface ResolvedAuthenticatedUserIdentity {
  userId: string
  userEmail: string | null
}

interface AuthFailure {
  status: number
  message: string
}

interface AuthenticatedUserSuccess {
  ok: true
  value: AuthenticatedUser
}

interface AuthenticatedUserFailure {
  ok: false
  failure: AuthFailure
}

export type AuthenticateRequestResult = AuthenticatedUserSuccess | AuthenticatedUserFailure

interface AuthEnvOverrides {
  ALLOW_INSECURE_TEST_TOKENS?: string
}

function resolveBearerToken(request: Request): string | null {
  const authorization = request.headers.get('Authorization') || request.headers.get('authorization')
  if (!authorization) {
    return null
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i)
  if (!match?.[1]) {
    return null
  }

  const token = match[1].trim()
  return token.length > 0 ? token : null
}

function normalizeAuthenticatedUser(payload: unknown): ResolvedAuthenticatedUserIdentity | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as {
    id?: unknown
    email?: unknown
  }

  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return null
  }

  return {
    userId: candidate.id.trim(),
    userEmail: typeof candidate.email === 'string' && candidate.email.trim().length > 0 ? candidate.email.trim() : null,
  }
}

export async function authenticateRequest(request: Request, env: SupabaseEnv): Promise<AuthenticateRequestResult> {
  const token = resolveBearerToken(request)
  if (!token) {
    return {
      ok: false,
      failure: {
        status: 401,
        message: 'Authorization Bearer token is required.',
      },
    }
  }

  const envWithOverrides = env as SupabaseEnv & AuthEnvOverrides
  if (envWithOverrides.ALLOW_INSECURE_TEST_TOKENS === '1' && token.startsWith('test-user:')) {
    const rawUserId = token.slice('test-user:'.length).trim()
    if (rawUserId.length > 0) {
      return {
        ok: true,
        value: {
          userId: rawUserId,
          userEmail: null,
          accessToken: token,
        },
      }
    }
  }

  const config = resolveSupabaseConfig(env)
  if (!config) {
    return {
      ok: false,
      failure: {
        status: 500,
        message: 'SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY must be configured.',
      },
    }
  }

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    return {
      ok: false,
      failure: {
        status: 502,
        message: 'Failed to reach Supabase Auth API.',
      },
    }
  }

  const payload = await readResponseBody(response)
  if (!response.ok) {
    return {
      ok: false,
      failure: {
        status: 401,
        message: 'Invalid or expired access token.',
      },
    }
  }

  const user = normalizeAuthenticatedUser(payload)
  if (!user) {
    return {
      ok: false,
      failure: {
        status: 401,
        message: 'Failed to resolve authenticated user from token.',
      },
    }
  }

  return {
    ok: true,
    value: {
      ...user,
      accessToken: token,
    },
  }
}
