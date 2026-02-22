import { afterEach, describe, expect, it, vi } from 'vitest'

import { onRequestGet } from './me'

interface TestEnv {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ALLOW_INSECURE_TEST_TOKENS?: string
}

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function createContext({
  userId = 'user-1',
  withAuthorization = true,
  envOverrides = {},
}: {
  userId?: string
  withAuthorization?: boolean
  envOverrides?: Partial<TestEnv>
}) {
  const headers = new Headers()
  if (withAuthorization) {
    headers.set('Authorization', `Bearer test-user:${userId}`)
  }

  return {
    request: new Request('https://example.test/api/subscriptions/me', {
      method: 'GET',
      headers,
    }),
    env: {
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      ALLOW_INSECURE_TEST_TOKENS: '1',
      ...envOverrides,
    },
  } as unknown as Parameters<typeof onRequestGet>[0]
}

describe('GET /api/subscriptions/me', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Authorization 헤더가 없으면 401을 반환한다', async () => {
    const response = await onRequestGet(
      createContext({
        withAuthorization: false,
      }),
    )

    expect(response.status).toBe(401)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('Authorization Bearer token is required.')
  })

  it('현재 구독 + 무료 쿼터 + canCreate를 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/subscriptions?') && method === 'GET') {
        return createJsonResponse([
          {
            status: 'active',
            plan_code: 'monthly_unlimited_6900_krw',
            provider_customer_id: 'cus_123',
            provider_subscription_id: 'sub_123',
          },
        ])
      }

      if (url.includes('/rest/v1/usage_quotas?') && method === 'GET') {
        return createJsonResponse([
          {
            free_story_quota_total: 2,
            free_story_quota_used: 2,
            daily_story_quota_used: 4,
            daily_story_quota_date: '2026-02-22',
          },
        ])
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet(createContext({ userId: 'user-active' }))

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      subscription?: { status?: string; planCode?: string | null }
      quota?: { freeStoryQuotaTotal?: number; freeStoryQuotaUsed?: number; remainingFreeStories?: number }
      currentPlan?: { code?: string; name?: string }
      plans?: Array<{ code?: string }>
      canCreate?: boolean
    }
    expect(payload.subscription?.status).toBe('active')
    expect(payload.subscription?.planCode).toBe('standard')
    expect(payload.currentPlan).toEqual({ code: 'standard', name: 'Standard' })
    expect(payload.plans?.map((plan) => plan.code)).toEqual(['free', 'standard', 'pro'])
    expect(payload.quota?.freeStoryQuotaTotal).toBe(2)
    expect(payload.quota?.freeStoryQuotaUsed).toBe(2)
    expect(payload.quota?.remainingFreeStories).toBe(0)
    expect(payload.canCreate).toBe(true)
  })

  it('비구독 + 무료 쿼터 소진이면 canCreate=false를 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/subscriptions?') && method === 'GET') {
        return createJsonResponse([])
      }

      if (url.includes('/rest/v1/usage_quotas?') && method === 'GET') {
        return createJsonResponse([
          {
            free_story_quota_total: 2,
            free_story_quota_used: 2,
            daily_story_quota_used: 0,
            daily_story_quota_date: null,
          },
        ])
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet(createContext({ userId: 'user-exhausted' }))

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      canCreate?: boolean
      subscription?: unknown
      quota?: { remainingFreeStories?: number }
      currentPlan?: { code?: string }
    }
    expect(payload.subscription).toBeNull()
    expect(payload.quota?.remainingFreeStories).toBe(0)
    expect(payload.currentPlan?.code).toBe('free')
    expect(payload.canCreate).toBe(false)
  })
})
