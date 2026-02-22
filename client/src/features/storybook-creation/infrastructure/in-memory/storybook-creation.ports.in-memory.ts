import {
  type CreateStorybookResponse,
  type StorybookCommandPort,
  type StorybookQuotaPort,
} from '@features/storybook-creation/application/create-storybook.use-case'
import { type StoryLanguage } from '@entities/storybook/model/storybook'

export class InMemoryStorybookQuotaPort implements StorybookQuotaPort {
  private readonly canCreate: boolean

  constructor(canCreate: boolean = true) {
    this.canCreate = canCreate
  }

  async canCreateStorybook(_userId: string): Promise<boolean> {
    void _userId
    return this.canCreate
  }
}

export class InMemoryStorybookCommandPort implements StorybookCommandPort {
  async createStorybook(_draft: {
    userId: string
    title?: string
    authorName?: string
    description: string
    language: StoryLanguage
  }): Promise<CreateStorybookResponse> {
    const storybookId = `storybook-${crypto.randomUUID()}`
    const title = _draft.title?.trim() || storybookId
    const authorName = _draft.authorName?.trim() || null

    return {
      storybookId,
      storybook: {
        storybookId,
        title,
        authorName,
        description: _draft.description,
        originImageUrl: null,
        createdAt: null,
      },
      details: {
        origin: [],
        output: [],
      },
      ebook: {
        title,
        authorName,
        coverImageUrl: null,
        highlightImageUrl: null,
        finalImageUrl: null,
        pages: [],
        narrations: [],
      },
    }
  }
}
