import { describe, expect, it, vi } from 'vitest'

import {
  type CreateStorybookResponse,
  CreateStorybookUseCase,
  type StorybookCommandPort,
  type StorybookQuotaPort,
} from '@features/storybook-creation/application/create-storybook.use-case'

const mockCreateStorybookResponse: CreateStorybookResponse = {
  storybookId: 'storybook-1',
  storybook: {
    storybookId: 'storybook-1',
    title: '달빛 숲 모험',
    authorName: null,
    description: '토끼가 달빛 숲에서 길을 찾아요',
    originImageUrl: null,
    createdAt: null,
  },
  details: {
    origin: [],
    output: [],
  },
  ebook: {
    title: '달빛 숲 모험',
    authorName: null,
    coverImageUrl: null,
    highlightImageUrl: null,
    finalImageUrl: null,
    pages: [{ page: 1, content: '첫 장', isHighlight: false }],
    narrations: [],
  },
}

describe('CreateStorybookUseCase', () => {
  it('검증과 quota 통과 시 동화 생성 명령을 호출한다', async () => {
    const quotaPort: StorybookQuotaPort = {
      canCreateStorybook: vi.fn(async () => true),
    }
    const commandPort: StorybookCommandPort = {
      createStorybook: vi.fn(async () => mockCreateStorybookResponse),
    }

    const useCase = new CreateStorybookUseCase(quotaPort, commandPort)
    const result = await useCase.execute({
      userId: 'user-1',
      title: '  달빛 숲 모험  ',
      description: '  토끼가 달빛 숲에서 길을 찾아요 ',
      language: 'ko',
    })

    expect(result).toEqual({
      ok: true,
      value: mockCreateStorybookResponse,
    })
    expect(quotaPort.canCreateStorybook).toHaveBeenCalledWith('user-1')
    expect(commandPort.createStorybook).toHaveBeenCalledWith({
      userId: 'user-1',
      title: '달빛 숲 모험',
      description: '토끼가 달빛 숲에서 길을 찾아요',
      language: 'ko',
    })
  })

  it('quota 미충족이면 생성하지 않는다', async () => {
    const quotaPort: StorybookQuotaPort = {
      canCreateStorybook: vi.fn(async () => false),
    }
    const commandPort: StorybookCommandPort = {
      createStorybook: vi.fn(async () => mockCreateStorybookResponse),
    }

    const useCase = new CreateStorybookUseCase(quotaPort, commandPort)
    const result = await useCase.execute({
      userId: 'user-1',
      description: '바닷가를 산책해요',
      language: 'ko',
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.error.code).toBe('QUOTA_EXCEEDED')
    expect(commandPort.createStorybook).not.toHaveBeenCalled()
  })

  it('도메인 검증 실패면 포트를 호출하지 않는다', async () => {
    const quotaPort: StorybookQuotaPort = {
      canCreateStorybook: vi.fn(async () => true),
    }
    const commandPort: StorybookCommandPort = {
      createStorybook: vi.fn(async () => mockCreateStorybookResponse),
    }

    const useCase = new CreateStorybookUseCase(quotaPort, commandPort)
    const result = await useCase.execute({
      userId: 'user-1',
      description: ' ',
      language: 'ko',
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.error.code).toBe('EMPTY_DESCRIPTION')
    expect(quotaPort.canCreateStorybook).not.toHaveBeenCalled()
    expect(commandPort.createStorybook).not.toHaveBeenCalled()
  })

  it('명령 포트 예외는 unexpected 에러로 매핑한다', async () => {
    const quotaPort: StorybookQuotaPort = {
      canCreateStorybook: vi.fn(async () => true),
    }
    const commandPort: StorybookCommandPort = {
      createStorybook: vi.fn(async () => {
        throw new Error('network failure')
      }),
    }

    const useCase = new CreateStorybookUseCase(quotaPort, commandPort)
    const result = await useCase.execute({
      userId: 'user-1',
      description: '겨울 마을에서 눈사람을 만들어요',
      language: 'ko',
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.error.code).toBe('UNEXPECTED')
    expect(result.error.message).toBe('network failure')
  })

  it('필수 동의 미완료 에러 문자열은 REQUIRED_AGREEMENTS_NOT_ACCEPTED로 매핑한다', async () => {
    const quotaPort: StorybookQuotaPort = {
      canCreateStorybook: vi.fn(async () => true),
    }
    const commandPort: StorybookCommandPort = {
      createStorybook: vi.fn(async () => {
        throw new Error('Failed to create storybook (403): REQUIRED_AGREEMENTS_NOT_ACCEPTED')
      }),
    }

    const useCase = new CreateStorybookUseCase(quotaPort, commandPort)
    const result = await useCase.execute({
      userId: 'user-1',
      description: '호수 위를 산책해요',
      language: 'ko',
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.error.code).toBe('REQUIRED_AGREEMENTS_NOT_ACCEPTED')
    expect(result.error.message).toContain('REQUIRED_AGREEMENTS_NOT_ACCEPTED')
  })
})
