import { describe, expect, it } from 'vitest'

import {
  MAX_STORY_DESCRIPTION_LENGTH,
  createStorybookDraft,
} from '@features/storybook-creation/domain/storybook-draft'

describe('createStorybookDraft', () => {
  it('설명을 trim 해서 draft 를 만든다', () => {
    const result = createStorybookDraft('  반짝이는 별이 있는 밤  ', 'ko')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.description).toBe('반짝이는 별이 있는 밤')
    expect(result.value.language).toBe('ko')
  })

  it('비어 있는 설명은 거절한다', () => {
    const result = createStorybookDraft('   ', 'ko')

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'EMPTY_DESCRIPTION',
        message: '동화 설명은 비워둘 수 없습니다.',
      },
    })
  })

  it('500자를 초과하면 거절한다', () => {
    const longText = '가'.repeat(MAX_STORY_DESCRIPTION_LENGTH + 1)
    const result = createStorybookDraft(longText, 'ko')

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.error.code).toBe('DESCRIPTION_TOO_LONG')
  })

  it('지원하지 않는 언어를 거절한다', () => {
    const result = createStorybookDraft('정글에서 모험을 해요', 'fr')

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }

    expect(result.error.code).toBe('INVALID_LANGUAGE')
  })
})
