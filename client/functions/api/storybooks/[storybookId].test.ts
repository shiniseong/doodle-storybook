import { afterEach, describe, expect, it, vi } from 'vitest'

import { onRequestDelete, onRequestGet } from './[storybookId]'

interface TestEnv {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  CLOUDFLARE_R2_PUBLIC_BASE_URL?: string
  R2_PUBLIC_BASE_URL?: string
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
  requestUrl,
  storybookId,
  envOverrides = {},
}: {
  requestUrl: string
  storybookId?: string
  envOverrides?: Partial<TestEnv>
}) {
  return {
    request: new Request(requestUrl, {
      method: 'GET',
    }),
    params: storybookId ? { storybookId } : {},
    env: {
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
      ...envOverrides,
    },
  } as unknown as Parameters<typeof onRequestGet>[0]
}

function createDeleteContext({
  requestUrl,
  storybookId,
  envOverrides = {},
}: {
  requestUrl: string
  storybookId?: string
  envOverrides?: Partial<TestEnv>
}) {
  return {
    request: new Request(requestUrl, {
      method: 'DELETE',
    }),
    params: storybookId ? { storybookId } : {},
    env: {
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
      ...envOverrides,
    },
  } as unknown as Parameters<typeof onRequestDelete>[0]
}

describe('storybook detail function', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('상세 조회 성공 시 storybook/details/ebook를 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/rest/v1/storybooks?')) {
        return createJsonResponse([
          {
            id: 'storybook-1',
            title: '달빛 숲',
            author_name: '도담',
            description: '토끼가 숲길을 달려요',
            origin_image_r2_key: 'user-1/storybook-1/images/origin',
            cover_image_r2_key: 'user-1/storybook-1/images/cover',
            highlight_image_r2_key: 'user-1/storybook-1/images/highlight',
            end_image_r2_key: 'user-1/storybook-1/images/end',
            created_at: '2026-02-22T04:00:00.000Z',
          },
        ])
      }

      if (url.includes('/rest/v1/storybook_origin_details?')) {
        return createJsonResponse([
          {
            page_index: 0,
            drawing_image_r2_key: 'user-1/storybook-1/images/origin',
            description: '원본 설명',
          },
        ])
      }

      if (url.includes('/rest/v1/storybook_output_details?')) {
        return createJsonResponse([
          {
            page_index: 0,
            page_type: 'cover',
            title: '달빛 숲',
            content: '토끼가 숲길을 달려요',
            image_r2_key: 'user-1/storybook-1/images/cover',
            audio_r2_key: null,
            is_highlight: false,
          },
          {
            page_index: 1,
            page_type: 'story',
            title: null,
            content: '첫 장면',
            image_r2_key: null,
            audio_r2_key: 'user-1/storybook-1/tts/p1',
            is_highlight: false,
          },
          {
            page_index: 2,
            page_type: 'story',
            title: null,
            content: '강조 장면',
            image_r2_key: 'user-1/storybook-1/images/highlight',
            audio_r2_key: 'user-1/storybook-1/tts/p2',
            is_highlight: true,
          },
        ])
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet(
      createGetContext({
        requestUrl: 'https://example.test/api/storybooks/storybook-1?userId=user-1',
        storybookId: 'storybook-1',
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      storybookId: string
      storybook: {
        title: string
        authorName: string | null
        originImageUrl: string | null
      }
      details: {
        origin: Array<{
          pageIndex: number
          drawingImageUrl: string | null
        }>
        output: Array<{
          pageIndex: number
          pageType: 'cover' | 'story'
          audioUrl: string | null
        }>
      }
      ebook: {
        title: string
        coverImageUrl: string | null
        highlightImageUrl: string | null
        finalImageUrl: string | null
        pages: Array<{ page: number; content: string; isHighlight: boolean }>
        narrations: Array<{ page: number; audioDataUrl: string }>
      }
    }

    expect(payload.storybookId).toBe('storybook-1')
    expect(payload.storybook.title).toBe('달빛 숲')
    expect(payload.storybook.authorName).toBe('도담')
    expect(payload.storybook.originImageUrl).toBe('https://cdn.example.com/user-1/storybook-1/images/origin')
    expect(payload.details.origin).toEqual([
      {
        pageIndex: 0,
        drawingImageUrl: 'https://cdn.example.com/user-1/storybook-1/images/origin',
        description: '원본 설명',
      },
    ])
    expect(payload.details.output).toHaveLength(3)
    expect(payload.details.output[1]).toEqual({
      pageIndex: 1,
      pageType: 'story',
      title: null,
      content: '첫 장면',
      imageUrl: null,
      audioUrl: 'https://cdn.example.com/user-1/storybook-1/tts/p1',
      isHighlight: false,
    })

    expect(payload.ebook.title).toBe('달빛 숲')
    expect(payload.ebook.coverImageUrl).toBe('https://cdn.example.com/user-1/storybook-1/images/cover')
    expect(payload.ebook.highlightImageUrl).toBe('https://cdn.example.com/user-1/storybook-1/images/highlight')
    expect(payload.ebook.finalImageUrl).toBe('https://cdn.example.com/user-1/storybook-1/images/end')
    expect(payload.ebook.pages).toEqual([
      { page: 1, content: '첫 장면', isHighlight: false },
      { page: 2, content: '강조 장면', isHighlight: true },
    ])
    expect(payload.ebook.narrations).toEqual([
      { page: 1, audioDataUrl: 'https://cdn.example.com/user-1/storybook-1/tts/p1' },
      { page: 2, audioDataUrl: 'https://cdn.example.com/user-1/storybook-1/tts/p2' },
    ])
  })

  it('userId가 없으면 400을 반환한다', async () => {
    const response = await onRequestGet(
      createGetContext({
        requestUrl: 'https://example.test/api/storybooks/storybook-1',
        storybookId: 'storybook-1',
      }),
    )

    expect(response.status).toBe(400)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('userId query parameter is required.')
  })

  it('스토리북이 없으면 404를 반환한다', async () => {
    const fetchMock = vi.fn(async () => createJsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet(
      createGetContext({
        requestUrl: 'https://example.test/api/storybooks/storybook-missing?userId=user-1',
        storybookId: 'storybook-missing',
      }),
    )

    expect(response.status).toBe(404)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('Storybook not found.')
  })

  it('Supabase 조회 실패 시 502를 반환한다', async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse(
        {
          message: 'permission denied',
        },
        500,
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet(
      createGetContext({
        requestUrl: 'https://example.test/api/storybooks/storybook-1?userId=user-1',
        storybookId: 'storybook-1',
      }),
    )

    expect(response.status).toBe(502)
    const payload = (await response.json()) as { error?: string; detail?: string }
    expect(payload.error).toBe('Failed to fetch storybook detail.')
    expect(payload.detail).toContain('permission denied')
  })

  it('삭제 요청 성공 시 204를 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/rest/v1/storybooks?') && init?.method === 'GET') {
        return createJsonResponse([
          {
            id: 'storybook-1',
            title: '달빛 숲',
            author_name: '도담',
            description: '토끼가 숲길을 달려요',
            origin_image_r2_key: 'user-1/storybook-1/images/origin',
            cover_image_r2_key: 'user-1/storybook-1/images/cover',
            highlight_image_r2_key: 'user-1/storybook-1/images/highlight',
            end_image_r2_key: 'user-1/storybook-1/images/end',
            created_at: '2026-02-22T04:00:00.000Z',
          },
        ])
      }

      if (url.includes('/rest/v1/storybook_output_details?') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }

      if (url.includes('/rest/v1/storybook_origin_details?') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }

      if (url.includes('/rest/v1/storybooks?') && init?.method === 'DELETE') {
        return new Response(null, { status: 204 })
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestDelete(
      createDeleteContext({
        requestUrl: 'https://example.test/api/storybooks/storybook-1?userId=user-1',
        storybookId: 'storybook-1',
      }),
    )

    expect(response.status).toBe(204)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('삭제 요청에서 userId가 없으면 400을 반환한다', async () => {
    const response = await onRequestDelete(
      createDeleteContext({
        requestUrl: 'https://example.test/api/storybooks/storybook-1',
        storybookId: 'storybook-1',
      }),
    )

    expect(response.status).toBe(400)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('userId query parameter is required.')
  })
})
