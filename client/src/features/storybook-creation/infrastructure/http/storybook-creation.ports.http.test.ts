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
      json: async () => ({ storybookId: 'storybook-1' }),
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
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/storybooks',
      expect.objectContaining({
        method: 'POST',
      }),
    )

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
      json: async () => ({ storybookId: 'storybook-2' }),
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

  it('API 실패 응답이면 예외를 던진다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: false,
      status: 502,
      json: async () => ({ error: 'upstream failed' }),
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
    ).rejects.toThrow('Failed to create storybook: 502')
  })

  it('pages 문자열 JSON과 이미지 배열을 정규화해서 반환한다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: true,
      json: async () => ({
        storybookId: 'storybook-5',
        openaiResponseId: 'resp-55',
        promptVersion: 5,
        pages:
          '[{"page":2,"content":"두 번째 페이지","isHighlight":true},{"page":1,"content":"첫 번째 페이지","isHighlight":false}]',
        images: ['data: image/png;bas64,cover', 'highlightbase64'],
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
    expect(result.openaiResponseId).toBe('resp-55')
    expect(result.promptVersion).toBe('5')
    expect(result.pages).toEqual([
      { page: 1, content: '첫 번째 페이지', isHighlight: false },
      { page: 2, content: '두 번째 페이지', isHighlight: true },
    ])
    expect(result.images).toEqual(['data:image/png;base64,cover', 'data:image/png;base64,highlightbase64'])
  })
})
