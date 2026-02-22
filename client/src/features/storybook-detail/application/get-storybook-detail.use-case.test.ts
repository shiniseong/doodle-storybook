import { describe, expect, it, vi } from 'vitest'

import {
  GetStorybookDetailUseCase,
  type StorybookDetailQueryPort,
} from '@features/storybook-detail/application/get-storybook-detail.use-case'

describe('GetStorybookDetailUseCase', () => {
  it('유효한 요청이면 상세조회 포트를 호출한다', async () => {
    const queryPort: StorybookDetailQueryPort = {
      getStorybookDetail: vi.fn(async () => ({
        storybookId: 'storybook-1',
        storybook: {
          storybookId: 'storybook-1',
          title: '달빛 숲',
          authorName: '도담',
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
          authorName: '도담',
          coverImageUrl: null,
          highlightImageUrl: null,
          finalImageUrl: null,
          pages: [
            {
              page: 1,
              content: '첫 장',
              isHighlight: false,
            },
          ],
          narrations: [],
        },
      })),
    }

    const useCase = new GetStorybookDetailUseCase(queryPort)
    const result = await useCase.execute({
      userId: ' user-1 ',
      storybookId: ' storybook-1 ',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.storybookId).toBe('storybook-1')
    expect(queryPort.getStorybookDetail).toHaveBeenCalledWith({
      userId: 'user-1',
      storybookId: 'storybook-1',
    })
  })

  it('userId가 비어 있으면 에러를 반환한다', async () => {
    const queryPort: StorybookDetailQueryPort = {
      getStorybookDetail: vi.fn(async () => {
        throw new Error('should not be called')
      }),
    }

    const useCase = new GetStorybookDetailUseCase(queryPort)
    const result = await useCase.execute({
      userId: ' ',
      storybookId: 'storybook-1',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'EMPTY_USER_ID',
        message: 'userId is required.',
      },
    })
    expect(queryPort.getStorybookDetail).not.toHaveBeenCalled()
  })

  it('포트 예외는 UNEXPECTED로 매핑한다', async () => {
    const queryPort: StorybookDetailQueryPort = {
      getStorybookDetail: vi.fn(async () => {
        throw new Error('network failure')
      }),
    }

    const useCase = new GetStorybookDetailUseCase(queryPort)
    const result = await useCase.execute({
      userId: 'user-1',
      storybookId: 'storybook-2',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'UNEXPECTED',
        message: 'network failure',
      },
    })
  })
})
