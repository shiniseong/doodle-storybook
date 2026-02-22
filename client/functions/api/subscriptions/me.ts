import { authenticateRequest } from '../_shared/auth'
import { getBillingAccessSnapshot } from '../_shared/subscription-access'
import { resolveSupabaseConfig, type SupabaseEnv } from '../_shared/supabase'

type Env = SupabaseEnv

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const

function withCors(headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers)

  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    nextHeaders.set(key, value)
  })

  return nextHeaders
}

function jsonResponse(payload: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: withCors({
      'Content-Type': 'application/json; charset=utf-8',
    }),
  })
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: withCors(),
  })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await authenticateRequest(context.request, context.env)
  if (!authResult.ok) {
    return jsonResponse(
      {
        error: authResult.failure.message,
      },
      authResult.failure.status,
    )
  }

  const supabaseConfig = resolveSupabaseConfig(context.env)
  if (!supabaseConfig) {
    return jsonResponse(
      {
        error: 'SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY must be configured.',
      },
      500,
    )
  }

  const accessResult = await getBillingAccessSnapshot(supabaseConfig, authResult.value.userId)
  if (!accessResult.ok) {
    console.error('Failed to fetch billing access snapshot.', {
      userId: authResult.value.userId,
      status: accessResult.failure.status,
      message: accessResult.failure.message,
    })

    return jsonResponse(
      {
        error: 'Failed to fetch subscription access.',
        detail: accessResult.failure.message,
      },
      502,
    )
  }

  return jsonResponse(accessResult.value)
}
