export const STORY_LANGUAGE_CODES = ['ko', 'en', 'ja', 'zh'] as const

export type StoryLanguage = (typeof STORY_LANGUAGE_CODES)[number]

export interface Storybook {
  id: string
  userId: string
  language: StoryLanguage
  description: string
}
