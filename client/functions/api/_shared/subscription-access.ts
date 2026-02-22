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
export type BillingPlanCode = 'free' | 'standard' | 'pro'
export type BillingPaidPlanCode = Exclude<BillingPlanCode, 'free'>

export interface BillingPlanDefinition {
  code: BillingPlanCode
  name: string
  priceUsdMonthly: number
  totalFreeStories?: number
  dailyQuota?: number
  trialDays?: number
}

export interface BillingCurrentPlan {
  code: BillingPlanCode
  name: string
}

export interface BillingSubscription {
  status: BillingSubscriptionStatus
  planCode: BillingPaidPlanCode | null
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
  dailyQuotaLimit: number | null
  dailyQuotaUsed: number
  remainingDailyStories: number | null
  dailyQuotaDateKst: string | null
}

export interface BillingAccessSnapshot {
  subscription: BillingSubscription | null
  quota: BillingQuota
  currentPlan: BillingCurrentPlan
  plans: BillingPlanDefinition[]
  canCreate: boolean
}

interface StoredUsageQuota {
  freeStoryQuotaTotal: number
  freeStoryQuotaUsed: number
  dailyStoryQuotaUsed: number
  dailyStoryQuotaDate: string | null
}

const DEFAULT_FREE_STORY_QUOTA_TOTAL = 2
const STANDARD_DAILY_STORY_QUOTA = 30
const PRO_DAILY_STORY_QUOTA = 60

const BILLING_PLANS: ReadonlyArray<BillingPlanDefinition> = [
  {
    code: 'free',
    name: 'Free',
    priceUsdMonthly: 0,
    totalFreeStories: DEFAULT_FREE_STORY_QUOTA_TOTAL,
  },
  {
    code: 'standard',
    name: 'Standard',
    priceUsdMonthly: 4.99,
    dailyQuota: STANDARD_DAILY_STORY_QUOTA,
    trialDays: 1,
  },
  {
    code: 'pro',
    name: 'Pro',
    priceUsdMonthly: 8.99,
    dailyQuota: PRO_DAILY_STORY_QUOTA,
    trialDays: 1,
  },
]

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
  if (
    value === 'trialing' ||
    value === 'active' ||
    value === 'past_due' ||
    value === 'canceled' ||
    value === 'incomplete' ||
    value === 'unpaid'
  ) {
    return value
  }

  if (value === 'incomplete_expired') {
    return 'incomplete'
  }

  return null
}

function normalizePaidPlanCode(value: unknown): BillingPaidPlanCode | null {
  const normalized = normalizeString(value)
  if (!normalized) {
    return null
  }

  const lower = normalized.toLowerCase()
  if (lower === 'pro') {
    return 'pro'
  }

  if (lower === 'standard' || lower === 'monthly_unlimited_6900_krw') {
    return 'standard'
  }

  return null
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString()
  }

  return normalizeString(value)
}

function normalizeKstDateOnly(value: unknown): string | null {
  const normalized = normalizeString(value)
  if (!normalized) {
    return null
  }

  const match = normalized.match(/^\d{4}-\d{2}-\d{2}$/)
  return match ? normalized : null
}

function resolveCurrentKstDate(now: Date = new Date()): string {
  const utcTime = now.getTime()
  const kstTime = utcTime + 9 * 60 * 60 * 1000
  return new Date(kstTime).toISOString().slice(0, 10)
}

function resolveBillingPlanDefinition(code: BillingPlanCode): BillingPlanDefinition {
  const found = BILLING_PLANS.find((plan) => plan.code === code)
  return found
    ? { ...found }
    : {
        code: 'free',
        name: 'Free',
        priceUsdMonthly: 0,
        totalFreeStories: DEFAULT_FREE_STORY_QUOTA_TOTAL,
      }
}

function isPaidAccessStatus(status: BillingSubscriptionStatus | null | undefined): boolean {
  return status === 'trialing' || status === 'active'
}

function resolveEffectiveDailyUsage(quota: StoredUsageQuota, todayKst: string): number {
  if (quota.dailyStoryQuotaDate !== todayKst) {
    return 0
  }

  return quota.dailyStoryQuotaUsed
}

function resolveCurrentPlanCode(subscription: BillingSubscription | null): BillingPlanCode {
  if (!subscription) {
    return 'free'
  }

  if (subscription.planCode === 'pro') {
    return 'pro'
  }

  if (subscription.planCode === 'standard') {
    return 'standard'
  }

  if (isPaidAccessStatus(subscription.status)) {
    return 'standard'
  }

  return 'free'
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
    planCode: normalizePaidPlanCode(candidate.plan_code),
    trialStartAt: toIsoString(candidate.trial_start_at),
    trialEndAt: toIsoString(candidate.trial_end_at),
    currentPeriodStart: toIsoString(candidate.current_period_start),
    currentPeriodEnd: toIsoString(candidate.current_period_end),
    providerCustomerId: normalizeString(candidate.provider_customer_id),
    providerSubscriptionId: normalizeString(candidate.provider_subscription_id),
  }
}

function normalizeStoredUsageQuota(raw: unknown): StoredUsageQuota | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as {
    free_story_quota_total?: unknown
    free_story_quota_used?: unknown
    daily_story_quota_used?: unknown
    daily_story_quota_date?: unknown
  }

  const total = normalizeNonNegativeInteger(candidate.free_story_quota_total)
  const freeUsed = normalizeNonNegativeInteger(candidate.free_story_quota_used)
  if (total === null || freeUsed === null) {
    return null
  }

  const normalizedFreeUsed = Math.min(total, freeUsed)
  const normalizedDailyUsed = normalizeNonNegativeInteger(candidate.daily_story_quota_used) ?? 0

  return {
    freeStoryQuotaTotal: total,
    freeStoryQuotaUsed: normalizedFreeUsed,
    dailyStoryQuotaUsed: normalizedDailyUsed,
    dailyStoryQuotaDate: normalizeKstDateOnly(candidate.daily_story_quota_date),
  }
}

function buildDefaultStoredUsageQuota(): StoredUsageQuota {
  return {
    freeStoryQuotaTotal: DEFAULT_FREE_STORY_QUOTA_TOTAL,
    freeStoryQuotaUsed: 0,
    dailyStoryQuotaUsed: 0,
    dailyStoryQuotaDate: null,
  }
}

function buildBillingQuota(
  storedUsageQuota: StoredUsageQuota,
  currentPlanCode: BillingPlanCode,
  paidAccessEnabled: boolean,
): BillingQuota {
  const todayKst = resolveCurrentKstDate()
  const freeStoryQuotaUsed = Math.min(storedUsageQuota.freeStoryQuotaTotal, storedUsageQuota.freeStoryQuotaUsed)
  const remainingFreeStories = Math.max(0, storedUsageQuota.freeStoryQuotaTotal - freeStoryQuotaUsed)

  if (!paidAccessEnabled || currentPlanCode === 'free') {
    return {
      freeStoryQuotaTotal: storedUsageQuota.freeStoryQuotaTotal,
      freeStoryQuotaUsed,
      remainingFreeStories,
      dailyQuotaLimit: null,
      dailyQuotaUsed: 0,
      remainingDailyStories: null,
      dailyQuotaDateKst: storedUsageQuota.dailyStoryQuotaDate,
    }
  }

  const plan = resolveBillingPlanDefinition(currentPlanCode)
  const dailyQuotaLimit = plan.dailyQuota ?? STANDARD_DAILY_STORY_QUOTA
  const effectiveDailyUsed = Math.min(dailyQuotaLimit, resolveEffectiveDailyUsage(storedUsageQuota, todayKst))

  return {
    freeStoryQuotaTotal: storedUsageQuota.freeStoryQuotaTotal,
    freeStoryQuotaUsed,
    remainingFreeStories,
    dailyQuotaLimit,
    dailyQuotaUsed: effectiveDailyUsed,
    remainingDailyStories: Math.max(0, dailyQuotaLimit - effectiveDailyUsed),
    dailyQuotaDateKst: todayKst,
  }
}

async function ensureUsageQuotaRow(config: SupabaseConfig, userId: string): Promise<SupabaseResult<StoredUsageQuota>> {
  const query = new URLSearchParams({
    select: 'free_story_quota_total,free_story_quota_used,daily_story_quota_used,daily_story_quota_date',
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
    const normalized = normalizeStoredUsageQuota(payload[0])
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
        daily_story_quota_used: 0,
        daily_story_quota_date: null,
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
    value: buildDefaultStoredUsageQuota(),
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
  const [subscriptionResult, usageQuotaResult] = await Promise.all([
    fetchSubscription(config, userId),
    ensureUsageQuotaRow(config, userId),
  ])

  if (!subscriptionResult.ok) {
    return subscriptionResult
  }

  if (!usageQuotaResult.ok) {
    return usageQuotaResult
  }

  const currentPlanCode = resolveCurrentPlanCode(subscriptionResult.value)
  const paidAccessEnabled = isPaidAccessStatus(subscriptionResult.value?.status)
  const quota = buildBillingQuota(usageQuotaResult.value, currentPlanCode, paidAccessEnabled)

  return {
    ok: true,
    value: {
      subscription: subscriptionResult.value,
      quota,
      currentPlan: {
        code: currentPlanCode,
        name: resolveBillingPlanDefinition(currentPlanCode).name,
      },
      plans: BILLING_PLANS.map((plan) => ({ ...plan })),
      canCreate: paidAccessEnabled
        ? (quota.remainingDailyStories ?? 0) > 0
        : quota.remainingFreeStories > 0,
    },
  }
}

export async function incrementFreeQuotaUsage(
  config: SupabaseConfig,
  userId: string,
): Promise<SupabaseResult<BillingQuota>> {
  const usageQuotaResult = await ensureUsageQuotaRow(config, userId)
  if (!usageQuotaResult.ok) {
    return usageQuotaResult
  }

  const currentUsageQuota = usageQuotaResult.value
  if (currentUsageQuota.freeStoryQuotaUsed >= currentUsageQuota.freeStoryQuotaTotal) {
    return asSupabaseFailure(409, 'Free story quota is exhausted.')
  }

  const nextUsed = Math.min(currentUsageQuota.freeStoryQuotaTotal, currentUsageQuota.freeStoryQuotaUsed + 1)

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
    value: buildBillingQuota(
      {
        ...currentUsageQuota,
        freeStoryQuotaUsed: nextUsed,
      },
      'free',
      false,
    ),
  }
}

export async function incrementDailyQuotaUsage(
  config: SupabaseConfig,
  userId: string,
  planCode: BillingPaidPlanCode,
): Promise<SupabaseResult<BillingQuota>> {
  const usageQuotaResult = await ensureUsageQuotaRow(config, userId)
  if (!usageQuotaResult.ok) {
    return usageQuotaResult
  }

  const currentUsageQuota = usageQuotaResult.value
  const todayKst = resolveCurrentKstDate()
  const dailyQuotaLimit = planCode === 'pro' ? PRO_DAILY_STORY_QUOTA : STANDARD_DAILY_STORY_QUOTA
  const effectiveDailyUsed = Math.min(dailyQuotaLimit, resolveEffectiveDailyUsage(currentUsageQuota, todayKst))

  if (effectiveDailyUsed >= dailyQuotaLimit) {
    return asSupabaseFailure(409, 'Daily story quota is exhausted.')
  }

  const nextDailyUsed = Math.min(dailyQuotaLimit, effectiveDailyUsed + 1)

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
          daily_story_quota_used: nextDailyUsed,
          daily_story_quota_date: todayKst,
        }),
      },
    )
  } catch {
    return asSupabaseFailure(502, 'Failed to update daily usage quota in Supabase.')
  }

  if (!response.ok) {
    const payload = await readResponseBody(response)
    return asSupabaseFailure(
      response.status,
      resolveSupabaseErrorMessage(payload, 'Failed to update daily usage quota in Supabase.'),
    )
  }

  return {
    ok: true,
    value: buildBillingQuota(
      {
        ...currentUsageQuota,
        dailyStoryQuotaUsed: nextDailyUsed,
        dailyStoryQuotaDate: todayKst,
      },
      planCode,
      true,
    ),
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
  planCode: BillingPaidPlanCode
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
