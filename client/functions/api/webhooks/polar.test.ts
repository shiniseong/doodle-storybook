import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@polar-sh/sdk/webhooks', () => {
  class MockWebhookVerificationError extends Error {}

  return {
    WebhookVerificationError: MockWebhookVerificationError,
    validateEvent: vi.fn(),
  }
})

import { WebhookVerificationError, validateEvent } from '@polar-sh/sdk/webhooks'

import { onRequestPost } from './polar'

interface TestEnv {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  POLAR_WEBHOOK_SECRET?: string
  POLAR_PLAN_CODE?: string
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
  eventId = 'evt_1',
  body = '{"type":"subscription.updated"}',
  envOverrides = {},
}: {
  eventId?: string
  body?: string
  envOverrides?: Partial<TestEnv>
}) {
  return {
    request: new Request('https://example.test/api/webhooks/polar', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'webhook-id': eventId,
        'webhook-timestamp': '1700000000',
        'webhook-signature': 'v1,test-signature',
      },
      body,
    }),
    env: {
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      POLAR_WEBHOOK_SECRET: 'whsec_test',
      POLAR_PLAN_CODE: 'monthly_unlimited_6900_krw',
      ...envOverrides,
    },
  } as unknown as Parameters<typeof onRequestPost>[0]
}

describe('POST /api/webhooks/polar', () => {
  const mockedValidateEvent = vi.mocked(validateEvent)

  beforeEach(() => {
    mockedValidateEvent.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('서명 검증에 실패하면 403을 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/polar_webhook_events?') && method === 'GET') {
        return createJsonResponse([])
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    mockedValidateEvent.mockImplementation(() => {
      throw new WebhookVerificationError('invalid signature')
    })

    const response = await onRequestPost(createContext({ eventId: 'evt_invalid_sig' }))

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('Invalid webhook signature.')
  })

  it('이미 처리된 이벤트면 중복 처리 없이 202를 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/polar_webhook_events?') && method === 'GET') {
        return createJsonResponse([
          {
            event_id: 'evt_duplicate',
          },
        ])
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(createContext({ eventId: 'evt_duplicate' }))

    expect(response.status).toBe(202)
    const payload = (await response.json()) as { received?: boolean; duplicate?: boolean }
    expect(payload).toEqual({
      received: true,
      duplicate: true,
    })
    expect(mockedValidateEvent).not.toHaveBeenCalled()
  })

  it('subscription 이벤트를 upsert하고 처리 마커를 기록한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/polar_webhook_events?') && method === 'GET') {
        return createJsonResponse([])
      }

      if (url.includes('/rest/v1/subscriptions?on_conflict=user_id') && method === 'POST') {
        return createJsonResponse({}, 201)
      }

      if (url.endsWith('/rest/v1/polar_webhook_events') && method === 'POST') {
        return createJsonResponse({}, 201)
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    mockedValidateEvent.mockReturnValue({
      type: 'subscription.active',
      timestamp: new Date('2026-02-22T00:00:00.000Z'),
      data: {
        id: 'sub_123',
        status: 'active',
        customerId: 'cus_123',
        trialStart: new Date('2026-02-22T00:00:00.000Z'),
        trialEnd: new Date('2026-02-23T00:00:00.000Z'),
        currentPeriodStart: new Date('2026-02-23T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-03-23T00:00:00.000Z'),
        metadata: {
          planCode: 'monthly_unlimited_6900_krw',
        },
        customer: {
          externalId: 'user-1',
        },
      },
    } as never)

    const response = await onRequestPost(createContext({ eventId: 'evt_subscription_active' }))

    expect(response.status).toBe(202)
    const payload = (await response.json()) as { received?: boolean }
    expect(payload.received).toBe(true)

    const subscriptionUpsertCall = fetchMock.mock.calls.find((call) => {
      const input = call[0] as RequestInfo | URL
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String((call[1] as RequestInit | undefined)?.method ?? 'GET').toUpperCase()
      return url.includes('/rest/v1/subscriptions?on_conflict=user_id') && method === 'POST'
    })

    expect(subscriptionUpsertCall).toBeDefined()
    const upsertBody = JSON.parse(String((subscriptionUpsertCall?.[1] as RequestInit | undefined)?.body ?? '{}')) as {
      user_id?: string
      provider?: string
      status?: string
      plan_code?: string
      provider_customer_id?: string | null
      provider_subscription_id?: string | null
      last_webhook_event_id?: string
    }
    expect(upsertBody.user_id).toBe('user-1')
    expect(upsertBody.provider).toBe('polar')
    expect(upsertBody.status).toBe('active')
    expect(upsertBody.plan_code).toBe('monthly_unlimited_6900_krw')
    expect(upsertBody.provider_customer_id).toBe('cus_123')
    expect(upsertBody.provider_subscription_id).toBe('sub_123')
    expect(upsertBody.last_webhook_event_id).toBe('evt_subscription_active')
  })
})
