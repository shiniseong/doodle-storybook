import { STORY_LANGUAGE_CODES, type StoryLanguage } from '@entities/storybook/model/storybook'
import { err, ok, type Result } from '@shared/lib/result'

export const MAX_STORY_DESCRIPTION_LENGTH = 500

export type StorybookDraftValidationError =
  | { code: 'EMPTY_DESCRIPTION'; message: string }
  | { code: 'DESCRIPTION_TOO_LONG'; message: string }
  | { code: 'INVALID_LANGUAGE'; message: string }

export interface StorybookDraft {
  description: string
  language: StoryLanguage
}

export const createStorybookDraft = (
  description: string,
  language: string,
): Result<StorybookDraft, StorybookDraftValidationError> => {
  const normalizedDescription = description.trim()

  if (normalizedDescription.length === 0) {
    return err({
      code: 'EMPTY_DESCRIPTION',
      message: '동화 설명은 비워둘 수 없습니다.',
    })
  }

  if (normalizedDescription.length > MAX_STORY_DESCRIPTION_LENGTH) {
    return err({
      code: 'DESCRIPTION_TOO_LONG',
      message: `동화 설명은 ${MAX_STORY_DESCRIPTION_LENGTH}자를 초과할 수 없습니다.`,
    })
  }

  if (!STORY_LANGUAGE_CODES.includes(language as StoryLanguage)) {
    return err({
      code: 'INVALID_LANGUAGE',
      message: '지원하지 않는 언어 코드입니다.',
    })
  }

  return ok({
    description: normalizedDescription,
    language: language as StoryLanguage,
  })
}
