import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { AccountAgreementsUseCasePort } from '@features/account-agreements/application/account-agreements.use-case'
import { LanguageSwitcher } from '@shared/ui/language-switcher/LanguageSwitcher'
import { ThemeToggle } from '@shared/ui/theme-toggle/ThemeToggle'

import './AgreementsPage.css'

interface AgreementsPageProps {
  useCase?: AccountAgreementsUseCasePort
  onCompleted?: () => void
}

export function AgreementsPage({ useCase, onCompleted }: AgreementsPageProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [termsOfService, setTermsOfService] = useState(false)
  const [adultPayer, setAdultPayer] = useState(false)
  const [noDirectChildDataCollection, setNoDirectChildDataCollection] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!useCase) {
      setIsLoading(false)
      setErrorMessage(t('agreementsPage.loadError'))
      return
    }

    let cancelled = false

    const run = async () => {
      setIsLoading(true)
      try {
        const status = await useCase.getStatus()
        if (cancelled) {
          return
        }

        if (status.hasAcceptedRequiredAgreements) {
          onCompleted?.()
          return
        }

        setTermsOfService(status.agreements.termsOfService)
        setAdultPayer(status.agreements.adultPayer)
        setNoDirectChildDataCollection(status.agreements.noDirectChildDataCollection)
        setErrorMessage(null)
      } catch {
        if (cancelled) {
          return
        }

        setErrorMessage(t('agreementsPage.loadError'))
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [onCompleted, t, useCase])

  const canSubmit = useMemo(
    () => termsOfService && adultPayer && noDirectChildDataCollection,
    [adultPayer, noDirectChildDataCollection, termsOfService],
  )

  const handleSubmit = useCallback(async () => {
    if (!useCase || !canSubmit || isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const status = await useCase.acceptAllRequiredAgreements()
      if (!status.hasAcceptedRequiredAgreements) {
        setErrorMessage(t('agreementsPage.saveError'))
        return
      }

      onCompleted?.()
    } catch {
      setErrorMessage(t('agreementsPage.saveError'))
    } finally {
      setIsSubmitting(false)
    }
  }, [canSubmit, isSubmitting, onCompleted, t, useCase])

  return (
    <div className="agreements-page">
      <div className="agreements-page__backdrop" aria-hidden="true" />
      <main className="agreements-page__card" aria-labelledby="agreements-page-title">
        <header className="agreements-page__header">
          <ThemeToggle />
          <LanguageSwitcher />
        </header>

        <h1 id="agreements-page-title">{t('agreementsPage.title')}</h1>
        <p className="agreements-page__description">{t('agreementsPage.description')}</p>

        {isLoading ? <p className="agreements-page__loading">{t('agreementsPage.checking')}</p> : null}

        <div className="agreements-page__list" role="group" aria-label={t('agreementsPage.title')}>
          <label className="agreements-page__item">
            <input
              type="checkbox"
              checked={termsOfService}
              disabled={isLoading || isSubmitting}
              onChange={(event) => {
                setTermsOfService(event.target.checked)
              }}
            />
            <span>{t('agreementsPage.termsOfService')}</span>
          </label>

          <label className="agreements-page__item">
            <input
              type="checkbox"
              checked={adultPayer}
              disabled={isLoading || isSubmitting}
              onChange={(event) => {
                setAdultPayer(event.target.checked)
              }}
            />
            <span>{t('agreementsPage.adultPayer')}</span>
          </label>

          <label className="agreements-page__item">
            <input
              type="checkbox"
              checked={noDirectChildDataCollection}
              disabled={isLoading || isSubmitting}
              onChange={(event) => {
                setNoDirectChildDataCollection(event.target.checked)
              }}
            />
            <span>{t('agreementsPage.noDirectChildDataCollection')}</span>
          </label>
        </div>

        <button
          type="button"
          className="agreements-page__submit"
          disabled={isLoading || isSubmitting || !canSubmit}
          onClick={() => {
            void handleSubmit()
          }}
        >
          {isSubmitting ? t('agreementsPage.submitting') : t('agreementsPage.submit')}
        </button>

        <p className="agreements-page__error" aria-live="polite">
          {errorMessage ?? ''}
        </p>
      </main>
    </div>
  )
}
