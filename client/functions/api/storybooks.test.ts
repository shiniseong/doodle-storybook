import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { onRequestPost, parsePromptStorybookOutput } from './storybooks'

interface TestEnv {
  OPENAI_API_KEY: string
  OPENAI_PROMPT_ID?: string
  OPENAI_PROMPT_VERSION?: string
  OPENAI_IMAGE_MODEL?: string
  OPENAI_TTS_MODEL?: string
  OPENAI_TTS_VOICE?: string
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

function createContext(requestPayload: unknown, envOverrides: Partial<TestEnv> = {}) {
  return {
    request: new Request('https://example.test/api/storybooks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
      STORYBOOK_ASSETS_BUCKET: {
        put: async () => null,
      },
      ...envOverrides,
    },
  } as unknown as Parameters<typeof onRequestPost>[0]
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
        expect(requestBody.size === '1024x1024' || requestBody.size === '512x512').toBe(true)
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
          expect(requestBody.prompt).toContain('Scene description: cover prompt')
          if (requestBody.size === '512x512') {
            return createJsonResponse({ data: [{ b64_json: 'Y292ZXItdGh1bWItYjY0' }] })
          }
          return createJsonResponse({ data: [{ b64_json: 'Y292ZXItYjY0' }] })
        }

        if (requestBody.prompt?.includes('Scene role: highlight.')) {
          expect(requestBody.prompt).toContain('Scene description: highlight prompt')
          if (requestBody.size === '512x512') {
            return createJsonResponse({ data: [{ b64_json: 'aGlnaGxpZ2h0LXRodW1iLWI2NA==' }] })
          }
          return createJsonResponse({ data: [{ b64_json: 'aGlnaGxpZ2h0LWI2NA==' }] })
        }

        if (requestBody.prompt?.includes('Scene role: end.')) {
          expect(requestBody.prompt).toContain('Scene description: end prompt')
          if (requestBody.size === '512x512') {
            return createJsonResponse({ data: [{ b64_json: 'ZW5kLXRodW1iLWI2NA==' }] })
          }
          return createJsonResponse({ data: [{ b64_json: 'ZW5kLWI2NA==' }] })
        }

        throw new Error(`Unexpected scene role prompt: ${requestBody.prompt ?? '<missing>'}`)
      }

      if (url === 'https://api.openai.com/v1/audio/speech') {
        const requestBody = JSON.parse(String(init?.body)) as { input?: string }
        ttsInputs.push(requestBody.input ?? '')
        return createAudioResponse(`audio:${requestBody.input ?? ''}`)
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
      }),
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(17)
    expect(bucketPutMock).toHaveBeenCalledTimes(17)

    const payload = (await response.json()) as {
      storybookId: string
      pages: Array<{ page: number; content: string; isHighlight: boolean }>
      images: string[]
      narrations: Array<{ page: number; audioDataUrl: string }>
      promptVersion: string
      upstreamPromptVersion: string | null
      openaiResponseId: string
      createdStoryBookId: string
    }

    expect(payload.promptVersion).toBe('21')
    expect(payload.upstreamPromptVersion).toBe('21')
    expect(payload.openaiResponseId).toBe('resp-v9-1')
    expect(payload.pages).toHaveLength(10)
    expect(payload.pages.filter((page) => page.isHighlight)).toHaveLength(1)
    expect(payload.pages.find((page) => page.page === schema.highlightPage)?.isHighlight).toBe(true)
    expect(payload.images).toEqual([
      'data:image/png;base64,Y292ZXItYjY0',
      'data:image/png;base64,aGlnaGxpZ2h0LWI2NA==',
      'data:image/png;base64,ZW5kLWI2NA==',
    ])
    expect(payload.narrations).toHaveLength(10)
    expect(payload.narrations.every((narration) => narration.audioDataUrl.startsWith('data:audio/mpeg;base64,'))).toBe(true)
    expect(ttsInputs).toEqual(schema.pages.map((page) => page.content))
    expect(typeof payload.createdStoryBookId).toBe('string')
    expect(payload.createdStoryBookId.length).toBeGreaterThan(0)

    const storedKeys = bucketPutMock.mock.calls.map((call) => call[0] as string)
    expect(storedKeys).toContain(
      `user-1/${payload.storybookId}/images/user-1-${payload.createdStoryBookId}-image-origin`,
    )
    expect(storedKeys).toContain(
      `user-1/${payload.storybookId}/images/user-1-${payload.createdStoryBookId}-image-cover`,
    )
    expect(storedKeys).toContain(
      `user-1/${payload.storybookId}/images/user-1-${payload.createdStoryBookId}-image-cover-thumbnail`,
    )
    expect(storedKeys).toContain(
      `user-1/${payload.storybookId}/images/user-1-${payload.createdStoryBookId}-image-highlight`,
    )
    expect(storedKeys).toContain(
      `user-1/${payload.storybookId}/images/user-1-${payload.createdStoryBookId}-image-highlight-thumbnail`,
    )
    expect(storedKeys).toContain(`user-1/${payload.storybookId}/images/user-1-${payload.createdStoryBookId}-image-end`)
    expect(storedKeys).toContain(
      `user-1/${payload.storybookId}/images/user-1-${payload.createdStoryBookId}-image-end-thumbnail`,
    )
    expect(storedKeys).toContain(`user-1/${payload.storybookId}/tts/user-1-${payload.createdStoryBookId}-tts-p1`)
    expect(storedKeys).toContain(`user-1/${payload.storybookId}/tts/user-1-${payload.createdStoryBookId}-tts-p10`)
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
        expect(requestBody.size === '1024x1024' || requestBody.size === '512x512').toBe(true)
        if (requestBody.prompt?.includes('Scene role: cover.')) {
          return createJsonResponse({
            data: [{ b64_json: requestBody.size === '512x512' ? 'bGVnYWN5LWNvdmVyLXRodW1i' : 'bGVnYWN5LWNvdmVy' }],
          })
        }
        if (requestBody.prompt?.includes('Scene role: highlight.')) {
          return createJsonResponse({
            data: [
              {
                b64_json:
                  requestBody.size === '512x512'
                    ? 'bGVnYWN5LWhpZ2hsaWdodC10aHVtYg=='
                    : 'bGVnYWN5LWhpZ2hsaWdodA==',
              },
            ],
          })
        }
        if (requestBody.prompt?.includes('Scene role: end.')) {
          return createJsonResponse({
            data: [{ b64_json: requestBody.size === '512x512' ? 'bGVnYWN5LWVuZC10aHVtYg==' : 'bGVnYWN5LWVuZA==' }],
          })
        }
        throw new Error(`Unexpected scene role prompt: ${requestBody.prompt ?? '<missing>'}`)
      }

      if (url === 'https://api.openai.com/v1/audio/speech') {
        return createAudioResponse('legacy-audio')
      }

      throw new Error(`Unexpected URL: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestPost(
      createContext({
        userId: 'user-legacy',
        language: 'ko',
        title: '레거시 테스트',
        description: '레거시 응답도 처리되어야 함',
      }),
    )

    expect(response.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(17)

    const payload = (await response.json()) as {
      pages: Array<{ page: number; content: string; isHighlight: boolean }>
      images: string[]
      narrations: Array<{ page: number; audioDataUrl: string }>
    }

    expect(payload.pages).toHaveLength(10)
    expect(payload.pages.find((page) => page.page === 6)?.isHighlight).toBe(true)
    expect(payload.images).toHaveLength(3)
    expect(payload.narrations).toHaveLength(10)
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

      if (url === 'https://api.openai.com/v1/responses') {
        return Promise.resolve(
          createJsonResponse({
            id: 'resp-v9-2',
            output_text: JSON.stringify(schema),
          }),
        )
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

    expect(fetchMock).toHaveBeenCalledTimes(17)
    expect(deferredRequests).toHaveLength(16)

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
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
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
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const payload = (await response.json()) as { error?: string }
    expect(payload.error).toBe('Invalid storybook prompt output schema.')
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
})
