import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpStorybookLibraryQueryPort } from '@features/storybook-library/infrastructure/http/storybook-library.ports.http'

describe('HttpStorybookLibraryQueryPort', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('목록 조회 성공 시 아이템을 정규화해서 반환한다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: true,
      json: async () => ({
        items: [
          {
            storybookId: 'storybook-1',
            title: '별빛 숲',
            authorName: '도담',
            originImageUrl: 'https://cdn.example.com/user-1/s-1-origin',
            createdAt: '2026-02-22T04:00:00.000Z',
          },
          {
            storybookId: 'storybook-2',
            title: '  달빛 바다  ',
            authorName: '  ',
            originImageUrl: '',
            createdAt: null,
          },
        ],
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const queryPort = new HttpStorybookLibraryQueryPort({
      baseUrl: 'https://example.test',
    })
    const response = await queryPort.listStorybooks({
      userId: 'user-1',
      limit: 5,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/storybooks?userId=user-1&limit=5',
      expect.objectContaining({
        method: 'GET',
      }),
    )
    expect(response.items).toEqual([
      {
        storybookId: 'storybook-1',
        title: '별빛 숲',
        authorName: '도담',
        originImageUrl: 'https://cdn.example.com/user-1/s-1-origin',
        createdAt: '2026-02-22T04:00:00.000Z',
      },
      {
        storybookId: 'storybook-2',
        title: '달빛 바다',
        authorName: null,
        originImageUrl: null,
        createdAt: null,
      },
    ])
  })

  it('목록 조회 실패 시 detail 메시지를 포함한 예외를 던진다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: false,
      status: 502,
      json: async () => ({
        error: 'Failed to fetch storybook list.',
        detail: 'permission denied for schema doodle_storybook_db',
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const queryPort = new HttpStorybookLibraryQueryPort({
      baseUrl: 'https://example.test',
    })

    await expect(
      queryPort.listStorybooks({
        userId: 'user-1',
      }),
    ).rejects.toThrow(
      'Failed to fetch storybook list (502): Failed to fetch storybook list. (permission denied for schema doodle_storybook_db)',
    )
  })
})
