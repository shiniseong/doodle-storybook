interface R2PublicBaseEnv {
  CLOUDFLARE_R2_PUBLIC_BASE_URL?: string
  R2_PUBLIC_BASE_URL?: string
}

interface StorybookRecordForResponse {
  id: string
  title?: string | null
  author_name?: string | null
  description?: string | null
  origin_image_r2_key?: string | null
  cover_image_r2_key?: string | null
  highlight_image_r2_key?: string | null
  end_image_r2_key?: string | null
  created_at?: string | null
}

interface StorybookOriginDetailRecordForResponse {
  page_index: number
  drawing_image_r2_key?: string | null
  description?: string | null
}

interface StorybookOutputDetailRecordForResponse {
  page_index: number
  page_type: 'cover' | 'story'
  title?: string | null
  content?: string | null
  image_r2_key?: string | null
  audio_r2_key?: string | null
  is_highlight?: boolean | null
}

export interface StorybookApiSummary {
  storybookId: string
  title: string
  authorName: string | null
  description: string
  originImageUrl: string | null
  createdAt: string | null
}

export interface StorybookApiOriginDetail {
  pageIndex: number
  drawingImageUrl: string | null
  description: string
}

export interface StorybookApiOutputDetail {
  pageIndex: number
  pageType: 'cover' | 'story'
  title: string | null
  content: string | null
  imageUrl: string | null
  audioUrl: string | null
  isHighlight: boolean
}

export interface StorybookApiEbookPage {
  page: number
  content: string
  isHighlight: boolean
}

export interface StorybookApiEbookNarration {
  page: number
  audioDataUrl: string
}

export interface StorybookApiEbook {
  title: string
  authorName: string | null
  coverImageUrl: string | null
  highlightImageUrl: string | null
  finalImageUrl: string | null
  pages: StorybookApiEbookPage[]
  narrations: StorybookApiEbookNarration[]
}

export interface StorybookDetailApiResponse {
  storybookId: string
  storybook: StorybookApiSummary
  details: {
    origin: StorybookApiOriginDetail[]
    output: StorybookApiOutputDetail[]
  }
  ebook: StorybookApiEbook
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeDescription(value: unknown): string {
  const normalized = normalizeString(value)
  return normalized ?? ''
}

function normalizeTitle(value: unknown): string {
  const normalized = normalizeString(value)
  return normalized ?? 'Untitled'
}

function normalizeCreatedAt(value: unknown): string | null {
  const normalized = normalizeString(value)
  if (!normalized) {
    return null
  }

  return Number.isNaN(Date.parse(normalized)) ? null : normalized
}

function normalizePageIndex(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0) {
    return value
  }

  return null
}

function resolveR2PublicBaseUrl(env: R2PublicBaseEnv): string | null {
  const baseUrl = (env.CLOUDFLARE_R2_PUBLIC_BASE_URL || env.R2_PUBLIC_BASE_URL || '').trim()
  if (baseUrl.length === 0) {
    return null
  }

  return baseUrl.replace(/\/+$/, '')
}

export function resolveR2AssetPublicUrl(assetKeyOrUrl: string, env: R2PublicBaseEnv): string | null {
  const normalized = assetKeyOrUrl.trim()
  if (normalized.length === 0) {
    return null
  }

  if (
    normalized.startsWith('http://') ||
    normalized.startsWith('https://') ||
    normalized.startsWith('data:') ||
    normalized.startsWith('//')
  ) {
    return normalized
  }

  const baseUrl = resolveR2PublicBaseUrl(env)
  if (!baseUrl) {
    return null
  }

  return `${baseUrl}/${normalized.replace(/^\/+/, '')}`
}

function toOutputPageType(value: unknown): 'cover' | 'story' {
  return value === 'cover' ? 'cover' : 'story'
}

function normalizeOutputDetails(
  outputDetails: readonly StorybookOutputDetailRecordForResponse[],
  env: R2PublicBaseEnv,
): StorybookApiOutputDetail[] {
  return outputDetails
    .map((row) => {
      const pageIndex = normalizePageIndex(row.page_index)
      if (pageIndex === null) {
        return null
      }

      return {
        pageIndex,
        pageType: toOutputPageType(row.page_type),
        title: normalizeString(row.title),
        content: normalizeString(row.content),
        imageUrl:
          typeof row.image_r2_key === 'string' ? resolveR2AssetPublicUrl(row.image_r2_key, env) : null,
        audioUrl:
          typeof row.audio_r2_key === 'string' ? resolveR2AssetPublicUrl(row.audio_r2_key, env) : null,
        isHighlight: row.is_highlight === true,
      }
    })
    .filter((row): row is StorybookApiOutputDetail => row !== null)
    .sort((left, right) => left.pageIndex - right.pageIndex)
}

function normalizeOriginDetails(
  originDetails: readonly StorybookOriginDetailRecordForResponse[],
  env: R2PublicBaseEnv,
): StorybookApiOriginDetail[] {
  return originDetails
    .map((row) => {
      const pageIndex = normalizePageIndex(row.page_index)
      if (pageIndex === null) {
        return null
      }

      return {
        pageIndex,
        drawingImageUrl:
          typeof row.drawing_image_r2_key === 'string'
            ? resolveR2AssetPublicUrl(row.drawing_image_r2_key, env)
            : null,
        description: normalizeDescription(row.description),
      }
    })
    .filter((row): row is StorybookApiOriginDetail => row !== null)
    .sort((left, right) => left.pageIndex - right.pageIndex)
}

function buildEbook(
  storybook: StorybookRecordForResponse,
  outputDetails: readonly StorybookApiOutputDetail[],
  env: R2PublicBaseEnv,
): StorybookApiEbook {
  const storyPages = outputDetails
    .filter((row) => row.pageType === 'story')
    .filter((row) => row.content !== null && row.content.length > 0)

  const pages = storyPages.map((row) => ({
    page: row.pageIndex,
    content: row.content ?? '',
    isHighlight: row.isHighlight,
  }))

  const narrations = outputDetails
    .filter((row) => row.pageType === 'story')
    .filter((row) => row.audioUrl !== null)
    .map((row) => ({
      page: row.pageIndex,
      audioDataUrl: row.audioUrl ?? '',
    }))

  return {
    title: normalizeTitle(storybook.title),
    authorName: normalizeString(storybook.author_name),
    coverImageUrl:
      typeof storybook.cover_image_r2_key === 'string'
        ? resolveR2AssetPublicUrl(storybook.cover_image_r2_key, env)
        : null,
    highlightImageUrl:
      typeof storybook.highlight_image_r2_key === 'string'
        ? resolveR2AssetPublicUrl(storybook.highlight_image_r2_key, env)
        : null,
    finalImageUrl:
      typeof storybook.end_image_r2_key === 'string'
        ? resolveR2AssetPublicUrl(storybook.end_image_r2_key, env)
        : null,
    pages,
    narrations,
  }
}

export function buildStorybookDetailApiResponse(params: {
  storybook: StorybookRecordForResponse
  originDetails: readonly StorybookOriginDetailRecordForResponse[]
  outputDetails: readonly StorybookOutputDetailRecordForResponse[]
  env: R2PublicBaseEnv
}): StorybookDetailApiResponse | null {
  const storybookId = normalizeString(params.storybook.id)
  if (!storybookId) {
    return null
  }

  const normalizedOriginDetails = normalizeOriginDetails(params.originDetails, params.env)
  const normalizedOutputDetails = normalizeOutputDetails(params.outputDetails, params.env)

  const summary: StorybookApiSummary = {
    storybookId,
    title: normalizeTitle(params.storybook.title),
    authorName: normalizeString(params.storybook.author_name),
    description: normalizeDescription(params.storybook.description),
    originImageUrl:
      typeof params.storybook.origin_image_r2_key === 'string'
        ? resolveR2AssetPublicUrl(params.storybook.origin_image_r2_key, params.env)
        : null,
    createdAt: normalizeCreatedAt(params.storybook.created_at),
  }

  return {
    storybookId,
    storybook: summary,
    details: {
      origin: normalizedOriginDetails,
      output: normalizedOutputDetails,
    },
    ebook: buildEbook(params.storybook, normalizedOutputDetails, params.env),
  }
}
