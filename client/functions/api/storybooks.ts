type StoryLanguage = 'ko' | 'en' | 'ja' | 'zh'

interface Env {
  OPENAI_API_KEY: string
  OPENAI_PROMPT_ID?: string
  OPENAI_PROMPT_VERSION?: string
  OPENAI_IMAGE_MODEL?: string
  OPENAI_TTS_MODEL?: string
  OPENAI_TTS_VOICE?: string
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

interface StoryPageNarration {
  page: number
  audioDataUrl: string
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
const DEFAULT_TTS_MODEL = 'gpt-4o-mini-tts'
const DEFAULT_TTS_VOICE = 'alloy'
const MAX_NARRATION_COUNT = 10

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

function normalizeNarrationText(content: string): string {
  return content.replace(/\s+/g, ' ').trim()
}

function resolveTtsInstructions(language: StoryLanguage): string {
  if (language === 'ko') {
    return (
      '전체를 같은 목소리와 톤으로 유지하며 따뜻한 구연 동화 화자처럼 읽어 주세요. ' +
      '모든 페이지에서 발성, 속도, 감정선의 일관성을 유지해 주세요. ' +
      '문장 안에 쌍따옴표("...") 또는 스마트 쌍따옴표(“...”)로 감싼 대사는, 같은 화자 톤을 유지하되 ' +
      '조금 더 연기하듯 생동감 있게 읽어 주세요.'
    )
  }

  if (language === 'ja') {
    return (
      '同じ声質とトーンを維持し、あたたかい読み聞かせの語り口で読んでください。' +
      '全ページで話速と感情の一貫性を保ってください。' +
      'ダブルクォーテーション("...")またはスマートクォート(“...”)で囲まれたセリフは、' +
      '同じ語り手の声を保ちながら、やや演技的で表情豊かに読んでください。'
    )
  }

  if (language === 'zh') {
    return (
      '请全程保持同一声音与语气，用温暖的童话讲述风格朗读。' +
      '在所有页面中保持语速和情感走向一致。' +
      '对于使用双引号("...")或智能引号(“...”)括起来的台词，' +
      '请在保持同一讲述者声音的前提下，用更有表演感的语气朗读。'
    )
  }

  return (
    'Read in a warm fairy-tale storyteller style with a consistent single voice and tone across all pages. ' +
    'Keep pacing and emotional color consistent throughout. ' +
    'For dialogue enclosed in double quotes ("...") or smart quotes (“...”), ' +
    'keep the same narrator voice but deliver those lines with more expressive acting.'
  )
}

function encodeBytesAsBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x7fff

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize)
    binary += String.fromCharCode(...chunk)
  }

  return btoa(binary)
}

async function generatePageNarration(
  page: StoryPage,
  instructions: string,
  env: Env,
): Promise<StoryPageNarration | null> {
  const input = normalizeNarrationText(page.content)
  if (input.length === 0) {
    return null
  }

  let response: Response

  try {
    response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_TTS_MODEL || DEFAULT_TTS_MODEL,
        voice: env.OPENAI_TTS_VOICE || DEFAULT_TTS_VOICE,
        input,
        instructions,
        format: 'mp3',
      }),
    })
  } catch {
    return null
  }

  if (!response.ok) {
    return null
  }

  let audioBytes: Uint8Array

  try {
    const audioBuffer = await response.arrayBuffer()
    audioBytes = new Uint8Array(audioBuffer)
  } catch {
    return null
  }

  if (audioBytes.byteLength === 0) {
    return null
  }

  return {
    page: page.page,
    audioDataUrl: `data:audio/mpeg;base64,${encodeBytesAsBase64(audioBytes)}`,
  }
}

async function generateStoryNarrations(
  pages: readonly StoryPage[],
  language: StoryLanguage,
  env: Env,
): Promise<StoryPageNarration[]> {
  const textPages = pages
    .filter((page) => normalizeNarrationText(page.content).length > 0)
    .slice(0, MAX_NARRATION_COUNT)

  if (textPages.length === 0) {
    return []
  }

  const instructions = resolveTtsInstructions(language)
  const narrationRequests = textPages.map((page) => generatePageNarration(page, instructions, env))
  const narrations = await Promise.all(narrationRequests)

  return narrations
    .filter((narration): narration is StoryPageNarration => narration !== null)
    .sort((left, right) => left.page - right.page)
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
  const narrations = await generateStoryNarrations(storyPages, normalizedBody.language, context.env)

  return jsonResponse({
    storybookId: `storybook-${crypto.randomUUID()}`,
    openaiResponseId: openAIResponseBody.id ?? null,
    promptVersion,
    pages: storyPages,
    images,
    narrations,
    storyText,
  })
}
