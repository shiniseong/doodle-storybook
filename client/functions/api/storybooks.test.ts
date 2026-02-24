import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { onRequestGet, onRequestPost, parsePromptStorybookOutput } from './storybooks'

interface TestEnv {
  OPENAI_API_KEY: string
  OPENAI_PROMPT_ID?: string
  OPENAI_PROMPT_VERSION?: string
  OPENAI_IMAGE_MODEL?: string
  OPENAI_TTS_MODEL?: string
  OPENAI_TTS_VOICE?: string
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  ALLOW_INSECURE_TEST_TOKENS?: string
  CLOUDFLARE_R2_PUBLIC_BASE_URL?: string
  R2_PUBLIC_BASE_URL?: string
  STORYBOOK_ASSETS_BUCKET?: {
    put: (
      key: string,
      value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
      options?: {
        httpMetadata?: {
          contentType?: string
          cacheControl?: string
        }
        customMetadata?: Record<string, string>
      },
    ) => Promise<unknown>
  }
}

const encoder = new TextEncoder()

function createJsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

function createAudioResponse(seed: string): Response {
  return new Response(encoder.encode(seed), {
    status: 200,
    headers: {
      'Content-Type': 'audio/mpeg',
    },
  })
}

function createStoryPromptSchemaOutput() {
  return {
    language: 'korean',
    title: '별빛 숲의 비밀',
    description: '작은 토끼가 별빛 숲에서 친구를 만나는 이야기',
    highlightPage: 7,
    characters: [
      { id: 'p1', name: '토비', prompt: '작은 흰 토끼, 파란 목도리, 둥근 눈' },
      { id: 'p2', name: '루미', prompt: '반짝이는 작은 새, 노란 깃털, 둥근 날개' },
    ],
    pages: Array.from({ length: 10 }, (_, index) => {
      const page = index + 1
      return {
        page,
        content: `${page}페이지 본문 내용`,
      }
    }),
    imagePrompts: {
      common: {
        styleGuide: 'storybook illustration, soft light, clean outlines',
        world: 'moonlit forest with warm colors',
      },
      cover: 'cover prompt',
      highlight: 'highlight prompt',
      end: 'end prompt',
    },
  }
}

function createLegacyStoryPagesOutput() {
  return Array.from({ length: 10 }, (_, index) => {
    const page = index + 1
    return {
      page,
      content: `${page}페이지 본문 내용`,
      isHighlight: page === 6,
    }
  })
}

function resolveBillingSupabaseResponse(url: string, init?: RequestInit): Response | null {
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

  if (url.includes('/rest/v1/subscriptions?') && method === 'GET') {
    return createJsonResponse([], 200)
  }

  if (url.includes('/rest/v1/usage_quotas?') && method === 'GET') {
    return createJsonResponse([], 200)
  }

  if (url.endsWith('/rest/v1/usage_quotas') && method === 'POST') {
    return createJsonResponse({}, 201)
  }

  return null
}

function resolveTestUserId(payload: unknown): string {
  if (payload && typeof payload === 'object') {
    const candidate = payload as { userId?: unknown }
    if (typeof candidate.userId === 'string' && candidate.userId.trim().length > 0) {
      return candidate.userId.trim()
    }
  }

  return 'user-1'
}

function resolveTodayKstDateForTest(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function createContext(requestPayload: unknown, envOverrides: Partial<TestEnv> = {}) {
  const userId = resolveTestUserId(requestPayload)
  return {
    request: new Request('https://example.test/api/storybooks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer test-user:${userId}`,
      },
      body: JSON.stringify(requestPayload),
    }),
    env: {
      OPENAI_API_KEY: 'test-api-key',
      OPENAI_PROMPT_ID: 'pmpt_test',
      OPENAI_PROMPT_VERSION: '21',
      OPENAI_IMAGE_MODEL: 'gpt-image-1.5',
      OPENAI_TTS_MODEL: 'gpt-4o-mini-tts',
      OPENAI_TTS_VOICE: 'alloy',
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      ALLOW_INSECURE_TEST_TOKENS: '1',
      STORYBOOK_ASSETS_BUCKET: {
        put: async () => null,
      },
      ...envOverrides,
    },
  } as unknown as Parameters<typeof onRequestPost>[0]
}

function createGetContext(requestUrl: string, envOverrides: Partial<TestEnv> = {}) {
  const parsedUrl = new URL(requestUrl)
  const userId = (parsedUrl.searchParams.get('userId') || '').trim() || 'user-1'

  return {
    request: new Request(requestUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer test-user:${userId}`,
      },
    }),
    env: {
      OPENAI_API_KEY: 'test-api-key',
      OPENAI_PROMPT_ID: 'pmpt_test',
      OPENAI_PROMPT_VERSION: '21',
      OPENAI_IMAGE_MODEL: 'gpt-image-1.5',
      OPENAI_TTS_MODEL: 'gpt-4o-mini-tts',
      OPENAI_TTS_VOICE: 'alloy',
      SUPABASE_URL: 'https://supabase.test',
      SUPABASE_SECRET_KEY: 'sb_secret_test',
      ALLOW_INSECURE_TEST_TOKENS: '1',
      STORYBOOK_ASSETS_BUCKET: {
        put: async () => null,
      },
      ...envOverrides,
    },
  } as unknown as Parameters<typeof onRequestGet>[0]
}

describe('storybooks function (v21 pipeline)', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('v21 스키마를 파싱해 highlightPage를 isHighlight 플래그로 변환한다', () => {
    const schema = createStoryPromptSchemaOutput()
    const parsed = parsePromptStorybookOutput(JSON.stringify(schema))

    expect(parsed).not.toBeNull()
    expect(parsed?.characters).toHaveLength(2)
    expect(parsed?.characters[0]?.name).toBe('토비')
    expect(parsed?.pages).toHaveLength(10)
    expect(parsed?.ttsPages).toHaveLength(10)
    expect(parsed?.pages.filter((page) => page.isHighlight)).toHaveLength(1)
    expect(parsed?.pages.find((page) => page.page === schema.highlightPage)?.isHighlight).toBe(true)
    expect(parsed?.imagePrompts).toEqual({
      cover: 'cover prompt',
      highlight: 'highlight prompt',
      end: 'end prompt',
      commonStyleGuide: 'storybook illustration, soft light, clean outlines',
      commonWorld: 'moonlit forest with warm colors',
    })
  })

  it('characters 키 오타(charaters)도 허용해 파싱한다', () => {
    const schema = createStoryPromptSchemaOutput()
    const schemaWithTypo = {
      ...schema,
      charaters: schema.characters,
      characters: undefined,
    }

    const parsed = parsePromptStorybookOutput(JSON.stringify(schemaWithTypo))

    expect(parsed).not.toBeNull()
    expect(parsed?.characters).toHaveLength(2)
    expect(parsed?.characters[0]?.name).toBe('토비')
  })

  it('레거시 배열 응답도 파싱해 TTS와 이미지 프롬프트를 보완한다', () => {
    const parsed = parsePromptStorybookOutput(JSON.stringify(createLegacyStoryPagesOutput()), {
      title: '레거시 동화',
      description: '레거시 응답 스키마 테스트',
      language: 'ko',
    })

    expect(parsed).not.toBeNull()
    expect(parsed?.characters).toHaveLength(0)
    expect(parsed?.pages).toHaveLength(10)
    expect(parsed?.ttsPages).toHaveLength(10)
    expect(parsed?.pages.find((page) => page.page === 6)?.isHighlight).toBe(true)
    expect(parsed?.ttsPages[0]?.tts).toBe('1페이지 본문 내용')
    expect(parsed?.imagePrompts.cover.includes('레거시 동화')).toBe(true)
    expect(parsed?.imagePrompts.highlight.length).toBeGreaterThan(0)
    expect(parsed?.imagePrompts.end.length).toBeGreaterThan(0)
  })

  it('첫 프롬프트 응답 후 이미지 3장을 병렬 개별 요청으로 만들고 TTS 10과 함께 처리한다', async () => {
    const schema = createStoryPromptSchemaOutput()
    const ttsInputs: string[] = []
    const bucketPutMock = vi.fn(async () => null)
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://api.openai.com/v1/responses') {
        const requestBody = JSON.parse(String(init?.body ?? '{}')) as {
          prompt?: Record<string, unknown>
          input?: Array<{
            content?: Array<{
              type?: string
              text?: string
            }>
          }>
        }
        const inputTexts = (requestBody.input ?? [])
          .flatMap((item) => item.content ?? [])
          .filter((contentItem) => contentItem.type === 'input_text')
          .map((contentItem) => contentItem.text ?? '')
          .join('\n')

        expect(inputTexts).not.toContain('PRESERVE (DO NOT CHANGE):')
        expect(inputTexts).not.toContain('MANDATORY MEDIUM REQUIREMENT:')

        return createJsonResponse({
          id: 'resp-v9-1',
          prompt: {
            id: 'pmpt_test',
            version: '21',
          },
          output_text: JSON.stringify(schema),
        })
      }

      if (url === 'https://api.openai.com/v1/images/generations') {
        const requestBody = JSON.parse(String(init?.body)) as { prompt?: string; n?: number; size?: string }
        expect(requestBody.n).toBeUndefined()
        expect(requestBody.size).toBe('1024x1024')
        expect(requestBody.prompt).toContain('Output one full-frame image only')
        expect(requestBody.prompt).toContain('Do not create a collage')
        expect(requestBody.prompt).toContain(
          'Service context: This service creates high-quality children\'s storybooks from a child\'s drawing, the user\'s story title, and the user\'s story description.',
        )
        expect(requestBody.prompt).toContain('User-provided story title: 별빛 숲의 비밀')
        expect(requestBody.prompt).toContain('User-provided story description: 작은 토끼가 별빛 숲에서 친구를 만나는 이야기')
        expect(requestBody.prompt).toContain('Character consistency reference')
        expect(requestBody.prompt).toContain('[p1] 토비: 작은 흰 토끼, 파란 목도리, 둥근 눈')
        expect(requestBody.prompt).toContain('Main protagonist: 토비. Keep this protagonist as the clear visual focus.')
        expect(requestBody.prompt).toContain('Shared style guide: storybook illustration, soft light, clean outlines')
        expect(requestBody.prompt).toContain('Shared world setting: moonlit forest with warm colors')

        if (requestBody.prompt?.includes('Scene role: cover.')) {
          expect(requestBody.prompt).not.toContain('Target story page (highest-priority source of truth):')
          expect(requestBody.prompt).not.toContain('First principle (must follow): maximize fidelity to the target story page content for this request.')
          expect(requestBody.prompt).toContain('Scene description: cover prompt')
          return createJsonResponse({ data: [{ b64_json: 'Y292ZXItYjY0' }] })
        }

        if (requestBody.prompt?.includes('Scene role: highlight.')) {
          expect(requestBody.prompt).toContain(
            'First principle (must follow): maximize fidelity to the target story page content for this request.',
          )
          expect(requestBody.prompt).toContain(
            'If scene text, style hints, or previous visual assumptions conflict with target story page facts, target story page facts win.',
          )
          expect(requestBody.prompt).toContain(
            'Target story page (highest-priority source of truth): Page 7: 7페이지 본문 내용',
          )
          expect(requestBody.prompt).toContain('Scene description: highlight prompt')
          return createJsonResponse({ data: [{ b64_json: 'aGlnaGxpZ2h0LWI2NA==' }] })
        }

        if (requestBody.prompt?.includes('Scene role: end.')) {
          expect(requestBody.prompt).toContain(
            'First principle (must follow): maximize fidelity to the target story page content for this request.',
          )
          expect(requestBody.prompt).toContain(
            'If scene text, style hints, or previous visual assumptions conflict with target story page facts, target story page facts win.',
          )
          expect(requestBody.prompt).toContain(
            'Target story page (highest-priority source of truth): Page 10: 10페이지 본문 내용',
          )
          expect(requestBody.prompt).toContain('Scene description: end prompt')
          return createJsonResponse({ data: [{ b64_json: 'ZW5kLWI2NA==' }] })
        }

        throw new Error(`Unexpected scene role prompt: ${requestBody.prompt ?? '<missing>'}`)
      }

      if (url === 'https://api.openai.com/v1/audio/speech') {
        const requestBody = JSON.parse(String(init?.body)) as { input?: string }
        ttsInputs.push(requestBody.input ?? '')
        return createAudioResponse(`audio:${requestBody.input ?? ''}`)
      }

      if (url.includes('/rest/v1/account_profiles?')) {
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

      if (url.startsWith('https://supabase.test/rest/v1/')) {
        return createJsonResponse({}, 201)
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createContext({
        userId: 'user-1',
        language: 'ko',
        title: '별빛 숲의 비밀',
        description: '작은 토끼가 별빛 숲에서 친구를 만나는 이야기',
      }, {
          STORYBOOK_ASSETS_BUCKET: {
            put: bucketPutMock,
          },
          CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
        },
      ),
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(24)
    expect(bucketPutMock).toHaveBeenCalledTimes(14)

    const payload = (await response.json()) as {
      storybookId: string
      storybook: {
        title: string
        authorName: string | null
        originImageUrl: string | null
      }
      details: {
        output: Array<{
          pageIndex: number
          pageType: 'cover' | 'story'
          content: string | null
          imageUrl: string | null
          audioUrl: string | null
          isHighlight: boolean
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

    expect(payload.storybookId.length).toBeGreaterThan(0)
    expect(payload.storybook.title).toBe('별빛 숲의 비밀')
    expect(payload.storybook.authorName).toBeNull()
    expect(payload.storybook.originImageUrl).toContain('https://cdn.example.com/user-1/storybook-')
    expect(payload.ebook.title).toBe('별빛 숲의 비밀')
    expect(payload.ebook.coverImageUrl).toContain('https://cdn.example.com/user-1/storybook-')
    expect(payload.ebook.highlightImageUrl).toContain('https://cdn.example.com/user-1/storybook-')
    expect(payload.ebook.finalImageUrl).toContain('https://cdn.example.com/user-1/storybook-')
    expect(payload.ebook.pages).toHaveLength(10)
    expect(payload.ebook.pages.filter((page) => page.isHighlight)).toHaveLength(1)
    expect(payload.ebook.pages.find((page) => page.page === schema.highlightPage)?.isHighlight).toBe(true)
    expect(payload.ebook.narrations).toHaveLength(10)
    expect(payload.ebook.narrations.every((narration) => narration.audioDataUrl.startsWith('https://cdn.example.com/'))).toBe(true)
    expect(payload.details.output).toHaveLength(11)
    expect(ttsInputs).toEqual(schema.pages.map((page) => page.content))

    const storedKeys = bucketPutMock.mock.calls.map((call) => call[0] as string)
    expect(storedKeys.some((key) => /^user-1\/storybook-[^/]+\/images\/user-1-[^/]+-image-origin$/.test(key))).toBe(true)
    expect(storedKeys.some((key) => /^user-1\/storybook-[^/]+\/images\/user-1-[^/]+-image-cover$/.test(key))).toBe(true)
    expect(storedKeys.some((key) => /^user-1\/storybook-[^/]+\/images\/user-1-[^/]+-image-highlight$/.test(key))).toBe(true)
    expect(storedKeys.some((key) => /^user-1\/storybook-[^/]+\/images\/user-1-[^/]+-image-end$/.test(key))).toBe(true)
    expect(storedKeys.some((key) => /^user-1\/storybook-[^/]+\/tts\/user-1-[^/]+-tts-p1$/.test(key))).toBe(true)
    expect(storedKeys.some((key) => /^user-1\/storybook-[^/]+\/tts\/user-1-[^/]+-tts-p10$/.test(key))).toBe(true)

    const supabaseCalls = fetchMock.mock.calls.filter((call) => {
      const input = call[0] as RequestInfo | URL
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      return url.startsWith('https://supabase.test/rest/v1/')
    })
    expect(supabaseCalls.length).toBeGreaterThanOrEqual(6)
    expect(
      supabaseCalls.some((call) =>
        String(typeof call[0] === 'string' ? call[0] : call[0] instanceof URL ? call[0].toString() : call[0].url).includes(
          '/storybooks',
        ),
      ),
    ).toBe(true)
    expect(
      supabaseCalls.some((call) =>
        String(typeof call[0] === 'string' ? call[0] : call[0] instanceof URL ? call[0].toString() : call[0].url).includes(
          '/storybook_origin_details',
        ),
      ),
    ).toBe(true)
    expect(
      supabaseCalls.some((call) =>
        String(typeof call[0] === 'string' ? call[0] : call[0] instanceof URL ? call[0].toString() : call[0].url).includes(
          '/storybook_output_details',
        ),
      ),
    ).toBe(true)
  })

  it('제목이 @@!!TEST!!@@ 이면 OpenAI를 우회하고 mock 이미지/TTS URL로 응답 및 DB 저장을 수행한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/rest/v1/account_profiles?')) {
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

      if (url.startsWith('https://supabase.test/rest/v1/')) {
        return createJsonResponse({}, 201)
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const bucketPutMock = vi.fn(async () => null)
    const response = await onRequestPost(
      createContext(
        {
          userId: 'user-mock',
          language: 'ko',
          title: '@@!!TEST!!@@',
          description: '테스트 모드 생성 요청',
        },
        {
          OPENAI_API_KEY: '',
          STORYBOOK_ASSETS_BUCKET: undefined,
          CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
        },
      ),
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(10)
    expect(bucketPutMock).toHaveBeenCalledTimes(0)

    const payload = (await response.json()) as {
      storybookId: string
      details: {
        output: Array<{
          pageIndex: number
          pageType: 'cover' | 'story'
          imageUrl: string | null
          audioUrl: string | null
        }>
      }
      ebook: {
        pages: Array<{ page: number; content: string; isHighlight: boolean }>
        coverImageUrl: string | null
        highlightImageUrl: string | null
        finalImageUrl: string | null
        narrations: Array<{ page: number; audioDataUrl: string }>
      }
    }

    expect(payload.storybookId.length).toBeGreaterThan(0)
    expect(payload.ebook.pages).toHaveLength(10)
    expect(payload.ebook.pages[0]).toEqual({ page: 1, content: '테스트1', isHighlight: false })
    expect(payload.ebook.pages[5]).toEqual({ page: 6, content: '테스트6', isHighlight: true })
    expect(payload.ebook.pages[9]).toEqual({ page: 10, content: '테스트10', isHighlight: false })

    expect([
      payload.ebook.coverImageUrl,
      payload.ebook.highlightImageUrl,
      payload.ebook.finalImageUrl,
    ]).toEqual([
      'https://cdn.example.com/test/mock_generated_image.png',
      'https://cdn.example.com/test/mock_generated_image.png',
      'https://cdn.example.com/test/mock_generated_image.png',
    ])
    expect(payload.ebook.narrations).toHaveLength(10)
    expect(payload.ebook.narrations.every((narration) => narration.audioDataUrl === 'https://cdn.example.com/test/mock_generated_tts.mp3')).toBe(
      true,
    )
    expect(payload.details.output).toHaveLength(11)

    const calledUrls = fetchMock.mock.calls.map((call) => {
      const input = call[0] as RequestInfo | URL
      return typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    })

    expect(calledUrls.some((url) => url === 'https://api.openai.com/v1/responses')).toBe(false)
    expect(calledUrls.some((url) => url === 'https://api.openai.com/v1/images/generations')).toBe(false)
    expect(calledUrls.some((url) => url === 'https://api.openai.com/v1/audio/speech')).toBe(false)

    const outputInsertCall = fetchMock.mock.calls.find((call) => {
      const input = call[0] as RequestInfo | URL
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      return url.includes('/storybook_output_details')
    })
    expect(outputInsertCall).toBeDefined()
    const outputInsertBody = JSON.parse(String((outputInsertCall?.[1] as RequestInit)?.body ?? '[]')) as Array<{
      image_r2_key?: string | null
      audio_r2_key?: string | null
    }>
    expect(outputInsertBody.some((row) => row.image_r2_key === 'https://cdn.example.com/test/mock_generated_image.png')).toBe(true)
    expect(outputInsertBody.some((row) => row.audio_r2_key === 'https://cdn.example.com/test/mock_generated_tts.mp3')).toBe(true)
  })

  it('authorName이 전달되면 storybooks.author_name에 저장한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/rest/v1/account_profiles?')) {
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

      if (url.startsWith('https://supabase.test/rest/v1/')) {
        return createJsonResponse({}, 201)
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createContext(
        {
          userId: 'user-author',
          language: 'ko',
          title: '@@!!TEST!!@@',
          authorName: '홍길동',
          description: '작가명 저장 테스트',
        },
        {
          OPENAI_API_KEY: '',
          STORYBOOK_ASSETS_BUCKET: undefined,
          CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
        },
      ),
    )

    expect(response.status).toBe(200)
    const storybooksInsertCall = fetchMock.mock.calls.find((call) => {
      const input = call[0] as RequestInfo | URL
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      return url.includes('/storybooks')
    })
    expect(storybooksInsertCall).toBeDefined()
    const insertedRow = JSON.parse(String((storybooksInsertCall?.[1] as RequestInit)?.body ?? '{}')) as {
      author_name?: string | null
    }
    expect(insertedRow.author_name).toBe('홍길동')
  })

  it('제목이 @@!!TEST!!@@ 이고 mock base URL이 없으면 500 에러를 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const billingResponse = resolveBillingSupabaseResponse(url, init)
      if (billingResponse) {
        return billingResponse
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createContext(
        {
          userId: 'user-mock',
          language: 'ko',
          title: '@@!!TEST!!@@',
          description: 'mock mode',
        },
        {
          OPENAI_API_KEY: '',
          STORYBOOK_ASSETS_BUCKET: undefined,
          CLOUDFLARE_R2_PUBLIC_BASE_URL: '',
          R2_PUBLIC_BASE_URL: '',
        },
      ),
    )

    expect(response.status).toBe(500)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe(
      'CLOUDFLARE_R2_PUBLIC_BASE_URL (or R2_PUBLIC_BASE_URL) must be configured for @@!!TEST!!@@ mode.',
    )
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(
      fetchMock.mock.calls.every((call) => {
        const input = call[0] as RequestInfo | URL
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
        return (
          url.includes('/rest/v1/account_profiles?') ||
          url.includes('/rest/v1/subscriptions?') ||
          url.includes('/rest/v1/usage_quotas')
        )
      }),
    ).toBe(true)
  })

  it('GET /api/storybooks는 userId 기준 목록을 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      expect(url).toContain('/rest/v1/storybooks?')
      return createJsonResponse([
        {
          id: 'storybook-1',
          title: '별빛 모험',
          author_name: '도담',
          origin_image_r2_key: 'user-1/storybook-1/images/user-1-storybook-1-image-origin',
          created_at: '2026-02-22T04:00:00.000Z',
        },
      ])
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet(
      createGetContext('https://example.test/api/storybooks?userId=user-1&limit=5', {
        CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as {
      items?: Array<{
        storybookId: string
        title: string
        authorName: string | null
        originImageUrl: string | null
      }>
    }
    expect(payload.items).toEqual([
      {
        storybookId: 'storybook-1',
        title: '별빛 모험',
        authorName: '도담',
        originImageUrl: 'https://cdn.example.com/user-1/storybook-1/images/user-1-storybook-1-image-origin',
        createdAt: '2026-02-22T04:00:00.000Z',
      },
    ])
  })

  it('GET /api/storybooks는 Authorization 헤더가 없으면 401을 반환한다', async () => {
    const response = await onRequestGet({
      request: new Request('https://example.test/api/storybooks', {
        method: 'GET',
      }),
      env: {
        OPENAI_API_KEY: 'test-api-key',
        SUPABASE_URL: 'https://supabase.test',
        SUPABASE_SECRET_KEY: 'sb_secret_test',
      },
    } as unknown as Parameters<typeof onRequestGet>[0])

    expect(response.status).toBe(401)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('Authorization Bearer token is required.')
  })

  it('레거시 페이지 배열 응답이어도 이미지 3병렬 + TTS 10 파이프라인을 수행한다', async () => {
    const legacyOutput = createLegacyStoryPagesOutput()
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://api.openai.com/v1/responses') {
        return createJsonResponse({
          id: 'resp-legacy-1',
          output_text: JSON.stringify(legacyOutput),
        })
      }

      if (url === 'https://api.openai.com/v1/images/generations') {
        const requestBody = JSON.parse(String(init?.body ?? '')) as { prompt?: string; size?: string }
        expect(requestBody.size).toBe('1024x1024')
        if (requestBody.prompt?.includes('Scene role: cover.')) {
          return createJsonResponse({
            data: [{ b64_json: 'bGVnYWN5LWNvdmVy' }],
          })
        }
        if (requestBody.prompt?.includes('Scene role: highlight.')) {
          return createJsonResponse({
            data: [
              {
                b64_json: 'bGVnYWN5LWhpZ2hsaWdodA==',
              },
            ],
          })
        }
        if (requestBody.prompt?.includes('Scene role: end.')) {
          return createJsonResponse({
            data: [{ b64_json: 'bGVnYWN5LWVuZA==' }],
          })
        }
        throw new Error(`Unexpected scene role prompt: ${requestBody.prompt ?? '<missing>'}`)
      }

      if (url === 'https://api.openai.com/v1/audio/speech') {
        return createAudioResponse('legacy-audio')
      }

      if (url.includes('/rest/v1/account_profiles?')) {
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

      if (url.startsWith('https://supabase.test/rest/v1/')) {
        return createJsonResponse({}, 201)
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createContext(
        {
          userId: 'user-legacy',
          language: 'ko',
          title: '레거시 테스트',
          description: '레거시 응답도 처리되어야 함',
        },
        {
          CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
        },
      ),
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(24)

    const payload = (await response.json()) as {
      ebook: {
        pages: Array<{ page: number; content: string; isHighlight: boolean }>
        coverImageUrl: string | null
        highlightImageUrl: string | null
        finalImageUrl: string | null
        narrations: Array<{ page: number; audioDataUrl: string }>
      }
    }

    expect(payload.ebook.pages).toHaveLength(10)
    expect(payload.ebook.pages.find((page) => page.page === 6)?.isHighlight).toBe(true)
    expect(payload.ebook.coverImageUrl).not.toBeNull()
    expect(payload.ebook.highlightImageUrl).not.toBeNull()
    expect(payload.ebook.finalImageUrl).not.toBeNull()
    expect(payload.ebook.narrations).toHaveLength(10)
  })

  it('R2에 오리진/생성 이미지 및 TTS를 경로 규칙과 메타데이터로 저장한다', async () => {
    const schema = createStoryPromptSchemaOutput()
    const bucketPutMock = vi.fn(async () => null)

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://api.openai.com/v1/responses') {
        return createJsonResponse({
          id: 'resp-r2-save-1',
          prompt: {
            id: 'pmpt_test',
            version: '21',
          },
          output_text: JSON.stringify(schema),
        })
      }

      if (url === 'https://api.openai.com/v1/images/generations') {
        return createJsonResponse({ data: [{ b64_json: 'aW1hZ2U=' }] })
      }

      if (url === 'https://api.openai.com/v1/audio/speech') {
        return createAudioResponse('narration')
      }

      if (url.includes('/rest/v1/account_profiles?')) {
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

      if (url.startsWith('https://supabase.test/rest/v1/')) {
        return createJsonResponse({}, 201)
      }

      throw new Error(`Unexpected URL: ${url}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createContext(
        {
          userId: 'user-r2',
          language: 'ko',
          title: 'R2 저장 테스트',
          description: '저장 규칙을 검증한다',
          imageDataUrl: 'data:image/png;base64,b3JpZ2lu',
        },
        {
          STORYBOOK_ASSETS_BUCKET: {
            put: bucketPutMock,
          },
        },
      ),
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(24)
    expect(bucketPutMock).toHaveBeenCalledTimes(14)

    const imageCalls = bucketPutMock.mock.calls.filter((call) => String(call[0]).includes('/images/'))
    const ttsCalls = bucketPutMock.mock.calls.filter((call) => String(call[0]).includes('/tts/'))

    expect(imageCalls).toHaveLength(4)
    expect(ttsCalls).toHaveLength(10)

    const storedKeys = bucketPutMock.mock.calls.map((call) => call[0] as string)
    expect(storedKeys.some((key) => /^user-r2\/storybook-[^/]+\/images\/user-r2-[^/]+-image-origin$/.test(key))).toBe(true)
    expect(storedKeys.some((key) => /^user-r2\/storybook-[^/]+\/images\/user-r2-[^/]+-image-cover$/.test(key))).toBe(true)
    expect(storedKeys.some((key) => /^user-r2\/storybook-[^/]+\/images\/user-r2-[^/]+-image-highlight$/.test(key))).toBe(true)
    expect(storedKeys.some((key) => /^user-r2\/storybook-[^/]+\/images\/user-r2-[^/]+-image-end$/.test(key))).toBe(true)
    expect(storedKeys.some((key) => /^user-r2\/storybook-[^/]+\/tts\/user-r2-[^/]+-tts-p1$/.test(key))).toBe(true)
    expect(storedKeys.some((key) => /^user-r2\/storybook-[^/]+\/tts\/user-r2-[^/]+-tts-p10$/.test(key))).toBe(true)

    const originCall = bucketPutMock.mock.calls.find((call) => String(call[0]).endsWith('-image-origin'))
    const createdStoryBookId = (originCall?.[2] as { customMetadata?: { createdStoryBookId?: unknown } } | undefined)
      ?.customMetadata?.createdStoryBookId
    expect(originCall?.[2]).toEqual({
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        userId: 'user-r2',
        createdStoryBookId,
      },
    })
    expect(typeof createdStoryBookId).toBe('string')
    expect((createdStoryBookId as string).length).toBeGreaterThan(0)

    const ttsCall = bucketPutMock.mock.calls.find((call) => String(call[0]).endsWith('-tts-p1'))
    expect(ttsCall?.[2]).toEqual({
      httpMetadata: {
        contentType: 'audio/mpeg',
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        userId: 'user-r2',
        createdStoryBookId,
      },
    })
  })

  it('이미지 3병렬 + TTS 10 요청을 한 번에 시작한다', async () => {
    const schema = createStoryPromptSchemaOutput()
    const deferredRequests: Array<{
      url: string
      resolve: (response: Response) => void
      init?: RequestInit
    }> = []

    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url.includes('/rest/v1/account_profiles?')) {
        return Promise.resolve(
          createJsonResponse([
            {
              agreed_terms_of_service: true,
              agreed_adult_payer: true,
              agreed_no_direct_child_data_collection: true,
              required_agreements_version: '2026-02-24',
              required_agreements_accepted_at: '2026-02-24T10:00:00.000Z',
            },
          ]),
        )
      }

      if (url === 'https://api.openai.com/v1/responses') {
        return Promise.resolve(
          createJsonResponse({
            id: 'resp-v9-2',
            output_text: JSON.stringify(schema),
          }),
        )
      }

      if (url.startsWith('https://supabase.test/rest/v1/')) {
        return Promise.resolve(createJsonResponse({}, 201))
      }

      return new Promise<Response>((resolve) => {
        deferredRequests.push({
          url,
          resolve,
          init,
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const pendingResponse = onRequestPost(
      createContext({
        userId: 'user-2',
        language: 'ko',
        title: '동시성 테스트',
        description: '병렬 요청 확인',
      }),
    )

    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })

    expect(fetchMock).toHaveBeenCalledTimes(18)
    expect(deferredRequests).toHaveLength(13)

      deferredRequests.forEach((request, index) => {
        if (request.url === 'https://api.openai.com/v1/images/generations') {
          request.resolve(createJsonResponse({ data: [{ b64_json: 'aW1n' }] }))
          return
        }

      if (request.url === 'https://api.openai.com/v1/audio/speech') {
        request.resolve(createAudioResponse(`audio-${index}`))
        return
      }

      request.resolve(createJsonResponse({}))
    })

    const response = await pendingResponse
    expect(response.status).toBe(200)
  })

  it('v21 스키마가 아니면 502 에러를 반환한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const billingResponse = resolveBillingSupabaseResponse(url, init)
      if (billingResponse) {
        return billingResponse
      }

      if (url === 'https://api.openai.com/v1/responses') {
        return createJsonResponse({
          id: 'resp-invalid',
          output_text: JSON.stringify({
            pages: [{ page: 1, content: 'invalid' }],
          }),
        })
      }

      throw new Error('No downstream call should happen.')
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createContext({
        userId: 'user-3',
        language: 'ko',
        title: '오류 테스트',
        description: '스키마 오류',
      }),
    )

    expect(response.status).toBe(502)
    expect(fetchMock).toHaveBeenCalledTimes(5)

    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('Invalid storybook prompt output schema.')
  })

  it('이미지 3장 + TTS 10개가 완전 생성되지 않으면 502를 반환하고 DB 저장을 시도하지 않는다', async () => {
    const schema = createStoryPromptSchemaOutput()
    let ttsRequestCount = 0

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

      if (url === 'https://api.openai.com/v1/responses') {
        return createJsonResponse({
          id: 'resp-incomplete-media',
          output_text: JSON.stringify(schema),
        })
      }

      if (url === 'https://api.openai.com/v1/images/generations') {
        return createJsonResponse({ data: [{ b64_json: 'aW1hZ2U=' }] })
      }

      if (url === 'https://api.openai.com/v1/audio/speech') {
        ttsRequestCount += 1
        if (ttsRequestCount === 10) {
          return createJsonResponse({ error: { message: 'simulated tts failure' } }, 500)
        }
        return createAudioResponse(`audio-${ttsRequestCount}`)
      }

      if (url.includes('/rest/v1/account_profiles?')) {
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

      if (url.startsWith('https://supabase.test/rest/v1/')) {
        return createJsonResponse({}, 201)
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createContext({
        userId: 'user-incomplete-media',
        language: 'ko',
        title: '불완전 생성 테스트',
        description: 'TTS 일부 실패 시 저장 방지',
      }),
    )

    expect(response.status).toBe(502)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('Failed to generate complete media assets (requires 3 images and 10 TTS narrations).')

    const supabaseCalls = fetchMock.mock.calls.filter((call) => {
      const request = call[0] as RequestInfo | URL
      const url = typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url
      return url.startsWith('https://supabase.test/rest/v1/')
    })

    expect(supabaseCalls.length).toBeGreaterThanOrEqual(3)
  })

  it('필수 약관 동의가 없으면 403으로 생성을 차단한다', async () => {
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

    const response = await onRequestPost(
      createContext(
        {
          userId: 'user-missing-agreements',
          language: 'ko',
          title: '@@!!TEST!!@@',
          description: '동의 체크 테스트',
        },
        {
          OPENAI_API_KEY: '',
          STORYBOOK_ASSETS_BUCKET: undefined,
          CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
        },
      ),
    )

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { code?: string; error?: string; message?: string }
    expect(payload.code).toBe('REQUIRED_AGREEMENTS_NOT_ACCEPTED')
    expect(payload.error).toBe('REQUIRED_AGREEMENTS_NOT_ACCEPTED')
    expect(payload.message).toBe('Required agreements are not accepted.')
  })

  it('비구독 + 무료 쿼터 소진 상태면 동화 생성을 403으로 차단한다', async () => {
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

      if (url.includes('/rest/v1/subscriptions?') && method === 'GET') {
        return createJsonResponse([])
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

    const response = await onRequestPost(
      createContext(
        {
          userId: 'user-quota-exhausted',
          language: 'ko',
          title: '@@!!TEST!!@@',
          description: '쿼터 소진 생성 차단 테스트',
        },
        {
          OPENAI_API_KEY: '',
          STORYBOOK_ASSETS_BUCKET: undefined,
          CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
        },
      ),
    )

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { code?: string; error?: string; reason?: string; message?: string }
    expect(payload.code).toBe('QUOTA_EXCEEDED')
    expect(payload.error).toBe('QUOTA_EXCEEDED')
    expect(payload.reason).toBe('free_total')
    expect(payload.message).toContain('무료 제작 횟수를 모두 사용했어요')

    const calledUrls = fetchMock.mock.calls.map((call) => {
      const request = call[0] as RequestInfo | URL
      return typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url
    })
    expect(calledUrls.some((url) => url === 'https://api.openai.com/v1/responses')).toBe(false)
    expect(calledUrls.some((url) => url.includes('/rest/v1/storybooks'))).toBe(false)
  })

  it('active 구독 상태면 무료 쿼터가 소진되어도 동화 생성을 허용한다', async () => {
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

      if (url.includes('/rest/v1/subscriptions?') && method === 'GET') {
        return createJsonResponse([
          {
            status: 'active',
            plan_code: 'standard',
          },
        ])
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

      if (url.startsWith('https://supabase.test/rest/v1/storybooks')) {
        return createJsonResponse({}, 201)
      }

      if (url.startsWith('https://supabase.test/rest/v1/storybook_origin_details')) {
        return createJsonResponse({}, 201)
      }

      if (url.startsWith('https://supabase.test/rest/v1/storybook_output_details')) {
        return createJsonResponse({}, 201)
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createContext(
        {
          userId: 'user-active-quota-exhausted',
          language: 'ko',
          title: '@@!!TEST!!@@',
          description: '구독 활성화 시 생성 허용 테스트',
        },
        {
          OPENAI_API_KEY: '',
          STORYBOOK_ASSETS_BUCKET: undefined,
          CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
        },
      ),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { storybookId?: string }
    expect(typeof payload.storybookId).toBe('string')
    expect((payload.storybookId ?? '').length).toBeGreaterThan(0)
    expect(
      fetchMock.mock.calls.some((call) => {
        const request = call[0] as RequestInfo | URL
        const url = typeof request === 'string' ? request : request instanceof URL ? request.toString() : request.url
        const method = String((call[1] as RequestInit | undefined)?.method ?? 'GET').toUpperCase()
        return url.includes('/rest/v1/usage_quotas?user_id=eq.') && method === 'PATCH'
      }),
    ).toBe(true)
  })

  it('active 구독에서 일일 쿼터를 모두 쓰면 403 + daily_limit으로 차단한다', async () => {
    const todayKst = resolveTodayKstDateForTest()
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

      if (url.includes('/rest/v1/subscriptions?') && method === 'GET') {
        return createJsonResponse([
          {
            status: 'active',
            plan_code: 'standard',
          },
        ])
      }

      if (url.includes('/rest/v1/usage_quotas?') && method === 'GET') {
        return createJsonResponse([
          {
            free_story_quota_total: 2,
            free_story_quota_used: 0,
            daily_story_quota_used: 30,
            daily_story_quota_date: todayKst,
          },
        ])
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createContext(
        {
          userId: 'user-active-daily-exhausted',
          language: 'ko',
          title: '@@!!TEST!!@@',
          description: '일일 쿼터 소진 시 생성 차단',
        },
        {
          OPENAI_API_KEY: '',
          STORYBOOK_ASSETS_BUCKET: undefined,
          CLOUDFLARE_R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
        },
      ),
    )

    expect(response.status).toBe(403)
    const payload = (await response.json()) as { code?: string; error?: string; reason?: string }
    expect(payload.code).toBe('QUOTA_EXCEEDED')
    expect(payload.error).toBe('QUOTA_EXCEEDED')
    expect(payload.reason).toBe('daily_limit')
  })

  it('R2 버킷 바인딩이 없으면 500 에러를 반환한다', async () => {
    const response = await onRequestPost(
      createContext(
        {
          userId: 'user-missing-r2',
          language: 'ko',
          title: '버킷 없음',
          description: '버킷 바인딩이 필요하다',
        },
        {
          STORYBOOK_ASSETS_BUCKET: undefined,
        },
      ),
    )

    expect(response.status).toBe(500)
    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('STORYBOOK_ASSETS_BUCKET is not configured.')
  })

  it('R2 저장 실패 시 실패 키와 사유를 포함한 502 에러를 반환한다', async () => {
    const schema = createStoryPromptSchemaOutput()
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const billingResponse = resolveBillingSupabaseResponse(url, init)
      if (billingResponse) {
        return billingResponse
      }

      if (url === 'https://api.openai.com/v1/responses') {
        return createJsonResponse({
          id: 'resp-r2-fail-1',
          output_text: JSON.stringify(schema),
        })
      }

      if (url === 'https://api.openai.com/v1/images/generations') {
        return createJsonResponse({ data: [{ b64_json: 'aW1hZ2U=' }] })
      }

      if (url === 'https://api.openai.com/v1/audio/speech') {
        return createAudioResponse('audio')
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const bucketPutMock = vi.fn(async (key: string) => {
      if (key.includes('-image-cover')) {
        throw new Error('simulated put failure')
      }

      return null
    })

    const response = await onRequestPost(
      createContext(
        {
          userId: 'user-r2-fail',
          language: 'ko',
          title: 'R2 실패 테스트',
          description: 'R2 실패 시 에러 응답을 확인한다',
          imageDataUrl: 'data:image/png;base64,b3JpZ2lu',
        },
        {
          STORYBOOK_ASSETS_BUCKET: {
            put: bucketPutMock,
          },
        },
      ),
    )

    expect(response.status).toBe(502)
    const payload = (await response.json()) as {
      error?: string
      failedAssets?: Array<{ key?: string; reason?: string }>
    }
    expect(payload.error).toBe('Failed to store generated assets to R2.')
    expect(Array.isArray(payload.failedAssets)).toBe(true)
    expect(payload.failedAssets?.some((asset) => asset.key?.includes('-image-cover') && asset.reason === 'simulated put failure')).toBe(
      true,
    )
  })
})
