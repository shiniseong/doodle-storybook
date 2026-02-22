import { type StoryLanguage } from '@entities/storybook/model/storybook'
import {
  type StorybookCommandPort,
  type StorybookGeneratedNarration,
  type StorybookGeneratedPage,
} from '@features/storybook-creation/application/create-storybook.use-case'

interface CreateStorybookApiResponse {
  storybookId: string
  openaiResponseId?: string | null
  pages?: unknown
  images?: unknown
  narrations?: unknown
  storyText?: string | null
  promptVersion?: string | number | null
}

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
  description: string
  language: StoryLanguage
  imageDataUrl?: string
}

interface HttpStorybookCommandPortOptions {
  baseUrl?: string
  endpointPath?: string
}

function parseStorybookPagesArray(candidate: unknown): StorybookGeneratedPage[] {
  if (!Array.isArray(candidate)) {
    return []
  }

  return candidate
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const pageCandidate = item as {
        page?: unknown
        content?: unknown
        isHighlight?: unknown
      }

      if (
        typeof pageCandidate.page !== 'number' ||
        !Number.isFinite(pageCandidate.page) ||
        typeof pageCandidate.content !== 'string' ||
        typeof pageCandidate.isHighlight !== 'boolean'
      ) {
        return null
      }

      return {
        page: pageCandidate.page,
        content: pageCandidate.content.trim(),
        isHighlight: pageCandidate.isHighlight,
      }
    })
    .filter((page): page is StorybookGeneratedPage => page !== null)
    .sort((left, right) => left.page - right.page)
}

function parseStorybookPagesFromObject(candidate: unknown): StorybookGeneratedPage[] {
  if (!candidate || typeof candidate !== 'object') {
    return []
  }

  const pagesCandidate = (candidate as { pages?: unknown }).pages
  if (typeof pagesCandidate === 'string' || Array.isArray(pagesCandidate)) {
    return parseStorybookPages(pagesCandidate)
  }

  return parseStorybookPagesArray(pagesCandidate)
}

function extractJsonLikeBlock(rawText: string): string {
  const fencedBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedBlockMatch?.[1]) {
    return fencedBlockMatch[1].trim()
  }

  return rawText.trim()
}

function parseStorybookPages(rawValue: unknown): StorybookGeneratedPage[] {
  if (Array.isArray(rawValue)) {
    return parseStorybookPagesArray(rawValue)
  }

  if (typeof rawValue !== 'string' || rawValue.trim().length === 0) {
    return parseStorybookPagesFromObject(rawValue)
  }

  const normalized = extractJsonLikeBlock(rawValue)

  try {
    const parsed = JSON.parse(normalized) as unknown
    const parsedAsArray = parseStorybookPagesArray(parsed)

    if (parsedAsArray.length > 0) {
      return parsedAsArray
    }

    return parseStorybookPagesFromObject(parsed)
  } catch {
    const startIndex = normalized.indexOf('[')
    const endIndex = normalized.lastIndexOf(']')

    if (startIndex === -1 || endIndex <= startIndex) {
      return []
    }

    try {
      const parsed = JSON.parse(normalized.slice(startIndex, endIndex + 1)) as unknown
      return parseStorybookPagesArray(parsed)
    } catch {
      return []
    }
  }
}

function normalizeGeneratedImageDataUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  const compact = value.trim().replace(/\s+/g, '')
  if (
    compact.startsWith('http://') ||
    compact.startsWith('https://') ||
    compact.startsWith('//') ||
    compact.startsWith('/') ||
    compact.startsWith('{cloud_flare_r2}')
  ) {
    return compact
  }

  const normalized = compact
    .replace(/^data:\s*/i, 'data:')
    .replace(/^data:image\/([a-z0-9.+-]+);bas64,/i, 'data:image/$1;base64,')

  if (normalized.startsWith('data:image/')) {
    return normalized
  }

  return `data:image/png;base64,${normalized}`
}

function parseGeneratedImages(rawValue: unknown): string[] {
  if (!Array.isArray(rawValue)) {
    return []
  }

  return rawValue
    .map((image) => normalizeGeneratedImageDataUrl(image))
    .filter((image): image is string => image !== null)
}

function normalizeNarrationAudioDataUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  const compact = value.trim().replace(/\s+/g, '')
  if (
    compact.startsWith('http://') ||
    compact.startsWith('https://') ||
    compact.startsWith('//') ||
    compact.startsWith('/') ||
    compact.startsWith('{cloud_flare_r2}')
  ) {
    return compact
  }

  if (compact.startsWith('data:audio/')) {
    return compact
  }

  return `data:audio/mpeg;base64,${compact}`
}

function parseGeneratedNarrations(rawValue: unknown): StorybookGeneratedNarration[] {
  if (!Array.isArray(rawValue)) {
    return []
  }

  return rawValue
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const narrationCandidate = item as {
        page?: unknown
        audioDataUrl?: unknown
      }

      if (
        typeof narrationCandidate.page !== 'number' ||
        !Number.isFinite(narrationCandidate.page)
      ) {
        return null
      }

      const normalizedAudioDataUrl = normalizeNarrationAudioDataUrl(narrationCandidate.audioDataUrl)
      if (!normalizedAudioDataUrl) {
        return null
      }

      return {
        page: narrationCandidate.page,
        audioDataUrl: normalizedAudioDataUrl,
      }
    })
    .filter((narration): narration is StorybookGeneratedNarration => narration !== null)
    .sort((left, right) => left.page - right.page)
}

function parsePromptVersion(rawValue: unknown): string | undefined {
  if (typeof rawValue === 'string' && rawValue.trim().length > 0) {
    return rawValue.trim()
  }

  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    return `${rawValue}`
  }

  return undefined
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
    description: string
    language: StoryLanguage
  }): Promise<{
    storybookId: string
    openaiResponseId?: string | null
    pages?: StorybookGeneratedPage[]
    images?: string[]
    narrations?: StorybookGeneratedNarration[]
    storyText?: string | null
    promptVersion?: string | null
  }> {
    const endpointUrl = `${this.baseUrl}${this.endpointPath}`
    const imageDataUrl = resolveCanvasImageDataUrl()
    const payload: CreateStorybookApiRequest = {
      userId: draft.userId,
      title: draft.title,
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

    const data = (await response.json()) as Partial<CreateStorybookApiResponse>

    if (!data.storybookId || typeof data.storybookId !== 'string') {
      throw new Error('Invalid API response: storybookId is missing.')
    }

    const parsedPages = parseStorybookPages(data.pages)
    const fallbackPages =
      parsedPages.length > 0 || typeof data.storyText !== 'string'
        ? parsedPages
        : parseStorybookPages(data.storyText)
    const parsedImages = parseGeneratedImages(data.images)
    const parsedNarrations = parseGeneratedNarrations(data.narrations)
    const normalizedPromptVersion = parsePromptVersion(data.promptVersion)

    return {
      storybookId: data.storybookId,
      ...(typeof data.openaiResponseId === 'string' || data.openaiResponseId === null
        ? { openaiResponseId: data.openaiResponseId }
        : {}),
      ...(fallbackPages.length > 0 ? { pages: fallbackPages } : {}),
      ...(parsedImages.length > 0 ? { images: parsedImages } : {}),
      ...(parsedNarrations.length > 0 ? { narrations: parsedNarrations } : {}),
      ...(typeof data.storyText === 'string' || data.storyText === null ? { storyText: data.storyText } : {}),
      ...(normalizedPromptVersion ? { promptVersion: normalizedPromptVersion } : {}),
    }
  }
}
