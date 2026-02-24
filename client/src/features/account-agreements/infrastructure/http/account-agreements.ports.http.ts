import {
  type AccountAgreementsPort,
  type AccountAgreementsStatus,
} from '@features/account-agreements/application/account-agreements.use-case'

interface HttpAccountAgreementsPortOptions {
  baseUrl?: string
  accessToken?: string | null
}

interface AgreementStatusCandidate {
  requiredVersion?: unknown
  hasAcceptedRequiredAgreements?: unknown
  agreements?: unknown
  acceptedAt?: unknown
}

interface AgreementErrorCandidate {
  error?: unknown
  message?: unknown
  detail?: unknown
  details?: unknown
  hint?: unknown
}

function resolveApiBaseUrl(explicitBaseUrl?: string): string {
  if (explicitBaseUrl) {
    return explicitBaseUrl
  }

  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined
  return fromEnv ?? ''
}

function createJsonHeaders(accessToken?: string | null): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
  })

  if (typeof accessToken === 'string' && accessToken.trim().length > 0) {
    headers.set('Authorization', `Bearer ${accessToken.trim()}`)
  }

  return headers
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as AgreementErrorCandidate
  const baseMessage = [candidate.error, candidate.message]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .find((value) => value.length > 0)

  const detail = [candidate.detail, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .find((value) => value.length > 0)

  if (baseMessage && detail && detail !== baseMessage) {
    return `${baseMessage} (${detail})`
  }

  return baseMessage ?? detail ?? null
}

function normalizeStatus(payload: unknown): AccountAgreementsStatus | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as AgreementStatusCandidate
  if (typeof candidate.requiredVersion !== 'string') {
    return null
  }

  if (candidate.hasAcceptedRequiredAgreements !== true && candidate.hasAcceptedRequiredAgreements !== false) {
    return null
  }

  if (!candidate.agreements || typeof candidate.agreements !== 'object') {
    return null
  }

  const agreementsCandidate = candidate.agreements as {
    termsOfService?: unknown
    adultPayer?: unknown
    noDirectChildDataCollection?: unknown
  }

  if (
    (agreementsCandidate.termsOfService !== true && agreementsCandidate.termsOfService !== false) ||
    (agreementsCandidate.adultPayer !== true && agreementsCandidate.adultPayer !== false) ||
    (agreementsCandidate.noDirectChildDataCollection !== true && agreementsCandidate.noDirectChildDataCollection !== false)
  ) {
    return null
  }

  if (candidate.acceptedAt !== null && typeof candidate.acceptedAt !== 'string') {
    return null
  }

  return {
    requiredVersion: candidate.requiredVersion,
    hasAcceptedRequiredAgreements: candidate.hasAcceptedRequiredAgreements,
    agreements: {
      termsOfService: agreementsCandidate.termsOfService,
      adultPayer: agreementsCandidate.adultPayer,
      noDirectChildDataCollection: agreementsCandidate.noDirectChildDataCollection,
    },
    acceptedAt: normalizeString(candidate.acceptedAt) ?? null,
  }
}

export class HttpAccountAgreementsPort implements AccountAgreementsPort {
  private readonly baseUrl: string
  private readonly accessToken: string | null

  constructor(options: HttpAccountAgreementsPortOptions = {}) {
    this.baseUrl = resolveApiBaseUrl(options.baseUrl)
    this.accessToken = options.accessToken ?? null
  }

  async getStatus(): Promise<AccountAgreementsStatus> {
    const response = await fetch(`${this.baseUrl}/api/account/agreements`, {
      method: 'GET',
      headers: createJsonHeaders(this.accessToken),
    })

    if (!response.ok) {
      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      const message = normalizeApiErrorMessage(payload)
      throw new Error(
        message
          ? `Failed to fetch required agreements status (${response.status}): ${message}`
          : `Failed to fetch required agreements status: ${response.status}`,
      )
    }

    const normalized = normalizeStatus(await response.json())
    if (!normalized) {
      throw new Error('Invalid API response: required agreements status payload is missing.')
    }

    return normalized
  }

  async acceptAllRequiredAgreements(): Promise<AccountAgreementsStatus> {
    const response = await fetch(`${this.baseUrl}/api/account/agreements`, {
      method: 'POST',
      headers: createJsonHeaders(this.accessToken),
      body: JSON.stringify({
        termsOfService: true,
        adultPayer: true,
        noDirectChildDataCollection: true,
      }),
    })

    if (!response.ok) {
      let payload: unknown = null
      try {
        payload = await response.json()
      } catch {
        payload = null
      }

      const message = normalizeApiErrorMessage(payload)
      throw new Error(
        message
          ? `Failed to persist required agreements (${response.status}): ${message}`
          : `Failed to persist required agreements: ${response.status}`,
      )
    }

    const normalized = normalizeStatus(await response.json())
    if (!normalized) {
      throw new Error('Invalid API response: required agreements status payload is missing.')
    }

    return normalized
  }
}
