import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import {
  buildLegalDocumentPath,
  DEFAULT_PUBLIC_LEGAL_DOCUMENT_VERSION,
  normalizeLegalDocumentVersion,
  normalizeLegalDocumentLanguage,
  resolveLegalDocumentLanguageCandidates,
  type RequiredAgreementKey,
} from '@shared/lib/legal/legal-documents'

import './AppFooter.css'

interface FooterLegalLinkItem {
  key: RequiredAgreementKey
  label: string
  documentTitle: string
}

async function fetchLegalDocumentText(path: string): Promise<string | null> {
  try {
    const response = await fetch(path, {
      method: 'GET',
      headers: {
        Accept: 'text/plain',
      },
    })

    if (!response.ok) {
      return null
    }

    const text = await response.text()
    const normalizedText = text.trim()
    return normalizedText.length > 0 ? normalizedText : null
  } catch {
    return null
  }
}

async function loadFooterLegalDocument(key: RequiredAgreementKey, language: string, version: string): Promise<string> {
  const normalizedVersion = normalizeLegalDocumentVersion(version)
  if (!normalizedVersion) {
    throw new Error('Invalid required agreements version.')
  }

  const preferredLanguage = normalizeLegalDocumentLanguage(language)
  const languageCandidates = resolveLegalDocumentLanguageCandidates(preferredLanguage)

  for (const candidate of languageCandidates) {
    const path = buildLegalDocumentPath({
      key,
      language: candidate,
      version: normalizedVersion,
    })
    const text = await fetchLegalDocumentText(path)
    if (text) {
      return text
    }
  }

  throw new Error(`Failed to load agreement document: ${key}`)
}

export function AppFooter() {
  const { i18n, t } = useTranslation()
  const legalVersion = DEFAULT_PUBLIC_LEGAL_DOCUMENT_VERSION
  const appName = t('common.appName')
  const currentYear = new Date().getFullYear()
  const [activeDocumentKey, setActiveDocumentKey] = useState<RequiredAgreementKey | null>(null)
  const [activeDocumentTitle, setActiveDocumentTitle] = useState('')
  const [activeDocumentContent, setActiveDocumentContent] = useState('')
  const [activeDocumentErrorMessage, setActiveDocumentErrorMessage] = useState<string | null>(null)
  const [isDocumentLoading, setIsDocumentLoading] = useState(false)
  const documentRequestIdRef = useRef(0)

  const legalLinks: FooterLegalLinkItem[] = [
    {
      key: 'termsOfService',
      label: t('common.footer.termsLink'),
      documentTitle: t('agreementsPage.documents.termsOfServiceTitle'),
    },
    {
      key: 'adultPayer',
      label: t('common.footer.adultPayerLink'),
      documentTitle: t('agreementsPage.documents.adultPayerTitle'),
    },
    {
      key: 'noDirectChildDataCollection',
      label: t('common.footer.childPolicyLink'),
      documentTitle: t('agreementsPage.documents.noDirectChildDataCollectionTitle'),
    },
  ]

  const closeDocumentDialog = useCallback(() => {
    documentRequestIdRef.current += 1
    setActiveDocumentKey(null)
    setActiveDocumentTitle('')
    setActiveDocumentContent('')
    setActiveDocumentErrorMessage(null)
    setIsDocumentLoading(false)
  }, [])

  const openDocumentDialog = useCallback(
    async (item: FooterLegalLinkItem) => {
      setActiveDocumentKey(item.key)
      setActiveDocumentTitle(item.documentTitle)
      setActiveDocumentContent('')
      setActiveDocumentErrorMessage(null)
      setIsDocumentLoading(true)
      const requestId = documentRequestIdRef.current + 1
      documentRequestIdRef.current = requestId

      try {
        const content = await loadFooterLegalDocument(item.key, i18n.language, legalVersion)
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
    [i18n.language, legalVersion, t],
  )

  useEffect(() => {
    if (!activeDocumentKey) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeDocumentDialog()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [activeDocumentKey, closeDocumentDialog])

  return (
    <>
      <footer className="app-footer" role="contentinfo" data-testid="app-footer">
        <div className="app-footer__inner">
          <section className="app-footer__brand" aria-label={appName}>
            <p className="app-footer__brand-name">{appName}</p>
            <p className="app-footer__brand-subtitle">{t('common.appSubtitle')}</p>
            <p className="app-footer__brand-copy">{t('common.footer.copyright', { year: currentYear, appName })}</p>
          </section>

          <nav className="app-footer__nav" aria-label={t('common.footer.productSection')}>
            <p className="app-footer__heading">{t('common.footer.productSection')}</p>
            <ul>
              <li>
                <Link to="/create">{t('common.footer.createLink')}</Link>
              </li>
              <li>
                <Link to="/library">{t('common.footer.libraryLink')}</Link>
              </li>
            </ul>
          </nav>

          <nav className="app-footer__nav" aria-label={t('common.footer.legalSection')}>
            <p className="app-footer__heading">{t('common.footer.legalSection')}</p>
            <ul>
              {legalLinks.map((item) => {
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      className="app-footer__legal-link"
                      onClick={() => {
                        void openDocumentDialog(item)
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      </footer>

      {activeDocumentKey ? (
        <div
          className="app-footer__dialog-overlay"
          role="presentation"
          onClick={() => {
            closeDocumentDialog()
          }}
        >
          <section
            className="app-footer__dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="footer-legal-document-title"
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <header className="app-footer__dialog-header">
              <h2 id="footer-legal-document-title">{activeDocumentTitle}</h2>
              <button type="button" className="app-footer__dialog-close" onClick={closeDocumentDialog}>
                {t('common.actions.close')}
              </button>
            </header>

            <div className="app-footer__dialog-body">
              {isDocumentLoading ? <p className="app-footer__dialog-loading">{t('agreementsPage.documentLoading')}</p> : null}

              {!isDocumentLoading && activeDocumentErrorMessage ? (
                <p className="app-footer__dialog-error">{activeDocumentErrorMessage}</p>
              ) : null}

              {!isDocumentLoading && !activeDocumentErrorMessage ? (
                <div className="app-footer__document-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeDocumentContent}</ReactMarkdown>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
