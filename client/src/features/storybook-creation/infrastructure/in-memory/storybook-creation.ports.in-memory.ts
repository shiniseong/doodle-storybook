import {
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
    description: string
    language: StoryLanguage
  }): Promise<{ storybookId: string }> {
    void _draft
    return {
      storybookId: `storybook-${crypto.randomUUID()}`,
    }
  }
}
