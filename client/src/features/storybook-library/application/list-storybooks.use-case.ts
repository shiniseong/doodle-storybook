import { err, ok, type Result } from '@shared/lib/result'

export interface StorybookLibraryItem {
  storybookId: string
  title: string
  authorName: string | null
  originImageUrl: string | null
  createdAt: string | null
}

export interface ListStorybooksRequest {
  userId: string
  limit?: number
}

export interface ListStorybooksResponse {
  items: StorybookLibraryItem[]
}

export interface StorybookLibraryQueryPort {
  listStorybooks(request: ListStorybooksRequest): Promise<ListStorybooksResponse>
}

export type ListStorybooksError =
  | { code: 'EMPTY_USER_ID'; message: string }
  | { code: 'UNEXPECTED'; message: string }

export interface ListStorybooksUseCasePort {
  execute(request: ListStorybooksRequest): Promise<Result<ListStorybooksResponse, ListStorybooksError>>
}

export class ListStorybooksUseCase implements ListStorybooksUseCasePort {
  private readonly queryPort: StorybookLibraryQueryPort

  constructor(queryPort: StorybookLibraryQueryPort) {
    this.queryPort = queryPort
  }

  async execute(request: ListStorybooksRequest): Promise<Result<ListStorybooksResponse, ListStorybooksError>> {
    const userId = request.userId.trim()
    if (userId.length === 0) {
      return err({
        code: 'EMPTY_USER_ID',
        message: 'userId is required.',
      })
    }

    try {
      const response = await this.queryPort.listStorybooks({
        userId,
        ...(typeof request.limit === 'number' && Number.isFinite(request.limit) && request.limit > 0
          ? { limit: Math.floor(request.limit) }
          : {}),
      })
      return ok(response)
    } catch (error) {
      return err({
        code: 'UNEXPECTED',
        message:
          error instanceof Error && error.message.trim().length > 0
            ? error.message
            : 'Failed to fetch storybook list.',
      })
    }
  }
}
