import { type StoryLanguage } from '@entities/storybook/model/storybook'
import {
  type CreateStorybookResponse,
  type StorybookCommandPort,
} from '@features/storybook-creation/application/create-storybook.use-case'
import { parseStorybookDetailResponse } from '@entities/storybook/lib/parse-storybook-detail-response'

interface CreateStorybookApiErrorResponse {
  error?: unknown
  message?: unknown
  detail?: unknown
  details?: unknown
  hint?: unknown
  failedAssets?: unknown
}

interface CreateStorybookApiRequest {
  userId: string
  title?: string
  authorName?: string
  description: string
  language: StoryLanguage
  imageDataUrl?: string
}

interface HttpStorybookCommandPortOptions {
  baseUrl?: string
  endpointPath?: string
}

function parseApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as CreateStorybookApiErrorResponse
  const baseMessageCandidates = [candidate.error, candidate.message]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  const baseMessage = baseMessageCandidates[0] ?? null

  let message = baseMessage
  if (message && Array.isArray(candidate.failedAssets) && candidate.failedAssets.length > 0) {
    const failedAssetDetails = candidate.failedAssets
      .filter((item): item is { key?: unknown; reason?: unknown } => typeof item === 'object' && item !== null)
      .slice(0, 3)
      .map((item) => {
        const key = typeof item.key === 'string' ? item.key : 'unknown-key'
        const reason = typeof item.reason === 'string' ? item.reason : 'unknown-reason'
        return `${key} (${reason})`
      })

    if (failedAssetDetails.length > 0) {
      message = `${message} ${failedAssetDetails.join(', ')}`
    }
  }

  const detailCandidates = [candidate.detail, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value) => value !== baseMessage)
  const detail = detailCandidates[0] ?? null

  if (message && detail) {
    return `${message} (${detail})`
  }

  if (message) {
    return message
  }

  if (detail) {
    return detail
  }

  return null
}

function resolveCanvasImageDataUrl(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }

  const canvas = document.querySelector<HTMLCanvasElement>('.canvas-stage__surface')

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    return undefined
  }

  try {
    return canvas.toDataURL('image/png')
  } catch {
    return undefined
  }
}

function resolveApiBaseUrl(explicitBaseUrl?: string): string {
  if (explicitBaseUrl) {
    return explicitBaseUrl
  }

  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined
  return fromEnv ?? ''
}

export class HttpStorybookCommandPort implements StorybookCommandPort {
  private readonly baseUrl: string
  private readonly endpointPath: string

  constructor(options: HttpStorybookCommandPortOptions = {}) {
    this.baseUrl = resolveApiBaseUrl(options.baseUrl)
    this.endpointPath = options.endpointPath ?? '/api/storybooks'
  }

  async createStorybook(draft: {
    userId: string
    title?: string
    authorName?: string
    description: string
    language: StoryLanguage
  }): Promise<CreateStorybookResponse> {
    const endpointUrl = `${this.baseUrl}${this.endpointPath}`
    const imageDataUrl = resolveCanvasImageDataUrl()
    const payload: CreateStorybookApiRequest = {
      userId: draft.userId,
      title: draft.title,
      authorName: draft.authorName,
      description: draft.description,
      language: draft.language,
      ...(imageDataUrl ? { imageDataUrl } : {}),
    }

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
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
          ? `Failed to create storybook (${response.status}): ${detailedMessage}`
          : `Failed to create storybook: ${response.status}`,
      )
    }

    const parsed = parseStorybookDetailResponse(await response.json())
    if (!parsed) {
      throw new Error('Invalid API response: storybook detail payload is missing.')
    }

    return parsed
  }
}
