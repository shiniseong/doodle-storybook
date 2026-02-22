import type { StorybookDetailResponse } from '@entities/storybook/model/storybook-detail'
import { err, ok, type Result } from '@shared/lib/result'

export interface GetStorybookDetailRequest {
  userId: string
  storybookId: string
}

export interface StorybookDetailQueryPort {
  getStorybookDetail(request: GetStorybookDetailRequest): Promise<StorybookDetailResponse>
}

export type GetStorybookDetailError =
  | { code: 'EMPTY_USER_ID'; message: string }
  | { code: 'EMPTY_STORYBOOK_ID'; message: string }
  | { code: 'UNEXPECTED'; message: string }

export interface GetStorybookDetailUseCasePort {
  execute(request: GetStorybookDetailRequest): Promise<Result<StorybookDetailResponse, GetStorybookDetailError>>
}

export class GetStorybookDetailUseCase implements GetStorybookDetailUseCasePort {
  private readonly queryPort: StorybookDetailQueryPort

  constructor(queryPort: StorybookDetailQueryPort) {
    this.queryPort = queryPort
  }

  async execute(
    request: GetStorybookDetailRequest,
  ): Promise<Result<StorybookDetailResponse, GetStorybookDetailError>> {
    const userId = request.userId.trim()
    if (userId.length === 0) {
      return err({
        code: 'EMPTY_USER_ID',
        message: 'userId is required.',
      })
    }

    const storybookId = request.storybookId.trim()
    if (storybookId.length === 0) {
      return err({
        code: 'EMPTY_STORYBOOK_ID',
        message: 'storybookId is required.',
      })
    }

    try {
      const response = await this.queryPort.getStorybookDetail({
        userId,
        storybookId,
      })
      return ok(response)
    } catch (error) {
      return err({
        code: 'UNEXPECTED',
        message:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Failed to fetch storybook detail.',
      })
    }
  }
}
