import { describe, expect, it, vi } from 'vitest'

import {
  CreateStorybookUseCase,
  type StorybookCommandPort,
  type StorybookQuotaPort,
} from '@features/storybook-creation/application/create-storybook.use-case'

describe('CreateStorybookUseCase', () => {
  it('검증과 quota 통과 시 동화 생성 명령을 호출한다', async () => {
    const quotaPort: StorybookQuotaPort = {
      canCreateStorybook: vi.fn(async () => true),
    }
    const commandPort: StorybookCommandPort = {
      createStorybook: vi.fn(async () => ({ storybookId: 'storybook-1' })),
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
      value: { storybookId: 'storybook-1' },
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
      createStorybook: vi.fn(async () => ({ storybookId: 'storybook-ignored' })),
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
      createStorybook: vi.fn(async () => ({ storybookId: 'storybook-ignored' })),
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
})
