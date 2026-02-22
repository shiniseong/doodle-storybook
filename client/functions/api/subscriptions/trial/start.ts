import { authenticateRequest } from '../../_shared/auth'
import {
  createPolarCheckoutUrl,
  createPolarCustomerPortalUrl,
  resolveCheckoutPlanConfig,
  resolveCheckoutUrls,
  resolvePolarClient,
  resolvePortalReturnUrl,
  type PolarPaidPlanCode,
  type PolarEnv,
} from '../../_shared/polar'
import { getBillingAccessSnapshot } from '../../_shared/subscription-access'
import { resolveSupabaseConfig, type SupabaseEnv } from '../../_shared/supabase'

interface Env extends SupabaseEnv, PolarEnv {}

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

function resolveRequestedPlanCode(value: unknown): PolarPaidPlanCode | null {
  if (value === 'standard' || value === 'pro') {
    return value
  }

  return null
}

async function parseRequestedPlanCode(request: Request): Promise<PolarPaidPlanCode | null> {
  const contentLength = request.headers.get('content-length')
  if (contentLength === '0') {
    return 'standard'
  }

  try {
    const payload = (await request.json()) as {
      planCode?: unknown
    }

    if (typeof payload.planCode === 'undefined') {
      return 'standard'
    }

    return resolveRequestedPlanCode(payload.planCode)
  } catch {
    return 'standard'
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: withCors(),
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const requestedPlanCode = await parseRequestedPlanCode(context.request)
  if (!requestedPlanCode) {
    return jsonResponse(
      {
        error: 'Invalid planCode. Use standard or pro.',
      },
      400,
    )
  }

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

  const polarClient = resolvePolarClient(context.env)
  if (!polarClient) {
    return jsonResponse(
      {
        error: 'POLAR_ACCESS_TOKEN must be configured.',
      },
      500,
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

  const currentStatus = accessResult.value.subscription?.status

  if (currentStatus === 'active') {
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
        action: 'portal',
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

  if (currentStatus === 'trialing') {
    return jsonResponse({
      action: 'noop',
      reason: 'ALREADY_TRIALING',
      message: 'Trial is already active.',
    })
  }

  const productConfig = resolveCheckoutPlanConfig(context.env, requestedPlanCode)
  if (!productConfig) {
    return jsonResponse(
      {
        error: requestedPlanCode === 'pro' ? 'POLAR_PRODUCT_ID_PRO must be configured.' : 'POLAR_PRODUCT_ID_STANDARD (or POLAR_PRODUCT_ID) must be configured.',
      },
      500,
    )
  }

  const checkoutUrls = resolveCheckoutUrls(context.request, context.env)

  try {
    const checkoutUrl = await createPolarCheckoutUrl({
      client: polarClient,
      productId: productConfig.productId,
      externalCustomerId: authResult.value.userId,
      successUrl: checkoutUrls.successUrl,
      returnUrl: checkoutUrls.returnUrl,
      planCode: productConfig.planCode,
    })

    if (!checkoutUrl) {
      return jsonResponse(
        {
          error: 'Failed to create Polar checkout session.',
        },
        502,
      )
    }

    return jsonResponse({
      action: 'checkout',
      checkoutUrl,
    })
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Failed to create Polar checkout session.',
      },
      502,
    )
  }
}
