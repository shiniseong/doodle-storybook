import type { StorybookDetailResponse } from '@entities/storybook/model/storybook-detail'
import {
  type GetStorybookDetailRequest,
  type StorybookDetailQueryPort,
} from '@features/storybook-detail/application/get-storybook-detail.use-case'
import { parseStorybookDetailResponse } from '@entities/storybook/lib/parse-storybook-detail-response'

interface StorybookDetailApiErrorResponse {
  error?: unknown
  message?: unknown
  detail?: unknown
  details?: unknown
  hint?: unknown
}

interface HttpStorybookDetailQueryPortOptions {
  baseUrl?: string
  endpointPath?: string
  accessToken?: string | null
}

function resolveApiBaseUrl(explicitBaseUrl?: string): string {
  if (explicitBaseUrl) {
    return explicitBaseUrl
  }

  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined
  return fromEnv ?? ''
}

function parseApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as StorybookDetailApiErrorResponse
  const baseMessageCandidates = [candidate.error, candidate.message]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  const baseMessage = baseMessageCandidates[0] ?? null
  const detailCandidates = [candidate.detail, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => value !== baseMessage)
  const detail = detailCandidates[0] ?? null

  if (baseMessage && detail) {
    return `${baseMessage} (${detail})`
  }

  if (baseMessage) {
    return baseMessage
  }

  if (detail) {
    return detail
  }

  return null
}

export class HttpStorybookDetailQueryPort implements StorybookDetailQueryPort {
  private readonly baseUrl: string
  private readonly endpointPath: string
  private readonly accessToken: string | null

  constructor(options: HttpStorybookDetailQueryPortOptions = {}) {
    this.baseUrl = resolveApiBaseUrl(options.baseUrl)
    this.endpointPath = options.endpointPath ?? '/api/storybooks'
    this.accessToken = options.accessToken ?? null
  }

  async getStorybookDetail(request: GetStorybookDetailRequest): Promise<StorybookDetailResponse> {
    const query = new URLSearchParams({
      userId: request.userId,
    })
    const endpointUrl = `${this.baseUrl}${this.endpointPath}/${request.storybookId}?${query.toString()}`

    const response = await fetch(endpointUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
    })

    if (!response.ok) {
      let parsedErrorBody: unknown = null

      try {
        parsedErrorBody = await response.json()
      } catch {
        parsedErrorBody = null
      }

      const detailedMessage = parseApiErrorMessage(parsedErrorBody)
      throw new Error(
        detailedMessage
          ? `Failed to fetch storybook detail (${response.status}): ${detailedMessage}`
          : `Failed to fetch storybook detail: ${response.status}`,
      )
    }

    const parsed = parseStorybookDetailResponse(await response.json())
    if (!parsed) {
      throw new Error('Invalid API response: storybook detail payload is missing.')
    }

    return parsed
  }
}
