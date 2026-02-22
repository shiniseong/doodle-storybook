import { WebhookVerificationError, validateEvent } from '@polar-sh/sdk/webhooks'

import {
  resolveCanonicalPaidPlanCode,
  resolveLegacyFallbackPlanCode,
  resolvePlanCodeFromPolarProductId,
  type PolarEnv,
} from '../_shared/polar'
import {
  hasProcessedWebhookEvent,
  markWebhookEventProcessed,
  upsertSubscriptionFromPolar,
} from '../_shared/subscription-access'
import { resolveSupabaseConfig, type SupabaseEnv } from '../_shared/supabase'

interface Env extends SupabaseEnv, PolarEnv {
  POLAR_WEBHOOK_SECRET?: string
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

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function isSubscriptionWebhookEventType(type: string): boolean {
  return type.startsWith('subscription.')
}

function headersToRecord(headers: Headers): Record<string, string> {
  const entries: Array<[string, string]> = []
  headers.forEach((value, key) => {
    entries.push([key, value])
  })

  return Object.fromEntries(entries)
}

function resolveWebhookEventId(headers: Headers): string | null {
  const candidate =
    headers.get('webhook-id') ||
    headers.get('Webhook-Id') ||
    headers.get('x-webhook-id') ||
    headers.get('X-Webhook-Id')

  return normalizeString(candidate)
}

function resolveUserIdFromSubscriptionPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as {
    customer?: {
      externalId?: unknown
    }
  }

  return normalizeString(candidate.customer?.externalId)
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: withCors(),
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const webhookSecret = (context.env.POLAR_WEBHOOK_SECRET || '').trim()
  if (webhookSecret.length === 0) {
    return jsonResponse(
      {
        error: 'POLAR_WEBHOOK_SECRET must be configured.',
      },
      500,
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

  const eventId = resolveWebhookEventId(context.request.headers)
  if (!eventId) {
    return jsonResponse(
      {
        error: 'Missing webhook-id header.',
      },
      400,
    )
  }

  const alreadyProcessedResult = await hasProcessedWebhookEvent(supabaseConfig, eventId)
  if (!alreadyProcessedResult.ok) {
    return jsonResponse(
      {
        error: 'Failed to resolve webhook deduplication status.',
        detail: alreadyProcessedResult.failure.message,
      },
      502,
    )
  }

  if (alreadyProcessedResult.value) {
    return jsonResponse(
      {
        received: true,
        duplicate: true,
      },
      202,
    )
  }

  const rawBody = await context.request.text()

  let event: { type: string; data: unknown }
  try {
    const parsed = validateEvent(rawBody, headersToRecord(context.request.headers), webhookSecret)
    event = parsed as { type: string; data: unknown }
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return jsonResponse(
        {
          error: 'Invalid webhook signature.',
        },
        403,
      )
    }

    return jsonResponse(
      {
        error: 'Invalid webhook payload.',
      },
      400,
    )
  }

  if (isSubscriptionWebhookEventType(event.type)) {
    const userId = resolveUserIdFromSubscriptionPayload(event.data)
    if (!userId) {
      return jsonResponse(
        {
          error: 'Subscription event is missing customer external ID.',
        },
        400,
      )
    }

    const subscriptionData = event.data as {
      id?: unknown
      status?: unknown
      customerId?: unknown
      productId?: unknown
      trialStart?: unknown
      trialEnd?: unknown
      currentPeriodStart?: unknown
      currentPeriodEnd?: unknown
      metadata?: Record<string, unknown>
    }

    const metadataPlanCode =
      subscriptionData.metadata && typeof subscriptionData.metadata.planCode === 'string'
        ? subscriptionData.metadata.planCode.trim()
        : null

    const canonicalPlanCodeFromMetadata = resolveCanonicalPaidPlanCode(metadataPlanCode, context.env)
    const canonicalPlanCodeFromProductId = resolvePlanCodeFromPolarProductId(
      normalizeString(subscriptionData.productId),
      context.env,
    )
    const resolvedPlanCode =
      canonicalPlanCodeFromMetadata ||
      canonicalPlanCodeFromProductId ||
      resolveLegacyFallbackPlanCode(context.env)

    const upsertResult = await upsertSubscriptionFromPolar(supabaseConfig, {
      userId,
      eventId,
      status: subscriptionData.status,
      planCode: resolvedPlanCode,
      providerCustomerId: normalizeString(subscriptionData.customerId),
      providerSubscriptionId: normalizeString(subscriptionData.id),
      trialStartAt: subscriptionData.trialStart as Date | string | null | undefined,
      trialEndAt: subscriptionData.trialEnd as Date | string | null | undefined,
      currentPeriodStart: subscriptionData.currentPeriodStart as Date | string | null | undefined,
      currentPeriodEnd: subscriptionData.currentPeriodEnd as Date | string | null | undefined,
    })

    if (!upsertResult.ok) {
      return jsonResponse(
        {
          error: 'Failed to upsert subscription state from webhook.',
          detail: upsertResult.failure.message,
        },
        502,
      )
    }
  }

  const markResult = await markWebhookEventProcessed(supabaseConfig, eventId, event.type, event)
  if (!markResult.ok) {
    if (markResult.failure.status === 409) {
      return jsonResponse(
        {
          received: true,
          duplicate: true,
        },
        202,
      )
    }

    return jsonResponse(
      {
        error: 'Failed to persist webhook event marker.',
        detail: markResult.failure.message,
      },
      502,
    )
  }

  return jsonResponse(
    {
      received: true,
    },
    202,
  )
}
