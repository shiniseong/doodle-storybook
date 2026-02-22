import { describe, expect, it, vi } from 'vitest'

import {
  DeleteStorybookUseCase,
  type StorybookDeletionCommandPort,
} from '@features/storybook-deletion/application/delete-storybook.use-case'

describe('DeleteStorybookUseCase', () => {
  it('유효한 요청이면 삭제 커맨드 포트를 호출한다', async () => {
    const commandPort: StorybookDeletionCommandPort = {
      deleteStorybook: vi.fn(async () => {}),
    }

    const useCase = new DeleteStorybookUseCase(commandPort)
    const result = await useCase.execute({
      userId: ' user-1 ',
      storybookId: ' storybook-1 ',
    })

    expect(result.ok).toBe(true)
    expect(commandPort.deleteStorybook).toHaveBeenCalledWith({
      userId: 'user-1',
      storybookId: 'storybook-1',
    })
  })

  it('userId가 비어있으면 EMPTY_USER_ID를 반환한다', async () => {
    const commandPort: StorybookDeletionCommandPort = {
      deleteStorybook: vi.fn(async () => {}),
    }

    const useCase = new DeleteStorybookUseCase(commandPort)
    const result = await useCase.execute({
      userId: '   ',
      storybookId: 'storybook-1',
    })

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error.code).toBe('EMPTY_USER_ID')
    expect(commandPort.deleteStorybook).not.toHaveBeenCalled()
  })

  it('포트 예외는 UNEXPECTED로 매핑한다', async () => {
    const commandPort: StorybookDeletionCommandPort = {
      deleteStorybook: vi.fn(async () => {
        throw new Error('network failure')
      }),
    }

    const useCase = new DeleteStorybookUseCase(commandPort)
    const result = await useCase.execute({
      userId: 'user-1',
      storybookId: 'storybook-1',
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
