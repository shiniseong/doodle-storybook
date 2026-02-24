import type { StorybookDetailResponse } from '@entities/storybook/model/storybook-detail'
import { type StoryLanguage } from '@entities/storybook/model/storybook'
import { createStorybookDraft } from '@features/storybook-creation/domain/storybook-draft'
import { err, ok, type Result } from '@shared/lib/result'

export interface CreateStorybookRequest {
  userId: string
  title?: string
  authorName?: string
  description: string
  language: StoryLanguage
}

export type CreateStorybookResponse = StorybookDetailResponse

export interface StorybookQuotaPort {
  canCreateStorybook(userId: string): Promise<boolean>
}

export interface StorybookCommandPort {
  createStorybook(draft: {
    userId: string
    title?: string
    authorName?: string
    description: string
    language: StoryLanguage
  }): Promise<CreateStorybookResponse>
}

export type CreateStorybookError =
  | { code: 'EMPTY_DESCRIPTION'; message: string }
  | { code: 'DESCRIPTION_TOO_LONG'; message: string }
  | { code: 'INVALID_LANGUAGE'; message: string }
  | { code: 'QUOTA_EXCEEDED'; message: string }
  | { code: 'REQUIRED_AGREEMENTS_NOT_ACCEPTED'; message: string }
  | { code: 'UNEXPECTED'; message: string }

export interface CreateStorybookUseCasePort {
  execute(
    request: CreateStorybookRequest,
  ): Promise<Result<CreateStorybookResponse, CreateStorybookError>>
}

export class CreateStorybookUseCase implements CreateStorybookUseCasePort {
  private readonly quotaPort: StorybookQuotaPort
  private readonly commandPort: StorybookCommandPort

  constructor(quotaPort: StorybookQuotaPort, commandPort: StorybookCommandPort) {
    this.quotaPort = quotaPort
    this.commandPort = commandPort
  }

  async execute(
    request: CreateStorybookRequest,
  ): Promise<Result<CreateStorybookResponse, CreateStorybookError>> {
    const draftResult = createStorybookDraft(request.description, request.language)
    const normalizedTitle = request.title?.trim()
    const normalizedAuthorName = request.authorName?.trim()
    if (!draftResult.ok) {
      return err(draftResult.error)
    }

    const canCreate = await this.quotaPort.canCreateStorybook(request.userId)
    if (!canCreate) {
      return err({
        code: 'QUOTA_EXCEEDED',
        message: '무료 생성 한도를 초과했습니다. 구독 후 이용해 주세요.',
      })
    }

    try {
      const created = await this.commandPort.createStorybook({
        userId: request.userId,
        ...(normalizedTitle ? { title: normalizedTitle } : {}),
        ...(normalizedAuthorName ? { authorName: normalizedAuthorName } : {}),
        description: draftResult.value.description,
        language: draftResult.value.language,
      })

      return ok(created)
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : '동화 생성 요청 중 오류가 발생했습니다.'

      if (message.toUpperCase().includes('REQUIRED_AGREEMENTS_NOT_ACCEPTED')) {
        return err({
          code: 'REQUIRED_AGREEMENTS_NOT_ACCEPTED',
          message,
        })
      }

      return err({
        code: 'UNEXPECTED',
        message,
      })
    }
  }
}
