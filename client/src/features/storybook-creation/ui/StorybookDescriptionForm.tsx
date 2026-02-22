import { type FormEvent, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MAX_STORY_DESCRIPTION_LENGTH } from '@features/storybook-creation/domain/storybook-draft'

const MAX_STORY_TITLE_LENGTH = 30
const MAX_STORY_AUTHOR_LENGTH = 24

export interface StorybookDescriptionFormSubmit {
  title: string
  authorName: string
  description: string
}

interface StorybookDescriptionFormProps {
  titleMaxLength?: number
  authorNameMaxLength?: number
  maxLength?: number
  isSubmitting?: boolean
  initialTitle?: string
  initialAuthorName?: string
  initialDescription?: string
  onDraftChange?: (draft: { title: string; authorName: string; description: string }) => void
  onSubmit: (payload: StorybookDescriptionFormSubmit) => void | Promise<void>
}

export function StorybookDescriptionForm({
  titleMaxLength = MAX_STORY_TITLE_LENGTH,
  authorNameMaxLength = MAX_STORY_AUTHOR_LENGTH,
  maxLength = MAX_STORY_DESCRIPTION_LENGTH,
  isSubmitting = false,
  initialTitle = '',
  initialAuthorName = '',
  initialDescription = '',
  onDraftChange,
  onSubmit,
}: StorybookDescriptionFormProps) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(initialTitle)
  const [authorName, setAuthorName] = useState(initialAuthorName)
  const [description, setDescription] = useState(initialDescription)

  const trimmedTitle = title.trim()
  const trimmedAuthorName = authorName.trim()
  const trimmedDescription = description.trim()
  const isTitleEmpty = trimmedTitle.length === 0
  const isAuthorNameEmpty = trimmedAuthorName.length === 0
  const isDescriptionEmpty = trimmedDescription.length === 0
  const isTitleTooLong = title.length > titleMaxLength
  const isTooLong = description.length > maxLength
  const canSubmit = !isTitleEmpty && !isAuthorNameEmpty && !isDescriptionEmpty && !isTooLong && !isTitleTooLong && !isSubmitting

  useEffect(() => {
    onDraftChange?.({
      title,
      authorName,
      description,
    })
  }, [authorName, description, onDraftChange, title])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canSubmit) {
      return
    }

    await onSubmit({
      title: trimmedTitle,
      authorName: trimmedAuthorName,
      description: trimmedDescription,
    })
  }

  return (
    <form className="compose-form" onSubmit={handleSubmit} noValidate>
      <label className="compose-form__label" htmlFor="storybook-title">
        {t('form.titleLabel')}
      </label>
      <input
        id="storybook-title"
        type="text"
        maxLength={titleMaxLength}
        value={title}
        onChange={(event) => {
          setTitle(event.target.value)
        }}
      />
      <label className="compose-form__label" htmlFor="storybook-author-name">
        {t('form.authorLabel')}
      </label>
      <input
        id="storybook-author-name"
        type="text"
        maxLength={authorNameMaxLength}
        required
        value={authorName}
        placeholder={t('form.authorPlaceholder')}
        onChange={(event) => {
          setAuthorName(event.target.value)
        }}
      />
      <label className="compose-form__label" htmlFor="storybook-description">
        {t('form.descriptionLabel')}
      </label>
      <textarea
        id="storybook-description"
        maxLength={maxLength}
        value={description}
        onChange={(event) => {
          setDescription(event.target.value)
        }}
      />
      <div className="compose-form__footer">
        <span aria-live="polite">
          {t('form.counter', { current: description.length, max: maxLength })}
        </span>
        <button type="submit" disabled={!canSubmit}>
          {isSubmitting ? t('form.submitting') : t('form.submit')}
        </button>
      </div>
    </form>
  )
}
