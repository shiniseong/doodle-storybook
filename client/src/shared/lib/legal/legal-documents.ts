export type RequiredAgreementKey = 'termsOfService' | 'adultPayer' | 'noDirectChildDataCollection'

export type LegalDocumentLanguage = 'ko' | 'en' | 'ja' | 'zh'

const LEGAL_DOCUMENT_BASE_PATH = '/legal'
const LEGAL_DOCUMENT_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const DEFAULT_PUBLIC_LEGAL_DOCUMENT_VERSION = '2026-02-24'

const LEGAL_DOCUMENT_SLUGS: Record<RequiredAgreementKey, string> = {
  termsOfService: 'terms-of-service',
  adultPayer: 'adult-payer-notice',
  noDirectChildDataCollection: 'child-data-policy',
}

export function normalizeLegalDocumentLanguage(language: string): LegalDocumentLanguage {
  const normalizedLanguage = language.toLowerCase()

  if (normalizedLanguage.startsWith('ko')) {
    return 'ko'
  }

  if (normalizedLanguage.startsWith('ja')) {
    return 'ja'
  }

  if (normalizedLanguage.startsWith('zh')) {
    return 'zh'
  }

  return 'en'
}

export function resolveLegalDocumentLanguageCandidates(language: LegalDocumentLanguage): LegalDocumentLanguage[] {
  if (language === 'ko') {
    return ['ko', 'en']
  }

  if (language === 'ja') {
    return ['ja', 'en', 'ko']
  }

  if (language === 'zh') {
    return ['zh', 'en', 'ko']
  }

  return ['en', 'ko']
}

export function normalizeLegalDocumentVersion(version: string): string | null {
  const normalizedVersion = version.trim()

  if (!LEGAL_DOCUMENT_VERSION_PATTERN.test(normalizedVersion)) {
    return null
  }

  return normalizedVersion
}

export function buildLegalDocumentPath({
  key,
  language,
  version,
}: {
  key: RequiredAgreementKey
  language: LegalDocumentLanguage
  version: string
}): string {
  return `${LEGAL_DOCUMENT_BASE_PATH}/${version}/${language}/${LEGAL_DOCUMENT_SLUGS[key]}.md`
}
