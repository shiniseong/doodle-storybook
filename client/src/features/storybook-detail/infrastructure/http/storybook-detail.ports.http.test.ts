import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpStorybookDetailQueryPort } from '@features/storybook-detail/infrastructure/http/storybook-detail.ports.http'

describe('HttpStorybookDetailQueryPort', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('신규 상세 DTO를 파싱해서 반환한다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: true,
      json: async () => ({
        storybookId: 'storybook-1',
        storybook: {
          storybookId: 'storybook-1',
          title: '달빛 숲',
          authorName: '도담',
          description: '토끼가 숲속을 걷는 장면',
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
              title: '달빛 숲',
              content: 'cover',
              imageUrl: 'https://cdn.example.com/cover.png',
              audioUrl: null,
              isHighlight: false,
            },
            {
              pageIndex: 1,
              pageType: 'story',
              title: null,
              content: '본문 1페이지',
              imageUrl: 'https://cdn.example.com/highlight.png',
              audioUrl: 'https://cdn.example.com/p1.mp3',
              isHighlight: true,
            },
          ],
        },
        ebook: {
          title: '달빛 숲',
          authorName: '도담',
          coverImageUrl: 'https://cdn.example.com/cover.png',
          highlightImageUrl: 'https://cdn.example.com/highlight.png',
          finalImageUrl: 'https://cdn.example.com/final.png',
          pages: [
            {
              page: 1,
              content: '본문 1페이지',
              isHighlight: true,
            },
          ],
          narrations: [
            {
              page: 1,
              audioDataUrl: 'https://cdn.example.com/p1.mp3',
            },
          ],
        },
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const queryPort = new HttpStorybookDetailQueryPort({
      baseUrl: 'https://example.test',
    })

    const result = await queryPort.getStorybookDetail({
      userId: 'user-1',
      storybookId: 'storybook-1',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/storybooks/storybook-1?userId=user-1',
      expect.objectContaining({
        method: 'GET',
      }),
    )
    expect(result.storybookId).toBe('storybook-1')
    expect(result.ebook.pages).toEqual([{ page: 1, content: '본문 1페이지', isHighlight: true }])
  })

  it('API 실패 응답이면 상세한 에러 메시지를 포함한다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: false,
      status: 502,
      json: async () => ({
        error: 'Failed to fetch storybook detail.',
        detail: 'upstream timeout',
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const queryPort = new HttpStorybookDetailQueryPort({
      baseUrl: 'https://example.test',
    })

    await expect(
      queryPort.getStorybookDetail({
        userId: 'user-1',
        storybookId: 'storybook-1',
      }),
    ).rejects.toThrow('Failed to fetch storybook detail (502): Failed to fetch storybook detail. (upstream timeout)')
  })

  it('응답 스키마가 잘못되면 파싱 에러를 던진다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: true,
      json: async () => ({
        storybookId: 'storybook-1',
        ebook: null,
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const queryPort = new HttpStorybookDetailQueryPort({
      baseUrl: 'https://example.test',
    })

    await expect(
      queryPort.getStorybookDetail({
        userId: 'user-1',
        storybookId: 'storybook-1',
      }),
    ).rejects.toThrow('Invalid API response: storybook detail payload is missing.')
  })
})
