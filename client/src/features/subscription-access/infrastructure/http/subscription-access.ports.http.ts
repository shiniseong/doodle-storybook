import {
  type BillingPaidPlanCode,
  type BillingPlanCode,
  type BillingSubscriptionStatus,
  type SubscriptionAccessPort,
  type SubscriptionAccessSnapshot,
  type SubscriptionPortalResult,
  type TrialStartActionResult,
} from '@features/subscription-access/application/subscription-access.use-case'

interface HttpSubscriptionAccessPortOptions {
  baseUrl?: string
  accessToken?: string | null
}

interface SubscriptionApiErrorResponse {
  error?: unknown
  message?: unknown
  detail?: unknown
  details?: unknown
  hint?: unknown
}

function parseApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as SubscriptionApiErrorResponse
  const baseMessageCandidates = [candidate.error, candidate.message]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  const baseMessage = baseMessageCandidates[0] ?? null

  const detailCandidates = [candidate.detail, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => value !== baseMessage)
  const detail = detailCandidates[0] ?? null

  if (baseMessage && detail) {
    return `${baseMessage} (${detail})`
  }

  if (baseMessage) {
    return baseMessage
  }

  if (detail) {
    return detail
  }

  return null
}

function resolveApiBaseUrl(explicitBaseUrl?: string): string {
  if (explicitBaseUrl) {
    return explicitBaseUrl
  }

  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined
  return fromEnv ?? ''
}

function createJsonHeaders(accessToken?: string | null): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
  })

  if (typeof accessToken === 'string' && accessToken.trim().length > 0) {
    headers.set('Authorization', `Bearer ${accessToken.trim()}`)
  }

  return headers
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return null
  }

  return value
}

function normalizePlanCode(value: unknown): BillingPlanCode | null {
  if (value === 'free' || value === 'standard' || value === 'pro') {
    return value
  }

  return null
}

function normalizePaidPlanCode(value: unknown): BillingPaidPlanCode | null {
  if (value === 'standard' || value === 'pro') {
    return value
  }

  return null
}

function normalizeSubscriptionSnapshot(payload: unknown): SubscriptionAccessSnapshot | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as {
    subscription?: unknown
    quota?: unknown
    currentPlan?: unknown
    plans?: unknown
    canCreate?: unknown
  }

  if (!candidate.quota || typeof candidate.quota !== 'object') {
    return null
  }

  const quotaCandidate = candidate.quota as {
    freeStoryQuotaTotal?: unknown
    freeStoryQuotaUsed?: unknown
    remainingFreeStories?: unknown
    dailyQuotaLimit?: unknown
    dailyQuotaUsed?: unknown
    remainingDailyStories?: unknown
    dailyQuotaDateKst?: unknown
  }

  const freeStoryQuotaTotal = normalizeNonNegativeInteger(quotaCandidate.freeStoryQuotaTotal)
  const freeStoryQuotaUsed = normalizeNonNegativeInteger(quotaCandidate.freeStoryQuotaUsed)
  const remainingFreeStories = normalizeNonNegativeInteger(quotaCandidate.remainingFreeStories)
  const dailyQuotaLimit =
    typeof quotaCandidate.dailyQuotaLimit === 'number' ? normalizeNonNegativeInteger(quotaCandidate.dailyQuotaLimit) : quotaCandidate.dailyQuotaLimit === null ? null : null
  const dailyQuotaUsed = normalizeNonNegativeInteger(quotaCandidate.dailyQuotaUsed)
  const remainingDailyStories =
    typeof quotaCandidate.remainingDailyStories === 'number'
      ? normalizeNonNegativeInteger(quotaCandidate.remainingDailyStories)
      : quotaCandidate.remainingDailyStories === null
        ? null
        : null
  const dailyQuotaDateKst =
    typeof quotaCandidate.dailyQuotaDateKst === 'string' ? normalizeString(quotaCandidate.dailyQuotaDateKst) : quotaCandidate.dailyQuotaDateKst === null ? null : null

  if (
    freeStoryQuotaTotal === null ||
    freeStoryQuotaUsed === null ||
    remainingFreeStories === null ||
    dailyQuotaUsed === null ||
    typeof dailyQuotaLimit === 'undefined' ||
    typeof remainingDailyStories === 'undefined' ||
    typeof dailyQuotaDateKst === 'undefined'
  ) {
    return null
  }

  const normalizedSubscription = (() => {
    if (!candidate.subscription || typeof candidate.subscription !== 'object') {
      return null
    }

    const rawSubscription = candidate.subscription as {
      status?: unknown
      planCode?: unknown
      trialStartAt?: unknown
      trialEndAt?: unknown
      currentPeriodStart?: unknown
      currentPeriodEnd?: unknown
      providerCustomerId?: unknown
      providerSubscriptionId?: unknown
    }

    if (
      rawSubscription.status !== 'trialing' &&
      rawSubscription.status !== 'active' &&
      rawSubscription.status !== 'past_due' &&
      rawSubscription.status !== 'canceled' &&
      rawSubscription.status !== 'incomplete' &&
      rawSubscription.status !== 'unpaid'
    ) {
      return null
    }

    const status = rawSubscription.status as BillingSubscriptionStatus

    return {
      status,
      planCode: normalizePaidPlanCode(rawSubscription.planCode),
      trialStartAt: normalizeString(rawSubscription.trialStartAt),
      trialEndAt: normalizeString(rawSubscription.trialEndAt),
      currentPeriodStart: normalizeString(rawSubscription.currentPeriodStart),
      currentPeriodEnd: normalizeString(rawSubscription.currentPeriodEnd),
      providerCustomerId: normalizeString(rawSubscription.providerCustomerId),
      providerSubscriptionId: normalizeString(rawSubscription.providerSubscriptionId),
    }
  })()

  if (!candidate.currentPlan || typeof candidate.currentPlan !== 'object') {
    return null
  }

  const currentPlanCandidate = candidate.currentPlan as {
    code?: unknown
    name?: unknown
  }
  const currentPlanCode = normalizePlanCode(currentPlanCandidate.code)
  const currentPlanName = normalizeString(currentPlanCandidate.name)
  if (!currentPlanCode || !currentPlanName) {
    return null
  }

  if (!Array.isArray(candidate.plans)) {
    return null
  }

  const normalizedPlans = candidate.plans
    .map((rawPlan) => {
      if (!rawPlan || typeof rawPlan !== 'object') {
        return null
      }

      const plan = rawPlan as {
        code?: unknown
        name?: unknown
        priceUsdMonthly?: unknown
        totalFreeStories?: unknown
        dailyQuota?: unknown
        trialDays?: unknown
      }

      const code = normalizePlanCode(plan.code)
      const name = normalizeString(plan.name)
      if (!code || !name || typeof plan.priceUsdMonthly !== 'number' || Number.isNaN(plan.priceUsdMonthly)) {
        return null
      }

      const totalFreeStories = typeof plan.totalFreeStories === 'number' ? normalizeNonNegativeInteger(plan.totalFreeStories) : undefined
      const dailyQuota = typeof plan.dailyQuota === 'number' ? normalizeNonNegativeInteger(plan.dailyQuota) : undefined
      const trialDays = typeof plan.trialDays === 'number' ? normalizeNonNegativeInteger(plan.trialDays) : undefined

      return {
        code,
        name,
        priceUsdMonthly: plan.priceUsdMonthly,
        ...(typeof totalFreeStories === 'number' ? { totalFreeStories } : {}),
        ...(typeof dailyQuota === 'number' ? { dailyQuota } : {}),
        ...(typeof trialDays === 'number' ? { trialDays } : {}),
      }
    })
    .filter((plan): plan is SubscriptionAccessSnapshot['plans'][number] => plan !== null)

  if (normalizedPlans.length === 0) {
    return null
  }

  return {
    subscription: normalizedSubscription,
    quota: {
      freeStoryQuotaTotal,
      freeStoryQuotaUsed,
      remainingFreeStories,
      dailyQuotaLimit,
      dailyQuotaUsed,
      remainingDailyStories,
      dailyQuotaDateKst,
    },
    currentPlan: {
      code: currentPlanCode,
      name: currentPlanName,
    },
    plans: normalizedPlans,
    canCreate: candidate.canCreate === true,
  }
}

function normalizeTrialStartResult(payload: unknown): TrialStartActionResult | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as {
    action?: unknown
    checkoutUrl?: unknown
    portalUrl?: unknown
    reason?: unknown
    message?: unknown
  }

  if (candidate.action === 'checkout') {
    const checkoutUrl = normalizeString(candidate.checkoutUrl)
    if (!checkoutUrl) {
      return null
    }

    return {
      action: 'checkout',
      checkoutUrl,
    }
  }

  if (candidate.action === 'portal') {
    const portalUrl = normalizeString(candidate.portalUrl)
    if (!portalUrl) {
      return null
    }

    return {
      action: 'portal',
      portalUrl,
    }
  }

  if (candidate.action === 'noop') {
    const reason = normalizeString(candidate.reason)
    if (!reason) {
      return null
    }
    const message = normalizeString(candidate.message)

    return {
      action: 'noop',
      reason,
      ...(message ? { message } : {}),
    }
  }

  return null
}

function normalizePortalResult(payload: unknown): SubscriptionPortalResult | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as {
    portalUrl?: unknown
  }

  const portalUrl = normalizeString(candidate.portalUrl)
  if (!portalUrl) {
    return null
  }

  return {
    portalUrl,
  }
}

export class HttpSubscriptionAccessPort implements SubscriptionAccessPort {
  private readonly baseUrl: string
  private readonly accessToken: string | null

  constructor(options: HttpSubscriptionAccessPortOptions = {}) {
    this.baseUrl = resolveApiBaseUrl(options.baseUrl)
    this.accessToken = options.accessToken ?? null
  }

  async getSnapshot(): Promise<SubscriptionAccessSnapshot> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/me`, {
      method: 'GET',
      headers: createJsonHeaders(this.accessToken),
    })

    if (!response.ok) {
      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      const message = parseApiErrorMessage(payload)
      throw new Error(
        message
          ? `Failed to fetch subscription snapshot (${response.status}): ${message}`
          : `Failed to fetch subscription snapshot: ${response.status}`,
      )
    }

    const normalized = normalizeSubscriptionSnapshot(await response.json())
    if (!normalized) {
      throw new Error('Invalid API response: subscription snapshot payload is missing.')
    }

    return normalized
  }

  async startTrial(planCode: BillingPaidPlanCode): Promise<TrialStartActionResult> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/trial/start`, {
      method: 'POST',
      headers: createJsonHeaders(this.accessToken),
      body: JSON.stringify({
        planCode,
      }),
    })

    if (!response.ok) {
      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      const message = parseApiErrorMessage(payload)
      throw new Error(
        message
          ? `Failed to start trial flow (${response.status}): ${message}`
          : `Failed to start trial flow: ${response.status}`,
      )
    }

    const normalized = normalizeTrialStartResult(await response.json())
    if (!normalized) {
      throw new Error('Invalid API response: trial start payload is missing.')
    }

    return normalized
  }

  async openPortal(): Promise<SubscriptionPortalResult> {
    const response = await fetch(`${this.baseUrl}/api/subscriptions/portal`, {
      method: 'POST',
      headers: createJsonHeaders(this.accessToken),
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      const message = parseApiErrorMessage(payload)
      throw new Error(
        message
          ? `Failed to open customer portal (${response.status}): ${message}`
          : `Failed to open customer portal: ${response.status}`,
      )
    }

    const normalized = normalizePortalResult(await response.json())
    if (!normalized) {
      throw new Error('Invalid API response: portal payload is missing.')
    }

    return normalized
  }
}
