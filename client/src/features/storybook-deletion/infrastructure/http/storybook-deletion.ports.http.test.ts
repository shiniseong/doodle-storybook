import { afterEach, describe, expect, it, vi } from 'vitest'

import { HttpStorybookDeletionCommandPort } from '@features/storybook-deletion/infrastructure/http/storybook-deletion.ports.http'

describe('HttpStorybookDeletionCommandPort', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('삭제 성공 시 DELETE 요청을 보낸다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: true,
      status: 204,
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const commandPort = new HttpStorybookDeletionCommandPort({
      baseUrl: 'https://example.test',
    })

    await commandPort.deleteStorybook({
      userId: 'user-1',
      storybookId: 'storybook-1',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test/api/storybooks/storybook-1?userId=user-1',
      expect.objectContaining({
        method: 'DELETE',
      }),
    )
  })

  it('삭제 실패 시 상세 에러 메시지를 포함한다', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => ({
      ok: false,
      status: 502,
      json: async () => ({
        error: 'Failed to delete storybook.',
        detail: 'permission denied',
      }),
    }) as unknown as Response)
    vi.stubGlobal('fetch', fetchMock)

    const commandPort = new HttpStorybookDeletionCommandPort({
      baseUrl: 'https://example.test',
    })

    await expect(
      commandPort.deleteStorybook({
        userId: 'user-1',
        storybookId: 'storybook-1',
      }),
    ).rejects.toThrow('Failed to delete storybook (502): Failed to delete storybook. (permission denied)')
  })
})
