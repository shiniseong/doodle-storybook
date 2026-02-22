import {
  createSupabaseHeaders,
  readResponseBody,
  resolveSupabaseErrorMessage,
  type SupabaseConfig,
  type SupabaseError,
  type SupabaseFailure,
  type SupabaseResult,
} from './supabase'

export type BillingSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid'

export interface BillingSubscription {
  status: BillingSubscriptionStatus
  planCode: string | null
  trialStartAt: string | null
  trialEndAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  providerCustomerId: string | null
  providerSubscriptionId: string | null
}

export interface BillingQuota {
  freeStoryQuotaTotal: number
  freeStoryQuotaUsed: number
  remainingFreeStories: number
}

export interface BillingAccessSnapshot {
  subscription: BillingSubscription | null
  quota: BillingQuota
  canCreate: boolean
}

const DEFAULT_FREE_STORY_QUOTA_TOTAL = 2

function asSupabaseFailure(status: number, message: string): SupabaseError {
  return {
    ok: false,
    failure: {
      status,
      message,
    },
  }
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      return null
    }

    const parsed = Number(trimmed)
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return null
}

function normalizeStatus(value: unknown): BillingSubscriptionStatus | null {
  if (value === 'trialing' || value === 'active' || value === 'past_due' || value === 'canceled' || value === 'incomplete' || value === 'unpaid') {
    return value
  }

  if (value === 'incomplete_expired') {
    return 'incomplete'
  }

  return null
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  return normalizeString(value)
}

function normalizeSubscription(raw: unknown): BillingSubscription | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as {
    status?: unknown
    plan_code?: unknown
    trial_start_at?: unknown
    trial_end_at?: unknown
    current_period_start?: unknown
    current_period_end?: unknown
    provider_customer_id?: unknown
    provider_subscription_id?: unknown
  }

  const status = normalizeStatus(candidate.status)
  if (!status) {
    return null
  }

  return {
    status,
    planCode: normalizeString(candidate.plan_code),
    trialStartAt: toIsoString(candidate.trial_start_at),
    trialEndAt: toIsoString(candidate.trial_end_at),
    currentPeriodStart: toIsoString(candidate.current_period_start),
    currentPeriodEnd: toIsoString(candidate.current_period_end),
    providerCustomerId: normalizeString(candidate.provider_customer_id),
    providerSubscriptionId: normalizeString(candidate.provider_subscription_id),
  }
}

function normalizeQuota(raw: unknown): BillingQuota | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as {
    free_story_quota_total?: unknown
    free_story_quota_used?: unknown
  }

  const total = normalizeNonNegativeInteger(candidate.free_story_quota_total)
  const used = normalizeNonNegativeInteger(candidate.free_story_quota_used)
  if (total === null || used === null) {
    return null
  }

  const normalizedUsed = Math.min(total, used)

  return {
    freeStoryQuotaTotal: total,
    freeStoryQuotaUsed: normalizedUsed,
    remainingFreeStories: Math.max(0, total - normalizedUsed),
  }
}

function buildDefaultQuota(): BillingQuota {
  return {
    freeStoryQuotaTotal: DEFAULT_FREE_STORY_QUOTA_TOTAL,
    freeStoryQuotaUsed: 0,
    remainingFreeStories: DEFAULT_FREE_STORY_QUOTA_TOTAL,
  }
}

async function ensureUsageQuotaRow(config: SupabaseConfig, userId: string): Promise<SupabaseResult<BillingQuota>> {
  const query = new URLSearchParams({
    select: 'free_story_quota_total,free_story_quota_used',
    user_id: `eq.${userId}`,
    limit: '1',
  })

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/usage_quotas?${query.toString()}`, {
      method: 'GET',
      headers: createSupabaseHeaders(config),
    })
  } catch {
    return asSupabaseFailure(502, 'Failed to reach Supabase REST API for usage_quotas.')
  }

  const payload = await readResponseBody(response)
  if (!response.ok) {
    return asSupabaseFailure(
      response.status,
      resolveSupabaseErrorMessage(payload, 'Failed to fetch usage quota from Supabase.'),
    )
  }

  if (Array.isArray(payload) && payload.length > 0) {
    const normalized = normalizeQuota(payload[0])
    if (normalized) {
      return {
        ok: true,
        value: normalized,
      }
    }
  }

  let insertResponse: Response
  try {
    insertResponse = await fetch(`${config.baseUrl}/rest/v1/usage_quotas`, {
      method: 'POST',
      headers: createSupabaseHeaders(config, {
        includeJsonBody: true,
        preferMinimal: true,
      }),
      body: JSON.stringify({
        user_id: userId,
        free_story_quota_total: DEFAULT_FREE_STORY_QUOTA_TOTAL,
        free_story_quota_used: 0,
      }),
    })
  } catch {
    return asSupabaseFailure(502, 'Failed to insert default usage quota row.')
  }

  if (!insertResponse.ok) {
    const insertPayload = await readResponseBody(insertResponse)
    return asSupabaseFailure(
      insertResponse.status,
      resolveSupabaseErrorMessage(insertPayload, 'Failed to insert default usage quota row.'),
    )
  }

  return {
    ok: true,
    value: buildDefaultQuota(),
  }
}

async function fetchSubscription(config: SupabaseConfig, userId: string): Promise<SupabaseResult<BillingSubscription | null>> {
  const query = new URLSearchParams({
    select:
      'status,plan_code,trial_start_at,trial_end_at,current_period_start,current_period_end,provider_customer_id,provider_subscription_id',
    user_id: `eq.${userId}`,
    limit: '1',
  })

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/subscriptions?${query.toString()}`, {
      method: 'GET',
      headers: createSupabaseHeaders(config),
    })
  } catch {
    return asSupabaseFailure(502, 'Failed to reach Supabase REST API for subscriptions.')
  }

  const payload = await readResponseBody(response)
  if (!response.ok) {
    return asSupabaseFailure(
      response.status,
      resolveSupabaseErrorMessage(payload, 'Failed to fetch subscription from Supabase.'),
    )
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    return {
      ok: true,
      value: null,
    }
  }

  const normalized = normalizeSubscription(payload[0])
  if (!normalized) {
    return asSupabaseFailure(502, 'Invalid subscription row response from Supabase.')
  }

  return {
    ok: true,
    value: normalized,
  }
}

export async function getBillingAccessSnapshot(
  config: SupabaseConfig,
  userId: string,
): Promise<SupabaseResult<BillingAccessSnapshot>> {
  const [subscriptionResult, quotaResult] = await Promise.all([
    fetchSubscription(config, userId),
    ensureUsageQuotaRow(config, userId),
  ])

  if (!subscriptionResult.ok) {
    return subscriptionResult
  }

  if (!quotaResult.ok) {
    return quotaResult
  }

  const isPaidAccess =
    subscriptionResult.value?.status === 'trialing' || subscriptionResult.value?.status === 'active'

  return {
    ok: true,
    value: {
      subscription: subscriptionResult.value,
      quota: quotaResult.value,
      canCreate: isPaidAccess || quotaResult.value.remainingFreeStories > 0,
    },
  }
}

export async function incrementFreeQuotaUsage(
  config: SupabaseConfig,
  userId: string,
): Promise<SupabaseResult<BillingQuota>> {
  const quotaResult = await ensureUsageQuotaRow(config, userId)
  if (!quotaResult.ok) {
    return quotaResult
  }

  const currentQuota = quotaResult.value
  if (currentQuota.freeStoryQuotaUsed >= currentQuota.freeStoryQuotaTotal) {
    return asSupabaseFailure(409, 'Free story quota is exhausted.')
  }

  const nextUsed = Math.min(currentQuota.freeStoryQuotaTotal, currentQuota.freeStoryQuotaUsed + 1)

  let response: Response
  try {
    response = await fetch(
      `${config.baseUrl}/rest/v1/usage_quotas?user_id=eq.${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        headers: createSupabaseHeaders(config, {
          includeJsonBody: true,
          preferMinimal: true,
        }),
        body: JSON.stringify({
          free_story_quota_used: nextUsed,
        }),
      },
    )
  } catch {
    return asSupabaseFailure(502, 'Failed to update usage quota in Supabase.')
  }

  if (!response.ok) {
    const payload = await readResponseBody(response)
    return asSupabaseFailure(
      response.status,
      resolveSupabaseErrorMessage(payload, 'Failed to update usage quota in Supabase.'),
    )
  }

  return {
    ok: true,
    value: {
      freeStoryQuotaTotal: currentQuota.freeStoryQuotaTotal,
      freeStoryQuotaUsed: nextUsed,
      remainingFreeStories: Math.max(0, currentQuota.freeStoryQuotaTotal - nextUsed),
    },
  }
}

function normalizeUtcDate(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizePolarSubscriptionStatus(value: unknown): BillingSubscriptionStatus {
  if (value === 'trialing' || value === 'active' || value === 'past_due' || value === 'canceled' || value === 'unpaid') {
    return value
  }

  return 'incomplete'
}

export interface UpsertSubscriptionFromPolarInput {
  userId: string
  eventId: string
  status: unknown
  planCode: string
  providerCustomerId: string | null
  providerSubscriptionId: string | null
  trialStartAt: Date | string | null | undefined
  trialEndAt: Date | string | null | undefined
  currentPeriodStart: Date | string | null | undefined
  currentPeriodEnd: Date | string | null | undefined
}

export async function upsertSubscriptionFromPolar(
  config: SupabaseConfig,
  input: UpsertSubscriptionFromPolarInput,
): Promise<SupabaseResult<null>> {
  let response: Response

  try {
    response = await fetch(`${config.baseUrl}/rest/v1/subscriptions?on_conflict=user_id`, {
      method: 'POST',
      headers: createSupabaseHeaders(config, {
        includeJsonBody: true,
        preferMinimal: true,
        mergeDuplicates: true,
      }),
      body: JSON.stringify({
        user_id: input.userId,
        provider: 'polar',
        status: normalizePolarSubscriptionStatus(input.status),
        plan_code: input.planCode,
        trial_start_at: normalizeUtcDate(input.trialStartAt),
        trial_end_at: normalizeUtcDate(input.trialEndAt),
        current_period_start: normalizeUtcDate(input.currentPeriodStart),
        current_period_end: normalizeUtcDate(input.currentPeriodEnd),
        provider_customer_id: input.providerCustomerId,
        provider_subscription_id: input.providerSubscriptionId,
        last_webhook_event_id: input.eventId,
      }),
    })
  } catch {
    return asSupabaseFailure(502, 'Failed to upsert subscription from webhook.')
  }

  if (!response.ok) {
    const payload = await readResponseBody(response)
    return asSupabaseFailure(
      response.status,
      resolveSupabaseErrorMessage(payload, 'Failed to upsert subscription from webhook.'),
    )
  }

  return {
    ok: true,
    value: null,
  }
}

export async function hasProcessedWebhookEvent(
  config: SupabaseConfig,
  eventId: string,
): Promise<SupabaseResult<boolean>> {
  const query = new URLSearchParams({
    select: 'event_id',
    event_id: `eq.${eventId}`,
    limit: '1',
  })

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/polar_webhook_events?${query.toString()}`, {
      method: 'GET',
      headers: createSupabaseHeaders(config),
    })
  } catch {
    return asSupabaseFailure(502, 'Failed to reach Supabase REST API for webhook events.')
  }

  const payload = await readResponseBody(response)
  if (!response.ok) {
    return asSupabaseFailure(
      response.status,
      resolveSupabaseErrorMessage(payload, 'Failed to fetch webhook deduplication status.'),
    )
  }

  return {
    ok: true,
    value: Array.isArray(payload) && payload.length > 0,
  }
}

export async function markWebhookEventProcessed(
  config: SupabaseConfig,
  eventId: string,
  eventType: string,
  payload: unknown,
): Promise<SupabaseResult<null>> {
  let response: Response

  try {
    response = await fetch(`${config.baseUrl}/rest/v1/polar_webhook_events`, {
      method: 'POST',
      headers: createSupabaseHeaders(config, {
        includeJsonBody: true,
        preferMinimal: true,
      }),
      body: JSON.stringify({
        event_id: eventId,
        event_type: eventType,
        payload,
      }),
    })
  } catch {
    return asSupabaseFailure(502, 'Failed to persist webhook event marker.')
  }

  if (!response.ok) {
    const body = await readResponseBody(response)
    return asSupabaseFailure(
      response.status,
      resolveSupabaseErrorMessage(body, 'Failed to persist webhook event marker.'),
    )
  }

  return {
    ok: true,
    value: null,
  }
}

export function toJsonError(failure: SupabaseFailure): { error: string; detail: string } {
  return {
    error: 'Supabase operation failed.',
    detail: failure.message,
  }
}
