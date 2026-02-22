import { describe, expect, it, vi } from 'vitest'

import {
  ListStorybooksUseCase,
  type StorybookLibraryQueryPort,
} from '@features/storybook-library/application/list-storybooks.use-case'

describe('ListStorybooksUseCase', () => {
  it('userId가 유효하면 목록 조회 포트를 호출한다', async () => {
    const queryPort: StorybookLibraryQueryPort = {
      listStorybooks: vi.fn(async () => ({
        items: [
          {
            storybookId: 'storybook-1',
            title: '별빛 숲',
            authorName: '도담',
            originImageUrl: 'https://cdn.example.com/a',
            createdAt: '2026-02-22T04:00:00.000Z',
          },
        ],
      })),
    }

    const useCase = new ListStorybooksUseCase(queryPort)
    const result = await useCase.execute({
      userId: ' user-1 ',
      limit: 24,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.items).toHaveLength(1)
    expect(queryPort.listStorybooks).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 24,
    })
  })

  it('userId가 비어있으면 EMPTY_USER_ID를 반환한다', async () => {
    const queryPort: StorybookLibraryQueryPort = {
      listStorybooks: vi.fn(async () => ({ items: [] })),
    }

    const useCase = new ListStorybooksUseCase(queryPort)
    const result = await useCase.execute({
      userId: '   ',
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error.code).toBe('EMPTY_USER_ID')
    expect(queryPort.listStorybooks).not.toHaveBeenCalled()
  })
})
