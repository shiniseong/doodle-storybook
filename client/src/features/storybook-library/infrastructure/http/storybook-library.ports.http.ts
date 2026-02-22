import {
  type ListStorybooksRequest,
  type ListStorybooksResponse,
  type StorybookLibraryItem,
  type StorybookLibraryQueryPort,
} from '@features/storybook-library/application/list-storybooks.use-case'

interface StorybookListApiResponse {
  items?: unknown
}

interface StorybookListApiErrorResponse {
  error?: unknown
  message?: unknown
  detail?: unknown
  details?: unknown
  hint?: unknown
}

interface HttpStorybookLibraryQueryPortOptions {
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

function normalizeListItem(raw: unknown): StorybookLibraryItem | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as {
    storybookId?: unknown
    title?: unknown
    authorName?: unknown
    originImageUrl?: unknown
    createdAt?: unknown
  }

  if (typeof candidate.storybookId !== 'string' || candidate.storybookId.trim().length === 0) {
    return null
  }

  if (typeof candidate.title !== 'string' || candidate.title.trim().length === 0) {
    return null
  }

  return {
    storybookId: candidate.storybookId.trim(),
    title: candidate.title.trim(),
    authorName: typeof candidate.authorName === 'string' && candidate.authorName.trim().length > 0 ? candidate.authorName.trim() : null,
    originImageUrl:
      typeof candidate.originImageUrl === 'string' && candidate.originImageUrl.trim().length > 0
        ? candidate.originImageUrl.trim()
        : null,
    createdAt: typeof candidate.createdAt === 'string' && candidate.createdAt.trim().length > 0 ? candidate.createdAt.trim() : null,
  }
}

function parseApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as StorybookListApiErrorResponse
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

export class HttpStorybookLibraryQueryPort implements StorybookLibraryQueryPort {
  private readonly baseUrl: string
  private readonly endpointPath: string
  private readonly accessToken: string | null

  constructor(options: HttpStorybookLibraryQueryPortOptions = {}) {
    this.baseUrl = resolveApiBaseUrl(options.baseUrl)
    this.endpointPath = options.endpointPath ?? '/api/storybooks'
    this.accessToken = options.accessToken ?? null
  }

  async listStorybooks(request: ListStorybooksRequest): Promise<ListStorybooksResponse> {
    const query = new URLSearchParams({
      userId: request.userId,
      ...(typeof request.limit === 'number' && Number.isFinite(request.limit) && request.limit > 0
        ? { limit: `${Math.floor(request.limit)}` }
        : {}),
    })
    const endpointUrl = `${this.baseUrl}${this.endpointPath}?${query.toString()}`

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
          ? `Failed to fetch storybook list (${response.status}): ${detailedMessage}`
          : `Failed to fetch storybook list: ${response.status}`,
      )
    }

    const data = (await response.json()) as StorybookListApiResponse
    const items = Array.isArray(data.items) ? data.items.map((item) => normalizeListItem(item)).filter((item): item is StorybookLibraryItem => item !== null) : []

    return {
      items,
    }
  }
}
