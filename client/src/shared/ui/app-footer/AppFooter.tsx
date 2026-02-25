import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import {
  buildLegalDocumentPath,
  DEFAULT_PUBLIC_LEGAL_DOCUMENT_VERSION,
  normalizeLegalDocumentLanguage,
} from '@shared/lib/legal/legal-documents'

import './AppFooter.css'

export function AppFooter() {
  const { i18n, t } = useTranslation()
  const legalLanguage = normalizeLegalDocumentLanguage(i18n.language)
  const legalVersion = DEFAULT_PUBLIC_LEGAL_DOCUMENT_VERSION
  const appName = t('common.appName')
  const currentYear = new Date().getFullYear()

  const legalLinks = [
    {
      key: 'termsOfService' as const,
      label: t('common.footer.termsLink'),
    },
    {
      key: 'adultPayer' as const,
      label: t('common.footer.adultPayerLink'),
    },
    {
      key: 'noDirectChildDataCollection' as const,
      label: t('common.footer.childPolicyLink'),
    },
  ]

  return (
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
              const href = buildLegalDocumentPath({
                key: item.key,
                language: legalLanguage,
                version: legalVersion,
              })

              return (
                <li key={item.key}>
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {item.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
