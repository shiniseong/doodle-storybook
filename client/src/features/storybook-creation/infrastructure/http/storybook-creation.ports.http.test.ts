import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpStorybookCommandPort } from '@features/storybook-creation/infrastructure/http/storybook-creation.ports.http'

describe('HttpStorybookCommandPort', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('캔버스 이미지가 있으면 imageDataUrl을 함께 전송한다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: true,
      json: async () => ({
        storybookId: 'storybook-1',
        storybook: {
          storybookId: 'storybook-1',
          title: '달빛 숲',
          authorName: null,
          description: '설명',
          originImageUrl: null,
          createdAt: null,
        },
        details: {
          origin: [],
          output: [],
        },
        ebook: {
          title: '달빛 숲',
          authorName: null,
          coverImageUrl: null,
          highlightImageUrl: null,
          finalImageUrl: null,
          pages: [{ page: 1, content: '본문', isHighlight: false }],
          narrations: [],
        },
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const canvas = document.createElement('canvas')
    canvas.className = 'canvas-stage__surface'
    Object.defineProperty(canvas, 'width', { value: 880, configurable: true })
    Object.defineProperty(canvas, 'height', { value: 440, configurable: true })
    canvas.toDataURL = vi.fn(() => 'data:image/png;base64,abc123')
    document.body.append(canvas)

    const commandPort = new HttpStorybookCommandPort({
      baseUrl: 'https://example.test',
    })
    const result = await commandPort.createStorybook({
      userId: 'user-1',
      title: '달빛 숲',
      description: '토끼가 숲길을 달려요',
      language: 'ko',
    })

    expect(result.storybookId).toBe('storybook-1')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const firstCall = fetchMock.mock.calls[0]
    expect(firstCall).toBeDefined()

    if (!firstCall) {
      throw new Error('Fetch was not called.')
    }

    const fetchOptions = firstCall[1] as RequestInit
    const requestBody = JSON.parse(fetchOptions.body as string) as { imageDataUrl?: string }

    expect(requestBody.imageDataUrl).toBe('data:image/png;base64,abc123')
  })

  it('캔버스가 없으면 imageDataUrl 없이 전송한다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: true,
      json: async () => ({
        storybookId: 'storybook-2',
        storybook: {
          storybookId: 'storybook-2',
          title: '별빛 바다',
          authorName: null,
          description: '설명',
          originImageUrl: null,
          createdAt: null,
        },
        details: {
          origin: [],
          output: [],
        },
        ebook: {
          title: '별빛 바다',
          authorName: null,
          coverImageUrl: null,
          highlightImageUrl: null,
          finalImageUrl: null,
          pages: [{ page: 1, content: '본문', isHighlight: false }],
          narrations: [],
        },
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const commandPort = new HttpStorybookCommandPort({
      baseUrl: 'https://example.test',
    })
    await commandPort.createStorybook({
      userId: 'user-2',
      title: '별빛 바다',
      description: '고양이가 등대 옆을 걷고 있어요',
      language: 'ko',
    })

    const firstCall = fetchMock.mock.calls[0]
    expect(firstCall).toBeDefined()

    if (!firstCall) {
      throw new Error('Fetch was not called.')
    }

    const fetchOptions = firstCall[1] as RequestInit
    const requestBody = JSON.parse(fetchOptions.body as string) as { imageDataUrl?: string }

    expect(requestBody.imageDataUrl).toBeUndefined()
  })

  it('신규 storybook/details/ebook 응답을 파싱한다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: true,
      json: async () => ({
        storybookId: 'storybook-5',
        storybook: {
          storybookId: 'storybook-5',
          title: '반짝 숲',
          authorName: '도담',
          description: '여우가 숲에서 춤춰요',
          originImageUrl: 'https://cdn.example.com/origin.png',
          createdAt: '2026-02-22T04:00:00.000Z',
        },
        details: {
          origin: [
            {
              pageIndex: 0,
              drawingImageUrl: 'https://cdn.example.com/origin.png',
              description: '원본 설명',
            },
          ],
          output: [
            {
              pageIndex: 0,
              pageType: 'cover',
              title: '반짝 숲',
              content: 'cover-content',
              imageUrl: 'https://cdn.example.com/cover.png',
              audioUrl: null,
              isHighlight: false,
            },
            {
              pageIndex: 1,
              pageType: 'story',
              title: null,
              content: '첫 번째 페이지',
              imageUrl: 'https://cdn.example.com/highlight.png',
              audioUrl: 'https://cdn.example.com/p1.mp3',
              isHighlight: true,
            },
          ],
        },
        ebook: {
          title: '반짝 숲',
          authorName: '도담',
          coverImageUrl: 'https://cdn.example.com/cover.png',
          highlightImageUrl: 'https://cdn.example.com/highlight.png',
          finalImageUrl: 'https://cdn.example.com/final.png',
          pages: [{ page: 1, content: '첫 번째 페이지', isHighlight: true }],
          narrations: [{ page: 1, audioDataUrl: 'https://cdn.example.com/p1.mp3' }],
        },
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const commandPort = new HttpStorybookCommandPort({
      baseUrl: 'https://example.test',
    })
    const result = await commandPort.createStorybook({
      userId: 'user-4',
      title: '반짝 숲',
      description: '여우가 숲에서 춤춰요',
      language: 'ko',
    })

    expect(result.storybookId).toBe('storybook-5')
    expect(result.ebook.pages).toEqual([{ page: 1, content: '첫 번째 페이지', isHighlight: true }])
    expect(result.ebook.narrations).toEqual([{ page: 1, audioDataUrl: 'https://cdn.example.com/p1.mp3' }])
    expect((result as unknown as Record<string, unknown>).pages).toBeUndefined()
    expect((result as unknown as Record<string, unknown>).images).toBeUndefined()
    expect((result as unknown as Record<string, unknown>).narrations).toBeUndefined()
  })

  it('legacy 필드만 있으면 응답 파싱 실패로 처리한다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: true,
      json: async () => ({
        storybookId: 'storybook-legacy',
        pages: [{ page: 1, content: 'legacy', isHighlight: false }],
        images: ['data:image/png;base64,legacy'],
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const commandPort = new HttpStorybookCommandPort({
      baseUrl: 'https://example.test',
    })

    await expect(
      commandPort.createStorybook({
        userId: 'user-legacy',
        title: 'legacy',
        description: 'legacy',
        language: 'ko',
      }),
    ).rejects.toThrow('Invalid API response: storybook detail payload is missing.')
  })

  it('API 실패 응답이면 서버 에러 메시지를 포함해 예외를 던진다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: false,
      status: 502,
      json: async () => ({
        error: 'Failed to persist storybook entities.',
        detail: 'upstream timeout',
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const commandPort = new HttpStorybookCommandPort({
      baseUrl: 'https://example.test',
    })

    await expect(
      commandPort.createStorybook({
        userId: 'user-3',
        title: '붉은 지붕집',
        description: '다람쥐가 우편함을 열어요',
        language: 'ko',
      }),
    ).rejects.toThrow('Failed to create storybook (502): Failed to persist storybook entities. (upstream timeout)')
  })

  it('R2 저장 실패 응답이면 failedAssets 요약을 포함한 예외를 던진다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: false,
      status: 502,
      json: async () => ({
        error: 'Failed to store generated assets to R2.',
        failedAssets: [
          { key: 'u/s/images/u-id-image-cover', reason: 'network timeout' },
          { key: 'u/s/tts/u-id-tts-p1', reason: 'quota exceeded' },
        ],
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const commandPort = new HttpStorybookCommandPort({
      baseUrl: 'https://example.test',
    })

    await expect(
      commandPort.createStorybook({
        userId: 'user-3',
        title: '붉은 지붕집',
        description: '다람쥐가 우편함을 열어요',
        language: 'ko',
      }),
    ).rejects.toThrow(
      'Failed to create storybook (502): Failed to store generated assets to R2. u/s/images/u-id-image-cover (network timeout), u/s/tts/u-id-tts-p1 (quota exceeded)',
    )
  })
})
