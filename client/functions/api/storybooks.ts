type StoryLanguage = 'ko' | 'en' | 'ja' | 'zh'

interface Env {
  OPENAI_API_KEY: string
  OPENAI_PROMPT_ID?: string
  OPENAI_PROMPT_VERSION?: string
  OPENAI_IMAGE_MODEL?: string
}

interface StorybookCreateRequestBody {
  userId: string
  language: StoryLanguage
  title: string
  description: string
  imageDataUrl?: string
}

interface StoryPage {
  page: number
  content: string
  isHighlight: boolean
}

interface OpenAIResponseTextItem {
  type?: string
  text?: string
}

interface OpenAIResponseOutputItem {
  type?: string
  result?: string
  content?: OpenAIResponseTextItem[]
}

interface OpenAIResponsesApiBody {
  id?: string
  output_text?: string
  output?: OpenAIResponseOutputItem[]
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const

const DEFAULT_PROMPT_ID = 'pmpt_6997ab7bf5a8819696d08aa2f6349bda056f201a80d93697'
const DEFAULT_PROMPT_VERSION = '8'
const DEFAULT_IMAGE_MODEL = 'gpt-image-1.5'

function withCors(headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers)

  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    nextHeaders.set(key, value)
  })

  return nextHeaders
}

function jsonResponse(payload: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: withCors({
      'Content-Type': 'application/json; charset=utf-8',
    }),
  })
}

function isStoryLanguage(value: string): value is StoryLanguage {
  return value === 'ko' || value === 'en' || value === 'ja' || value === 'zh'
}

function resolvePromptLanguage(language: StoryLanguage): string {
  if (language === 'ko') {
    return 'korean'
  }

  if (language === 'ja') {
    return 'japanese'
  }

  if (language === 'zh') {
    return 'chinese'
  }

  return 'english'
}

function normalizeCreateRequestBody(payload: unknown): StorybookCreateRequestBody | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const candidate = payload as Partial<StorybookCreateRequestBody>

  if (
    typeof candidate.userId !== 'string' ||
    typeof candidate.language !== 'string' ||
    typeof candidate.title !== 'string' ||
    typeof candidate.description !== 'string'
  ) {
    return null
  }

  if (!isStoryLanguage(candidate.language)) {
    return null
  }

  const normalizedTitle = candidate.title.trim()
  const normalizedDescription = candidate.description.trim()
  const normalizedImageDataUrl =
    typeof candidate.imageDataUrl === 'string' && candidate.imageDataUrl.startsWith('data:image/')
      ? candidate.imageDataUrl
      : undefined

  if (normalizedTitle.length === 0 || normalizedDescription.length === 0) {
    return null
  }

  return {
    userId: candidate.userId,
    language: candidate.language,
    title: normalizedTitle,
    description: normalizedDescription,
    ...(normalizedImageDataUrl ? { imageDataUrl: normalizedImageDataUrl } : {}),
  }
}

function extractStorybookText(responseBody: OpenAIResponsesApiBody): string | null {
  if (typeof responseBody.output_text === 'string' && responseBody.output_text.trim().length > 0) {
    return responseBody.output_text.trim()
  }

  if (!Array.isArray(responseBody.output)) {
    return null
  }

  for (const outputItem of responseBody.output) {
    if (!Array.isArray(outputItem.content)) {
      continue
    }

    for (const contentItem of outputItem.content) {
      if (contentItem.type !== 'output_text' || typeof contentItem.text !== 'string') {
        continue
      }

      const nextText = contentItem.text.trim()
      if (nextText.length > 0) {
        return nextText
      }
    }
  }

  return null
}

function parseStoryPagesArray(candidate: unknown): StoryPage[] {
  if (!Array.isArray(candidate)) {
    return []
  }

  return candidate
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const pageCandidate = item as Partial<StoryPage>

      if (
        typeof pageCandidate.page !== 'number' ||
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
    .filter((value): value is StoryPage => value !== null)
    .sort((left, right) => left.page - right.page)
}

function extractJsonLikeText(rawText: string): string {
  const fencedBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  return (fencedBlockMatch?.[1] ?? rawText).trim()
}

function parseStoryPagesObject(candidate: unknown): StoryPage[] {
  if (!candidate || typeof candidate !== 'object') {
    return []
  }

  const pagesCandidate = (candidate as { pages?: unknown }).pages

  if (typeof pagesCandidate === 'string') {
    return extractStoryPages(pagesCandidate)
  }

  return parseStoryPagesArray(pagesCandidate)
}

function extractStoryPages(text: string | null): StoryPage[] {
  if (!text) {
    return []
  }

  const candidateRawText = extractJsonLikeText(text)

  try {
    const parsed = JSON.parse(candidateRawText) as unknown
    const directPages = parseStoryPagesArray(parsed)

    if (directPages.length > 0) {
      return directPages
    }

    const pagesInObject = parseStoryPagesObject(parsed)
    if (pagesInObject.length > 0) {
      return pagesInObject
    }
  } catch {
    // Continue to legacy [ ... ] range extraction below.
  }

  const startIndex = candidateRawText.indexOf('[')
  const endIndex = candidateRawText.lastIndexOf(']')

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return []
  }

  try {
    const parsed = JSON.parse(candidateRawText.slice(startIndex, endIndex + 1)) as unknown
    return parseStoryPagesArray(parsed)
  } catch {
    return []
  }
}

function normalizeImageResult(result: string): string {
  const compact = result.trim().replace(/\s+/g, '')
  const normalized = compact
    .replace(/^data:\s*/i, 'data:')
    .replace(/^data:image\/([a-z0-9.+-]+);bas64,/i, 'data:image/$1;base64,')

  return normalized.startsWith('data:image/') ? normalized : `data:image/png;base64,${normalized}`
}

function extractGeneratedImages(responseBody: OpenAIResponsesApiBody): string[] {
  if (!Array.isArray(responseBody.output)) {
    return []
  }

  const imageResults = responseBody.output
    .map((outputItem) => {
      if (outputItem.type !== 'image_generation_call' || typeof outputItem.result !== 'string') {
        return null
      }

      return outputItem.result
    })
    .filter((result): result is string => result !== null)

  return imageResults.map((result) => normalizeImageResult(result))
}

function resolveUpstreamErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return 'OpenAI API request failed.'
  }

  const errorCandidate = (payload as { error?: { message?: string } }).error
  if (errorCandidate && typeof errorCandidate.message === 'string' && errorCandidate.message.length > 0) {
    return errorCandidate.message
  }

  return 'OpenAI API request failed.'
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    try {
      const text = await response.text()
      return { raw: text }
    } catch {
      return null
    }
  }
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: withCors(),
  })
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  if (!context.env.OPENAI_API_KEY) {
    return jsonResponse(
      {
        error: 'OPENAI_API_KEY is not configured.',
      },
      500,
    )
  }

  let requestBody: unknown

  try {
    requestBody = await context.request.json()
  } catch {
    return jsonResponse(
      {
        error: 'Invalid JSON body.',
      },
      400,
    )
  }

  const normalizedBody = normalizeCreateRequestBody(requestBody)

  if (!normalizedBody) {
    return jsonResponse(
      {
        error: 'Invalid request body.',
      },
      400,
    )
  }

  const inputContent: Array<{ type: 'input_text'; text: string } | { type: 'input_image'; image_url: string }> = [
    {
      type: 'input_text',
      text: '원본 그림과 제목, 설명을 바탕으로 동화 본문 10페이지(JSON)와 삽화를 생성해 주세요.',
    },
  ]

  if (normalizedBody.imageDataUrl) {
    inputContent.unshift({
      type: 'input_image',
      image_url: normalizedBody.imageDataUrl,
    })
  }

  const promptVersion = context.env.OPENAI_PROMPT_VERSION || DEFAULT_PROMPT_VERSION

  let upstreamResponse: Response

  try {
    upstreamResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${context.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        prompt: {
          id: context.env.OPENAI_PROMPT_ID || DEFAULT_PROMPT_ID,
          version: promptVersion,
          variables: {
            language: resolvePromptLanguage(normalizedBody.language),
            title: normalizedBody.title,
            description: normalizedBody.description,
          },
        },
        input: [
          {
            role: 'user',
            content: inputContent,
          },
        ],
        tools: [
          {
            type: 'image_generation',
            model: context.env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
            size: '1024x1024',
            output_format: 'png',
            quality: 'low',
            background: 'auto',
          },
        ],
        max_tool_calls: 3,
        store: true,
      }),
    })
  } catch {
    return jsonResponse(
      {
        error: 'Failed to reach OpenAI API.',
      },
      502,
    )
  }

  const upstreamPayload = await readResponseBody(upstreamResponse)

  if (!upstreamResponse.ok) {
    return jsonResponse(
      {
        error: resolveUpstreamErrorMessage(upstreamPayload),
      },
      502,
    )
  }

  const openAIResponseBody = upstreamPayload as OpenAIResponsesApiBody
  const storyText = extractStorybookText(openAIResponseBody)
  const storyPages = extractStoryPages(storyText)
  const images = extractGeneratedImages(openAIResponseBody).slice(0, 3)

  return jsonResponse({
    storybookId: `storybook-${crypto.randomUUID()}`,
    openaiResponseId: openAIResponseBody.id ?? null,
    promptVersion,
    pages: storyPages,
    images,
    storyText,
  })
}
