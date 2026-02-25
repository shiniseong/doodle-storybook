import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  loadAgreementDocument,
  type RequiredAgreementKey,
} from '@pages/agreements/model/agreement-documents'
import {
  DEFAULT_PUBLIC_LEGAL_DOCUMENT_VERSION,
  normalizeLegalDocumentVersion,
} from '@shared/lib/legal/legal-documents'
import type { AccountAgreementsUseCasePort } from '@features/account-agreements/application/account-agreements.use-case'
import { LanguageSwitcher } from '@shared/ui/language-switcher/LanguageSwitcher'
import { ThemeToggle } from '@shared/ui/theme-toggle/ThemeToggle'

import './AgreementsPage.css'

type AgreementsState = Record<RequiredAgreementKey, boolean>

type AgreementDocumentLoader = (
  key: RequiredAgreementKey,
  language: string,
  requiredVersion: string,
) => Promise<string>

interface AgreementsPageProps {
  useCase?: AccountAgreementsUseCasePort
  onCompleted?: () => void
  documentLoader?: AgreementDocumentLoader
}

const DEFAULT_AGREEMENTS_STATE: AgreementsState = {
  termsOfService: false,
  adultPayer: false,
  noDirectChildDataCollection: false,
}

const DEFAULT_REVIEWED_DOCUMENTS_STATE: AgreementsState = {
  termsOfService: false,
  adultPayer: false,
  noDirectChildDataCollection: false,
}

export function AgreementsPage({ useCase, onCompleted, documentLoader = loadAgreementDocument }: AgreementsPageProps) {
  const { t, i18n } = useTranslation()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [agreements, setAgreements] = useState<AgreementsState>(DEFAULT_AGREEMENTS_STATE)
  const [reviewedDocuments, setReviewedDocuments] = useState<AgreementsState>(DEFAULT_REVIEWED_DOCUMENTS_STATE)
  const [requiredVersion, setRequiredVersion] = useState<string>(DEFAULT_PUBLIC_LEGAL_DOCUMENT_VERSION)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [activeDocumentKey, setActiveDocumentKey] = useState<RequiredAgreementKey | null>(null)
  const [activeDocumentTitle, setActiveDocumentTitle] = useState<string>('')
  const [activeDocumentContent, setActiveDocumentContent] = useState<string>('')
  const [activeDocumentErrorMessage, setActiveDocumentErrorMessage] = useState<string | null>(null)
  const [isDocumentLoading, setIsDocumentLoading] = useState(false)
  const documentRequestIdRef = useRef(0)

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

        setRequiredVersion(
          normalizeLegalDocumentVersion(status.requiredVersion) ?? DEFAULT_PUBLIC_LEGAL_DOCUMENT_VERSION,
        )
        setAgreements({ ...DEFAULT_AGREEMENTS_STATE })
        setReviewedDocuments({ ...DEFAULT_REVIEWED_DOCUMENTS_STATE })
        setErrorMessage(null)
      } catch {
        if (cancelled) {
          return
        }

        setRequiredVersion(DEFAULT_PUBLIC_LEGAL_DOCUMENT_VERSION)
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
    () => agreements.termsOfService && agreements.adultPayer && agreements.noDirectChildDataCollection,
    [agreements],
  )

  const agreementItems = useMemo(
    () =>
      [
        {
          key: 'termsOfService',
          checkboxLabel: t('agreementsPage.termsOfService'),
          documentTitle: t('agreementsPage.documents.termsOfServiceTitle'),
        },
        {
          key: 'adultPayer',
          checkboxLabel: t('agreementsPage.adultPayer'),
          documentTitle: t('agreementsPage.documents.adultPayerTitle'),
        },
        {
          key: 'noDirectChildDataCollection',
          checkboxLabel: t('agreementsPage.noDirectChildDataCollection'),
          documentTitle: t('agreementsPage.documents.noDirectChildDataCollectionTitle'),
        },
      ] as const,
    [t],
  )

  const closeDocumentDialog = useCallback(() => {
    documentRequestIdRef.current += 1
    setActiveDocumentKey(null)
    setActiveDocumentTitle('')
    setActiveDocumentContent('')
    setActiveDocumentErrorMessage(null)
    setIsDocumentLoading(false)
  }, [])

  const openDocumentDialog = useCallback(
    async (key: RequiredAgreementKey, title: string) => {
      if (isSubmitting) {
        return
      }

      setActiveDocumentKey(key)
      setActiveDocumentTitle(title)
      setActiveDocumentContent('')
      setActiveDocumentErrorMessage(null)
      setIsDocumentLoading(true)
      const requestId = documentRequestIdRef.current + 1
      documentRequestIdRef.current = requestId

      try {
        const content = await documentLoader(key, i18n.language, requiredVersion)
        if (documentRequestIdRef.current !== requestId) {
          return
        }
        setActiveDocumentContent(content)
      } catch {
        if (documentRequestIdRef.current !== requestId) {
          return
        }
        setActiveDocumentErrorMessage(t('agreementsPage.documentLoadError'))
      } finally {
        if (documentRequestIdRef.current === requestId) {
          setIsDocumentLoading(false)
        }
      }
    },
    [documentLoader, i18n.language, isSubmitting, requiredVersion, t],
  )

  const markDocumentAsReviewed = useCallback(() => {
    if (!activeDocumentKey) {
      return
    }

    setReviewedDocuments((previous) => ({
      ...previous,
      [activeDocumentKey]: true,
    }))
    closeDocumentDialog()
  }, [activeDocumentKey, closeDocumentDialog])

  const updateAgreement = useCallback((key: RequiredAgreementKey, checked: boolean) => {
    setAgreements((previous) => ({
      ...previous,
      [key]: checked,
    }))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!useCase) {
      setErrorMessage(t('agreementsPage.loadError'))
      return
    }

    if (!canSubmit || isSubmitting) {
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
          {agreementItems.map((item) => {
            const checkboxId = `agreement-${item.key}`
            const hasReviewedDocument = reviewedDocuments[item.key]
            const isChecked = agreements[item.key]

            return (
              <div className="agreements-page__item" key={item.key}>
                <label className="agreements-page__item-label" htmlFor={checkboxId}>
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={isChecked}
                    disabled={isLoading || isSubmitting || (!hasReviewedDocument && !isChecked)}
                    onChange={(event) => {
                      updateAgreement(item.key, event.target.checked)
                    }}
                  />
                  <span>{item.checkboxLabel}</span>
                </label>

                <div className="agreements-page__item-actions">
                  <button
                    type="button"
                    className="agreements-page__document-button"
                    disabled={isLoading || isSubmitting}
                    onClick={() => {
                      void openDocumentDialog(item.key, item.documentTitle)
                    }}
                  >
                    {hasReviewedDocument ? t('agreementsPage.reviewAgain') : t('agreementsPage.reviewDocument')}
                  </button>

                  {!hasReviewedDocument ? (
                    <p className="agreements-page__review-hint">{t('agreementsPage.reviewRequiredHint')}</p>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>

        <button
          type="button"
          className="agreements-page__submit"
          disabled={isLoading || isSubmitting || !canSubmit || !useCase}
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

      {activeDocumentKey ? (
        <div className="agreements-page__dialog-overlay" role="presentation">
          <section className="agreements-page__dialog" role="dialog" aria-modal="true" aria-labelledby="agreements-document-title">
            <header className="agreements-page__dialog-header">
              <h2 id="agreements-document-title">{activeDocumentTitle}</h2>
              <button type="button" className="agreements-page__dialog-close" onClick={closeDocumentDialog}>
                {t('common.actions.close')}
              </button>
            </header>

            <div className="agreements-page__dialog-body">
              {isDocumentLoading ? <p className="agreements-page__dialog-loading">{t('agreementsPage.documentLoading')}</p> : null}

              {!isDocumentLoading && activeDocumentErrorMessage ? (
                <p className="agreements-page__dialog-error">{activeDocumentErrorMessage}</p>
              ) : null}

              {!isDocumentLoading && !activeDocumentErrorMessage ? (
                <pre className="agreements-page__document-content">{activeDocumentContent}</pre>
              ) : null}
            </div>

            <footer className="agreements-page__dialog-actions">
              <button type="button" className="agreements-page__dialog-secondary" onClick={closeDocumentDialog}>
                {t('common.actions.cancel')}
              </button>
              {!isDocumentLoading && !activeDocumentErrorMessage ? (
                <button type="button" className="agreements-page__dialog-primary" onClick={markDocumentAsReviewed}>
                  {t('agreementsPage.markAsReviewed')}
                </button>
              ) : null}
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  )
}
