import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../_shared/polar', () => ({
  createPolarCheckoutUrl: vi.fn(async () => 'https://polar.test/checkout/session'),
  createPolarCustomerPortalUrl: vi.fn(async () => 'https://polar.test/portal/session'),
  resolveCheckoutPlanConfig: vi.fn(() => ({
    productId: 'prod_standard',
    planCode: 'standard',
  })),
  resolveCheckoutUrls: vi.fn(() => ({
    successUrl: 'https://app.example.com/create?checkout=success',
    returnUrl: 'https://app.example.com/create?checkout=canceled',
  })),
  resolvePolarClient: vi.fn(() => ({})),
  resolvePortalReturnUrl: vi.fn(() => 'https://app.example.com/create'),
}))

import { onRequestPost } from './start'
import * as polarShared from '../../_shared/polar'

interface TestEnv {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ALLOW_INSECURE_TEST_TOKENS?: string
  POLAR_ACCESS_TOKEN?: string
  POLAR_MOCK_ALWAYS_SUCCESS?: string
  POLAR_PRODUCT_ID?: string
  POLAR_PRODUCT_ID_STANDARD?: string
  POLAR_PRODUCT_ID_PRO?: string
  POLAR_PLAN_CODE?: string
  POLAR_PLAN_CODE_STANDARD?: string
  POLAR_PLAN_CODE_PRO?: string
}

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function createAcceptedAgreementRowResponse(): Response {
  return createJsonResponse([
    {
      agreed_terms_of_service: true,
      agreed_adult_payer: true,
      agreed_no_direct_child_data_collection: true,
      required_agreements_version: '2026-02-24',
      required_agreements_accepted_at: '2026-02-24T10:00:00.000Z',
    },
  ])
}

function createContext({
  userId = 'user-1',
  withAuthorization = true,
  planCode = 'standard',
  envOverrides = {},
}: {
  userId?: string
  withAuthorization?: boolean
  planCode?: 'standard' | 'pro'
  envOverrides?: Partial<TestEnv>
}) {
  const headers = new Headers()
  if (withAuthorization) {
    headers.set('Authorization', `Bearer test-user:${userId}`)
  }

  return {
    request: new Request('https://example.test/api/subscriptions/trial/start', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        planCode,
      }),
    }),
    env: {
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      ALLOW_INSECURE_TEST_TOKENS: '1',
      POLAR_ACCESS_TOKEN: 'polar_access_token',
      POLAR_PRODUCT_ID_STANDARD: 'prod_standard',
      POLAR_PRODUCT_ID_PRO: 'prod_pro',
      POLAR_PLAN_CODE_STANDARD: 'standard',
      POLAR_PLAN_CODE_PRO: 'pro',
      ...envOverrides,
    },
  } as unknown as Parameters<typeof onRequestPost>[0]
}

describe('POST /api/subscriptions/trial/start', () => {
  const mockedCreatePolarCheckoutUrl = vi.mocked(polarShared.createPolarCheckoutUrl)
  const mockedCreatePolarCustomerPortalUrl = vi.mocked(polarShared.createPolarCustomerPortalUrl)
  const mockedResolvePolarClient = vi.mocked(polarShared.resolvePolarClient)
  const mockedResolveCheckoutPlanConfig = vi.mocked(polarShared.resolveCheckoutPlanConfig)

  beforeEach(() => {
    mockedResolvePolarClient.mockReset()
    mockedCreatePolarCheckoutUrl.mockReset()
    mockedCreatePolarCustomerPortalUrl.mockReset()
    mockedResolveCheckoutPlanConfig.mockReset()
    mockedResolvePolarClient.mockReturnValue({} as never)
    mockedCreatePolarCheckoutUrl.mockResolvedValue('https://polar.test/checkout/session')
    mockedCreatePolarCustomerPortalUrl.mockResolvedValue('https://polar.test/portal/session')
    mockedResolveCheckoutPlanConfig.mockReturnValue({
      productId: 'prod_standard',
      planCode: 'standard',
    })
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

  it('active 사용자면 trial 시작 대신 portal URL을 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/account_profiles?') && method === 'GET') {
        return createAcceptedAgreementRowResponse()
      }

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
    const payload = (await response.json()) as { action?: string; portalUrl?: string }
    expect(payload).toEqual({
      action: 'portal',
      portalUrl: 'https://polar.test/portal/session',
    })
    expect(mockedCreatePolarCustomerPortalUrl).toHaveBeenCalledTimes(1)
    expect(mockedCreatePolarCheckoutUrl).not.toHaveBeenCalled()
  })

  it('미구독 사용자면 checkout URL을 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/account_profiles?') && method === 'GET') {
        return createAcceptedAgreementRowResponse()
      }

      if (url.includes('/rest/v1/subscriptions?') && method === 'GET') {
        return createJsonResponse([])
      }

      if (url.includes('/rest/v1/usage_quotas?') && method === 'GET') {
        return createJsonResponse([])
      }

      if (url.endsWith('/rest/v1/usage_quotas') && method === 'POST') {
        return createJsonResponse({}, 201)
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(createContext({ userId: 'user-new', planCode: 'pro' }))

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { action?: string; checkoutUrl?: string }
    expect(payload).toEqual({
      action: 'checkout',
      checkoutUrl: 'https://polar.test/checkout/session',
    })
    expect(mockedCreatePolarCheckoutUrl).toHaveBeenCalledTimes(1)
    expect(mockedResolveCheckoutPlanConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        POLAR_PRODUCT_ID_STANDARD: 'prod_standard',
        POLAR_PRODUCT_ID_PRO: 'prod_pro',
      }),
      'pro',
    )
    expect(mockedCreatePolarCustomerPortalUrl).not.toHaveBeenCalled()
  })

  it('목업 모드면 Polar 호출 없이 항상 checkout=success URL을 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/account_profiles?') && method === 'GET') {
        return createAcceptedAgreementRowResponse()
      }

      if (url.includes('/rest/v1/subscriptions?') && method === 'GET') {
        return createJsonResponse([])
      }

      if (url.includes('/rest/v1/usage_quotas?') && method === 'GET') {
        return createJsonResponse([])
      }

      if (url.endsWith('/rest/v1/usage_quotas') && method === 'POST') {
        return createJsonResponse({}, 201)
      }

      if (url.includes('/rest/v1/subscriptions?on_conflict=user_id') && method === 'POST') {
        return createJsonResponse({}, 201)
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createContext({
        userId: 'user-mock-checkout',
        planCode: 'pro',
        envOverrides: {
          POLAR_MOCK_ALWAYS_SUCCESS: '1',
          POLAR_ACCESS_TOKEN: undefined,
        },
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { action?: string; checkoutUrl?: string }
    expect(payload.action).toBe('checkout')
    expect(payload.checkoutUrl).toContain('/create?checkout=success')
    expect(payload.checkoutUrl).toContain('mock_polar=1')
    expect(payload.checkoutUrl).toContain('plan=pro')
    expect(mockedCreatePolarCheckoutUrl).not.toHaveBeenCalled()
  })

  it('필수 약관 동의가 없으면 403을 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/account_profiles?') && method === 'GET') {
        return createJsonResponse([
          {
            agreed_terms_of_service: true,
            agreed_adult_payer: false,
            agreed_no_direct_child_data_collection: true,
            required_agreements_version: '2026-02-24',
            required_agreements_accepted_at: null,
          },
        ])
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(createContext({ userId: 'user-missing-agreements' }))

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { code?: string; error?: string; message?: string }
    expect(payload.code).toBe('REQUIRED_AGREEMENTS_NOT_ACCEPTED')
    expect(payload.error).toBe('REQUIRED_AGREEMENTS_NOT_ACCEPTED')
    expect(payload.message).toBe('Required agreements are not accepted.')
    expect(mockedCreatePolarCheckoutUrl).not.toHaveBeenCalled()
    expect(mockedCreatePolarCustomerPortalUrl).not.toHaveBeenCalled()
  })
})
