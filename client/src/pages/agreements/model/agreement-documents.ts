import {
  buildLegalDocumentPath,
  normalizeLegalDocumentLanguage,
  normalizeLegalDocumentVersion,
  resolveLegalDocumentLanguageCandidates,
  type RequiredAgreementKey,
} from '@shared/lib/legal/legal-documents'

export type { RequiredAgreementKey }

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
  const normalizedVersion = normalizeLegalDocumentVersion(requiredVersion)
  if (!normalizedVersion) {
    throw new Error('Invalid required agreements version.')
  }

  const preferredLanguage = normalizeLegalDocumentLanguage(language)
  const candidates = resolveLegalDocumentLanguageCandidates(preferredLanguage)

  for (const candidate of candidates) {
    const path = buildLegalDocumentPath({
      key,
      language: candidate,
      version: normalizedVersion,
    })
    const text = await fetchDocumentText(path)

    if (text) {
      return text
    }
  }

  throw new Error(`Failed to load agreement document: ${key}`)
}
