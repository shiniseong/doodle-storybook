import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MAX_STORY_DESCRIPTION_LENGTH } from '@features/storybook-creation/domain/storybook-draft'

export interface StorybookDescriptionFormSubmit {
  description: string
}

interface StorybookDescriptionFormProps {
  maxLength?: number
  isSubmitting?: boolean
  onSubmit: (payload: StorybookDescriptionFormSubmit) => void | Promise<void>
}

export function StorybookDescriptionForm({
  maxLength = MAX_STORY_DESCRIPTION_LENGTH,
  isSubmitting = false,
  onSubmit,
}: StorybookDescriptionFormProps) {
  const { t } = useTranslation()
  const [description, setDescription] = useState('')

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
    })
  }

  return (
    <form className="compose-form" onSubmit={handleSubmit} noValidate>
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
