import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../_shared/polar', () => ({
  createPolarCustomerPortalUrl: vi.fn(async () => 'https://polar.test/portal/session'),
  resolvePolarClient: vi.fn(() => ({})),
  resolvePortalReturnUrl: vi.fn(() => 'https://app.example.com/create'),
}))

import { onRequestPost } from './portal'
import * as polarShared from '../_shared/polar'

interface TestEnv {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ALLOW_INSECURE_TEST_TOKENS?: string
  POLAR_ACCESS_TOKEN?: string
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
    request: new Request('https://example.test/api/subscriptions/portal', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    }),
    env: {
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      ALLOW_INSECURE_TEST_TOKENS: '1',
      POLAR_ACCESS_TOKEN: 'polar_access_token',
      ...envOverrides,
    },
  } as unknown as Parameters<typeof onRequestPost>[0]
}

describe('POST /api/subscriptions/portal', () => {
  const mockedResolvePolarClient = vi.mocked(polarShared.resolvePolarClient)
  const mockedCreatePolarCustomerPortalUrl = vi.mocked(polarShared.createPolarCustomerPortalUrl)

  beforeEach(() => {
    mockedResolvePolarClient.mockReturnValue({} as never)
    mockedCreatePolarCustomerPortalUrl.mockResolvedValue('https://polar.test/portal/session')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Authorization 헤더가 없으면 401을 반환한다', async () => {
    const response = await onRequestPost(
      createContext({
        withAuthorization: false,
      }),
    )

    expect(response.status).toBe(401)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('Authorization Bearer token is required.')
  })

  it('구독 상태가 없으면 409를 반환한다', async () => {
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
            free_story_quota_used: 0,
          },
        ])
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(createContext({ userId: 'user-no-subscription' }))

    expect(response.status).toBe(409)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('No active billing profile found for this account.')
    expect(mockedCreatePolarCustomerPortalUrl).not.toHaveBeenCalled()
  })

  it('구독 상태가 있으면 portal URL을 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/subscriptions?') && method === 'GET') {
        return createJsonResponse([
          {
            status: 'active',
            plan_code: 'monthly_unlimited_6900_krw',
          },
        ])
      }

      if (url.includes('/rest/v1/usage_quotas?') && method === 'GET') {
        return createJsonResponse([
          {
            free_story_quota_total: 2,
            free_story_quota_used: 2,
          },
        ])
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(createContext({ userId: 'user-active' }))

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { portalUrl?: string }
    expect(payload.portalUrl).toBe('https://polar.test/portal/session')
    expect(mockedCreatePolarCustomerPortalUrl).toHaveBeenCalledTimes(1)
  })
})
