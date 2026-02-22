import type {
  StorybookDetailResponse,
  StorybookDetailSummary,
  StorybookEbook,
  StorybookEbookNarration,
  StorybookEbookPage,
  StorybookOriginDetail,
  StorybookOutputDetail,
} from '@entities/storybook/model/storybook-detail'

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function normalizeRequiredString(value: unknown): string | null {
  return normalizeString(value)
}

function normalizeNullableString(value: unknown): string | null {
  return normalizeString(value)
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    return null
  }

  return value
}

function normalizePositiveInteger(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return null
  }

  return value
}

function parseSummary(raw: unknown): StorybookDetailSummary | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as {
    storybookId?: unknown
    title?: unknown
    authorName?: unknown
    description?: unknown
    originImageUrl?: unknown
    createdAt?: unknown
  }

  const storybookId = normalizeRequiredString(candidate.storybookId)
  const title = normalizeRequiredString(candidate.title)
  const description = normalizeRequiredString(candidate.description)
  if (!storybookId || !title || !description) {
    return null
  }

  return {
    storybookId,
    title,
    authorName: normalizeNullableString(candidate.authorName),
    description,
    originImageUrl: normalizeNullableString(candidate.originImageUrl),
    createdAt: normalizeNullableString(candidate.createdAt),
  }
}

function parseOriginDetails(raw: unknown): StorybookOriginDetail[] | null {
  if (!Array.isArray(raw)) {
    return null
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as {
        pageIndex?: unknown
        drawingImageUrl?: unknown
        description?: unknown
      }

      const pageIndex = normalizeNonNegativeInteger(candidate.pageIndex)
      if (pageIndex === null) {
        return null
      }

      const description = normalizeRequiredString(candidate.description)
      if (!description) {
        return null
      }

      return {
        pageIndex,
        drawingImageUrl: normalizeNullableString(candidate.drawingImageUrl),
        description,
      }
    })
    .filter((item): item is StorybookOriginDetail => item !== null)
    .sort((left, right) => left.pageIndex - right.pageIndex)
}

function parseOutputDetails(raw: unknown): StorybookOutputDetail[] | null {
  if (!Array.isArray(raw)) {
    return null
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as {
        pageIndex?: unknown
        pageType?: unknown
        title?: unknown
        content?: unknown
        imageUrl?: unknown
        audioUrl?: unknown
        isHighlight?: unknown
      }

      const pageIndex = normalizeNonNegativeInteger(candidate.pageIndex)
      if (pageIndex === null) {
        return null
      }

      const pageType = candidate.pageType === 'cover' ? 'cover' : candidate.pageType === 'story' ? 'story' : null
      if (!pageType) {
        return null
      }

      return {
        pageIndex,
        pageType,
        title: normalizeNullableString(candidate.title),
        content: normalizeNullableString(candidate.content),
        imageUrl: normalizeNullableString(candidate.imageUrl),
        audioUrl: normalizeNullableString(candidate.audioUrl),
        isHighlight: candidate.isHighlight === true,
      }
    })
    .filter((item): item is StorybookOutputDetail => item !== null)
    .sort((left, right) => left.pageIndex - right.pageIndex)
}

function parseEbookPages(raw: unknown): StorybookEbookPage[] | null {
  if (!Array.isArray(raw)) {
    return null
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as {
        page?: unknown
        content?: unknown
        isHighlight?: unknown
      }

      const page = normalizePositiveInteger(candidate.page)
      const content = normalizeRequiredString(candidate.content)
      if (page === null || !content) {
        return null
      }

      return {
        page,
        content,
        isHighlight: candidate.isHighlight === true,
      }
    })
    .filter((item): item is StorybookEbookPage => item !== null)
    .sort((left, right) => left.page - right.page)
}

function parseEbookNarrations(raw: unknown): StorybookEbookNarration[] | null {
  if (!Array.isArray(raw)) {
    return null
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const candidate = item as {
        page?: unknown
        audioDataUrl?: unknown
      }

      const page = normalizePositiveInteger(candidate.page)
      const audioDataUrl = normalizeRequiredString(candidate.audioDataUrl)
      if (page === null || !audioDataUrl) {
        return null
      }

      return {
        page,
        audioDataUrl,
      }
    })
    .filter((item): item is StorybookEbookNarration => item !== null)
    .sort((left, right) => left.page - right.page)
}

function parseEbook(raw: unknown): StorybookEbook | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as {
    title?: unknown
    authorName?: unknown
    coverImageUrl?: unknown
    highlightImageUrl?: unknown
    finalImageUrl?: unknown
    pages?: unknown
    narrations?: unknown
  }

  const title = normalizeRequiredString(candidate.title)
  if (!title) {
    return null
  }

  const pages = parseEbookPages(candidate.pages)
  const narrations = parseEbookNarrations(candidate.narrations)
  if (!pages || !narrations) {
    return null
  }

  return {
    title,
    authorName: normalizeNullableString(candidate.authorName),
    coverImageUrl: normalizeNullableString(candidate.coverImageUrl),
    highlightImageUrl: normalizeNullableString(candidate.highlightImageUrl),
    finalImageUrl: normalizeNullableString(candidate.finalImageUrl),
    pages,
    narrations,
  }
}

export function parseStorybookDetailResponse(payload: unknown): StorybookDetailResponse | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as {
    storybookId?: unknown
    storybook?: unknown
    details?: unknown
    ebook?: unknown
  }

  const storybookId = normalizeRequiredString(candidate.storybookId)
  const storybook = parseSummary(candidate.storybook)
  const ebook = parseEbook(candidate.ebook)

  if (!storybookId || !storybook || !ebook) {
    return null
  }

  if (storybook.storybookId !== storybookId) {
    return null
  }

  if (!candidate.details || typeof candidate.details !== 'object') {
    return null
  }

  const detailCandidate = candidate.details as {
    origin?: unknown
    output?: unknown
  }

  const originDetails = parseOriginDetails(detailCandidate.origin)
  const outputDetails = parseOutputDetails(detailCandidate.output)
  if (!originDetails || !outputDetails) {
    return null
  }

  return {
    storybookId,
    storybook,
    details: {
      origin: originDetails,
      output: outputDetails,
    },
    ebook,
  }
}
