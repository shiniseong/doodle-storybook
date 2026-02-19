import { type FormEvent, useState } from 'react'

import { type StoryLanguage } from '@entities/storybook/model/storybook'
import { MAX_STORY_DESCRIPTION_LENGTH } from '@features/storybook-creation/domain/storybook-draft'

export interface StorybookDescriptionFormSubmit {
  description: string
  language: StoryLanguage
}

interface StorybookDescriptionFormProps {
  maxLength?: number
  initialLanguage?: StoryLanguage
  isSubmitting?: boolean
  onSubmit: (payload: StorybookDescriptionFormSubmit) => void | Promise<void>
}

export function StorybookDescriptionForm({
  maxLength = MAX_STORY_DESCRIPTION_LENGTH,
  initialLanguage = 'ko',
  isSubmitting = false,
  onSubmit,
}: StorybookDescriptionFormProps) {
  const [description, setDescription] = useState('')
  const [language, setLanguage] = useState<StoryLanguage>(initialLanguage)

  const trimmedDescription = description.trim()
  const isEmpty = trimmedDescription.length === 0
  const isTooLong = description.length > maxLength
  const canSubmit = !isEmpty && !isTooLong && !isSubmitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    await onSubmit({
      description: trimmedDescription,
      language,
    })
  }

  return (
    <form className="compose-form" onSubmit={handleSubmit} noValidate>
      <label className="compose-form__label" htmlFor="storybook-description">
        그림 설명
      </label>
      <textarea
        id="storybook-description"
        maxLength={maxLength}
        value={description}
        placeholder="아이가 그린 장면을 짧고 따뜻하게 설명해 주세요."
        onChange={(event) => {
          setDescription(event.target.value)
        }}
      />
      <label className="compose-form__label" htmlFor="storybook-language">
        언어
      </label>
      <select
        id="storybook-language"
        value={language}
        onChange={(event) => {
          setLanguage(event.target.value as StoryLanguage)
        }}
      >
        <option value="ko">한국어</option>
        <option value="en">English</option>
        <option value="ja">日本語</option>
        <option value="zh">简体中文</option>
      </select>
      <div className="compose-form__footer">
        <span aria-live="polite">
          {description.length} / {maxLength}
        </span>
        <button type="submit" disabled={!canSubmit}>
          {isSubmitting ? '생성 중...' : '동화 생성하기'}
        </button>
      </div>
    </form>
  )
}
