export type RequiredAgreementKey = 'termsOfService' | 'adultPayer' | 'noDirectChildDataCollection'

type AgreementLanguageCode = 'ko' | 'en' | 'ja' | 'zh'

interface AgreementDocumentManifest {
  readonly slug: string
}

const AGREEMENT_DOCUMENT_BASE_PATH = '/legal'
const AGREEMENTS_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const AGREEMENT_DOCUMENT_MANIFEST: Record<RequiredAgreementKey, AgreementDocumentManifest> = {
  termsOfService: {
    slug: 'terms-of-service',
  },
  adultPayer: {
    slug: 'adult-payer-notice',
  },
  noDirectChildDataCollection: {
    slug: 'child-data-policy',
  },
}

function normalizeAgreementLanguage(language: string): AgreementLanguageCode {
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

function resolveLanguageCandidates(language: AgreementLanguageCode): AgreementLanguageCode[] {
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

function normalizeAgreementVersion(requiredVersion: string): string | null {
  const normalizedVersion = requiredVersion.trim()

  if (!AGREEMENTS_VERSION_PATTERN.test(normalizedVersion)) {
    return null
  }

  return normalizedVersion
}

async function fetchDocumentText(path: string): Promise<string | null> {
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

export async function loadAgreementDocument(
  key: RequiredAgreementKey,
  language: string,
  requiredVersion: string,
): Promise<string> {
  const normalizedVersion = normalizeAgreementVersion(requiredVersion)
  if (!normalizedVersion) {
    throw new Error('Invalid required agreements version.')
  }

  const manifest = AGREEMENT_DOCUMENT_MANIFEST[key]
  const preferredLanguage = normalizeAgreementLanguage(language)
  const candidates = resolveLanguageCandidates(preferredLanguage)

  for (const candidate of candidates) {
    const path = `${AGREEMENT_DOCUMENT_BASE_PATH}/${normalizedVersion}/${candidate}/${manifest.slug}.md`
    const text = await fetchDocumentText(path)

    if (text) {
      return text
    }
  }

  throw new Error(`Failed to load agreement document: ${key}`)
}
