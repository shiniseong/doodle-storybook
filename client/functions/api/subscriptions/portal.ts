import { authenticateRequest } from '../_shared/auth'
import {
  ensureRequiredAgreementsAccepted,
  REQUIRED_AGREEMENTS_REJECT_CODE,
} from '../_shared/account-profile'
import {
  resolveRequiredAgreementsVersion,
  type RequiredAgreementsEnv,
} from '../_shared/agreements-policy'
import { createPolarCustomerPortalUrl, resolvePolarClient, resolvePortalReturnUrl, type PolarEnv } from '../_shared/polar'
import { getBillingAccessSnapshot } from '../_shared/subscription-access'
import { resolveSupabaseConfig, type SupabaseEnv } from '../_shared/supabase'

interface Env extends SupabaseEnv, PolarEnv, RequiredAgreementsEnv {
  POLAR_MOCK_ALWAYS_SUCCESS?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

function isMockPortalEnabled(env: Env): boolean {
  return env.POLAR_MOCK_ALWAYS_SUCCESS === '1'
}

function resolveMockPortalUrl(request: Request): string {
  const url = new URL('/create', request.url)
  url.searchParams.set('checkout', 'success')
  url.searchParams.set('mock_polar', '1')
  url.searchParams.set('portal', '1')
  return url.toString()
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: withCors(),
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
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

  const requiredAgreementsVersion = resolveRequiredAgreementsVersion(context.env)
  const agreementsResult = await ensureRequiredAgreementsAccepted(
    supabaseConfig,
    authResult.value.userId,
    requiredAgreementsVersion,
    authResult.value.accessToken,
  )
  if (!agreementsResult.ok) {
    return jsonResponse(
      {
        error: 'Failed to resolve required agreements status.',
        detail: agreementsResult.failure.message,
      },
      502,
    )
  }

  if (!agreementsResult.value.accepted) {
    return jsonResponse(
      {
        code: REQUIRED_AGREEMENTS_REJECT_CODE,
        error: REQUIRED_AGREEMENTS_REJECT_CODE,
        message: 'Required agreements are not accepted.',
      },
      403,
    )
  }

  const accessResult = await getBillingAccessSnapshot(supabaseConfig, authResult.value.userId)
  if (!accessResult.ok) {
    return jsonResponse(
      {
        error: 'Failed to fetch subscription access.',
        detail: accessResult.failure.message,
      },
      502,
    )
  }

  if (!accessResult.value.subscription) {
    return jsonResponse(
      {
        error: 'No active billing profile found for this account.',
      },
      409,
    )
  }

  if (isMockPortalEnabled(context.env)) {
    return jsonResponse({
      portalUrl: resolveMockPortalUrl(context.request),
    })
  }

  const polarClient = resolvePolarClient(context.env)
  if (!polarClient) {
    return jsonResponse(
      {
        error: 'POLAR_ACCESS_TOKEN must be configured.',
      },
      500,
    )
  }

  try {
    const portalUrl = await createPolarCustomerPortalUrl({
      client: polarClient,
      externalCustomerId: authResult.value.userId,
      returnUrl: resolvePortalReturnUrl(context.request, context.env),
    })

    if (!portalUrl) {
      return jsonResponse(
        {
          error: 'Failed to create customer portal session.',
        },
        502,
      )
    }

    return jsonResponse({
      portalUrl,
    })
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Failed to create customer portal session.',
      },
      502,
    )
  }
}
