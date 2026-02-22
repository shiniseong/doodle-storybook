import { err, ok, type Result } from '@shared/lib/result'

export interface DeleteStorybookRequest {
  userId: string
  storybookId: string
}

export interface StorybookDeletionCommandPort {
  deleteStorybook(request: DeleteStorybookRequest): Promise<void>
}

export type DeleteStorybookError =
  | { code: 'EMPTY_USER_ID'; message: string }
  | { code: 'EMPTY_STORYBOOK_ID'; message: string }
  | { code: 'UNEXPECTED'; message: string }

export interface DeleteStorybookUseCasePort {
  execute(request: DeleteStorybookRequest): Promise<Result<void, DeleteStorybookError>>
}

export class DeleteStorybookUseCase implements DeleteStorybookUseCasePort {
  private readonly commandPort: StorybookDeletionCommandPort

  constructor(commandPort: StorybookDeletionCommandPort) {
    this.commandPort = commandPort
  }

  async execute(request: DeleteStorybookRequest): Promise<Result<void, DeleteStorybookError>> {
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
      await this.commandPort.deleteStorybook({
        userId,
        storybookId,
      })
      return ok(undefined)
    } catch (error) {
      return err({
        code: 'UNEXPECTED',
        message:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Failed to delete storybook.',
      })
    }
  }
}
