import { afterEach, describe, expect, it, vi } from 'vitest'

import { onRequestGet, onRequestPost } from './agreements'

interface TestEnv {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ALLOW_INSECURE_TEST_TOKENS?: string
  REQUIRED_AGREEMENTS_VERSION?: string
}

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function createGetContext({
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
    request: new Request('https://example.test/api/account/agreements', {
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

function createPostContext({
  body,
  userId = 'user-1',
  withAuthorization = true,
  envOverrides = {},
}: {
  body: unknown
  userId?: string
  withAuthorization?: boolean
  envOverrides?: Partial<TestEnv>
}) {
  const headers = new Headers({
    'Content-Type': 'application/json',
  })
  if (withAuthorization) {
    headers.set('Authorization', `Bearer test-user:${userId}`)
  }

  return {
    request: new Request('https://example.test/api/account/agreements', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
    env: {
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      ALLOW_INSECURE_TEST_TOKENS: '1',
      ...envOverrides,
    },
  } as unknown as Parameters<typeof onRequestPost>[0]
}

describe('GET/POST /api/account/agreements', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('Authorization 헤더가 없으면 401을 반환한다', async () => {
    const response = await onRequestGet(
      createGetContext({
        withAuthorization: false,
      }),
    )

    expect(response.status).toBe(401)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('Authorization Bearer token is required.')
  })

  it('GET은 동의 이력이 없으면 기본 미동의 상태를 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/account_profiles?') && method === 'GET') {
        return createJsonResponse([])
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet(createGetContext({ userId: 'user-no-agreement' }))

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      hasAcceptedRequiredAgreements: boolean
      agreements: {
        termsOfService: boolean
        adultPayer: boolean
        noDirectChildDataCollection: boolean
      }
      acceptedAt: string | null
      requiredVersion: string
    }

    expect(payload).toEqual({
      requiredVersion: '2026-02-24',
      hasAcceptedRequiredAgreements: false,
      agreements: {
        termsOfService: false,
        adultPayer: false,
        noDirectChildDataCollection: false,
      },
      acceptedAt: null,
    })
  })

  it('운영 버전이 변경되면 기존 버전 동의는 미동의로 판정한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()

      if (url.includes('/rest/v1/account_profiles?') && method === 'GET') {
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

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet(
      createGetContext({
        userId: 'user-old-version',
        envOverrides: {
          REQUIRED_AGREEMENTS_VERSION: '2026-03-01',
        },
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      requiredVersion: string
      hasAcceptedRequiredAgreements: boolean
      agreements: {
        termsOfService: boolean
        adultPayer: boolean
        noDirectChildDataCollection: boolean
      }
      acceptedAt: string | null
    }

    expect(payload).toEqual({
      requiredVersion: '2026-03-01',
      hasAcceptedRequiredAgreements: false,
      agreements: {
        termsOfService: true,
        adultPayer: true,
        noDirectChildDataCollection: true,
      },
      acceptedAt: '2026-02-24T10:00:00.000Z',
    })
  })

  it('POST는 3개 필수 동의가 모두 true면 저장하고 상태를 반환한다', async () => {
    const authorizationHeaders: string[] = []
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = String(init?.method ?? 'GET').toUpperCase()
      const authorization = new Headers(init?.headers).get('Authorization')
      if (authorization) {
        authorizationHeaders.push(authorization)
      }

      if (url.includes('/rest/v1/account_profiles?on_conflict=user_id') && method === 'POST') {
        return createJsonResponse({}, 201)
      }

      if (url.includes('/rest/v1/account_profiles?') && method === 'GET') {
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

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createPostContext({
        userId: 'user-accepted',
        body: {
          termsOfService: true,
          adultPayer: true,
          noDirectChildDataCollection: true,
        },
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      hasAcceptedRequiredAgreements: boolean
      agreements: {
        termsOfService: boolean
        adultPayer: boolean
        noDirectChildDataCollection: boolean
      }
      acceptedAt: string | null
      requiredVersion: string
    }

    expect(payload).toEqual({
      requiredVersion: '2026-02-24',
      hasAcceptedRequiredAgreements: true,
      agreements: {
        termsOfService: true,
        adultPayer: true,
        noDirectChildDataCollection: true,
      },
      acceptedAt: '2026-02-24T10:00:00.000Z',
    })
    expect(authorizationHeaders.length).toBeGreaterThan(0)
    expect(authorizationHeaders.every((value) => value === 'Bearer test-user:user-accepted')).toBe(true)
  })

  it('POST는 필수 동의가 하나라도 false면 400을 반환한다', async () => {
    const response = await onRequestPost(
      createPostContext({
        body: {
          termsOfService: true,
          adultPayer: false,
          noDirectChildDataCollection: true,
        },
      }),
    )

    expect(response.status).toBe(400)
    const payload = (await response.json()) as { code?: string; error?: string }
    expect(payload.code).toBe('REQUIRED_AGREEMENTS_NOT_ACCEPTED')
    expect(payload.error).toBe('All required agreements must be accepted.')
  })
})
