import {
  type DeleteStorybookRequest,
  type StorybookDeletionCommandPort,
} from '@features/storybook-deletion/application/delete-storybook.use-case'

interface StorybookDeleteApiErrorResponse {
  error?: unknown
  message?: unknown
  detail?: unknown
  details?: unknown
  hint?: unknown
}

interface HttpStorybookDeletionCommandPortOptions {
  baseUrl?: string
  endpointPath?: string
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

  const candidate = payload as StorybookDeleteApiErrorResponse
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

export class HttpStorybookDeletionCommandPort implements StorybookDeletionCommandPort {
  private readonly baseUrl: string
  private readonly endpointPath: string

  constructor(options: HttpStorybookDeletionCommandPortOptions = {}) {
    this.baseUrl = resolveApiBaseUrl(options.baseUrl)
    this.endpointPath = options.endpointPath ?? '/api/storybooks'
  }

  async deleteStorybook(request: DeleteStorybookRequest): Promise<void> {
    const query = new URLSearchParams({
      userId: request.userId,
    })
    const endpointUrl = `${this.baseUrl}${this.endpointPath}/${encodeURIComponent(request.storybookId)}?${query.toString()}`

    const response = await fetch(endpointUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      return
    }

    let parsedErrorBody: unknown = null

    try {
      parsedErrorBody = await response.json()
    } catch {
      parsedErrorBody = null
    }

    const detailedMessage = parseApiErrorMessage(parsedErrorBody)
    throw new Error(
      detailedMessage
        ? `Failed to delete storybook (${response.status}): ${detailedMessage}`
        : `Failed to delete storybook: ${response.status}`,
    )
  }
}
