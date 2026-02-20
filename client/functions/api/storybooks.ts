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

interface StoryPageTtsSource {
  page: number
  tts: string
}

interface StoryPageNarration {
  page: number
  audioDataUrl: string
}

interface StoryImagePrompts {
  cover: string
  highlight: string
  end: string
}

interface ParsedPromptStorybookOutput {
  pages: StoryPage[]
  ttsPages: StoryPageTtsSource[]
  imagePrompts: StoryImagePrompts
}

interface OpenAIResponseTextItem {
  type?: string
  text?: string
}

interface OpenAIResponseOutputItem {
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
const DEFAULT_PROMPT_VERSION = '9'
const DEFAULT_IMAGE_MODEL = 'gpt-image-1.5'
const DEFAULT_TTS_MODEL = 'gpt-4o-mini-tts'
const DEFAULT_TTS_VOICE = 'alloy'
const MAX_NARRATION_COUNT = 10
const TRANSPARENT_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBAp9nqwAAAABJRU5ErkJggg=='

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

function extractJsonLikeText(rawText: string): string {
  const fencedBlockMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  return (fencedBlockMatch?.[1] ?? rawText).trim()
}

function normalizeNarrationText(content: string): string {
  return content.replace(/\s+/g, ' ').trim()
}

function parsePromptStoryPagesArray(candidate: unknown): StoryPageTtsSource[] {
  if (!Array.isArray(candidate)) {
    return []
  }

  const parsedPages = candidate
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const pageCandidate = item as {
        page?: unknown
        content?: unknown
        tts?: unknown
      }

      if (
        typeof pageCandidate.page !== 'number' ||
        !Number.isFinite(pageCandidate.page) ||
        typeof pageCandidate.content !== 'string' ||
        typeof pageCandidate.tts !== 'string'
      ) {
        return null
      }

      const normalizedContent = pageCandidate.content.trim()
      const normalizedTts = normalizeNarrationText(pageCandidate.tts)

      if (normalizedContent.length === 0 || normalizedTts.length === 0) {
        return null
      }

      return {
        page: pageCandidate.page,
        tts: normalizedTts,
      }
    })
    .filter((value): value is StoryPageTtsSource => value !== null)
    .sort((left, right) => left.page - right.page)

  const hasDuplicatePage = parsedPages.some((page, index) => index > 0 && parsedPages[index - 1]?.page === page.page)
  if (hasDuplicatePage) {
    return []
  }

  return parsedPages
}

function parsePromptStoryPagesForContent(candidate: unknown): Array<{ page: number; content: string }> {
  if (!Array.isArray(candidate)) {
    return []
  }

  const parsedPages = candidate
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const pageCandidate = item as {
        page?: unknown
        content?: unknown
      }

      if (
        typeof pageCandidate.page !== 'number' ||
        !Number.isFinite(pageCandidate.page) ||
        typeof pageCandidate.content !== 'string'
      ) {
        return null
      }

      const normalizedContent = pageCandidate.content.trim()
      if (normalizedContent.length === 0) {
        return null
      }

      return {
        page: pageCandidate.page,
        content: normalizedContent,
      }
    })
    .filter((value): value is { page: number; content: string } => value !== null)
    .sort((left, right) => left.page - right.page)

  const hasDuplicatePage = parsedPages.some((page, index) => index > 0 && parsedPages[index - 1]?.page === page.page)
  if (hasDuplicatePage) {
    return []
  }

  return parsedPages
}

function parsePromptImagePrompts(candidate: unknown): StoryImagePrompts | null {
  if (!candidate || typeof candidate !== 'object') {
    return null
  }

  const imagePrompts = candidate as {
    cover?: unknown
    highlight?: unknown
    end?: unknown
  }

  if (
    typeof imagePrompts.cover !== 'string' ||
    typeof imagePrompts.highlight !== 'string' ||
    typeof imagePrompts.end !== 'string'
  ) {
    return null
  }

  const cover = imagePrompts.cover.trim()
  const highlight = imagePrompts.highlight.trim()
  const end = imagePrompts.end.trim()

  if (cover.length === 0 || highlight.length === 0 || end.length === 0) {
    return null
  }

  return {
    cover,
    highlight,
    end,
  }
}

export function parsePromptStorybookOutput(rawText: string | null): ParsedPromptStorybookOutput | null {
  if (!rawText || rawText.trim().length === 0) {
    return null
  }

  const jsonLikeText = extractJsonLikeText(rawText)

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonLikeText) as unknown
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') {
    return null
  }

  const candidate = parsed as {
    highlightPage?: unknown
    pages?: unknown
    imagePrompts?: unknown
  }

  if (typeof candidate.highlightPage !== 'number' || !Number.isFinite(candidate.highlightPage)) {
    return null
  }

  const pagesWithContent = parsePromptStoryPagesForContent(candidate.pages)
  const pagesWithTts = parsePromptStoryPagesArray(candidate.pages)

  if (pagesWithContent.length !== MAX_NARRATION_COUNT || pagesWithTts.length !== MAX_NARRATION_COUNT) {
    return null
  }

  const hasExpectedSequence =
    pagesWithContent.every((page, index) => page.page === index + 1) &&
    pagesWithTts.every((page, index) => page.page === index + 1)

  if (!hasExpectedSequence) {
    return null
  }

  if (candidate.highlightPage < 1 || candidate.highlightPage > MAX_NARRATION_COUNT) {
    return null
  }

  const parsedImagePrompts = parsePromptImagePrompts(candidate.imagePrompts)
  if (!parsedImagePrompts) {
    return null
  }

  const pages: StoryPage[] = pagesWithContent.map((page) => ({
    page: page.page,
    content: page.content,
    isHighlight: page.page === candidate.highlightPage,
  }))

  return {
    pages,
    ttsPages: pagesWithTts,
    imagePrompts: parsedImagePrompts,
  }
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
  source: StoryPageTtsSource,
  instructions: string,
  env: Env,
): Promise<StoryPageNarration | null> {
  const input = normalizeNarrationText(source.tts)
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
    page: source.page,
    audioDataUrl: `data:audio/mpeg;base64,${encodeBytesAsBase64(audioBytes)}`,
  }
}

function normalizeImageResult(result: string): string {
  const compact = result.trim().replace(/\s+/g, '')
  const normalized = compact
    .replace(/^data:\s*/i, 'data:')
    .replace(/^data:image\/([a-z0-9.+-]+);bas64,/i, 'data:image/$1;base64,')

  return normalized.startsWith('data:image/') ? normalized : `data:image/png;base64,${normalized}`
}

async function resolveImageDataUrlFromGeneratedImageUrl(imageUrl: string): Promise<string | null> {
  let imageResponse: Response

  try {
    imageResponse = await fetch(imageUrl)
  } catch {
    return null
  }

  if (!imageResponse.ok) {
    return null
  }

  let bytes: Uint8Array
  try {
    const imageBuffer = await imageResponse.arrayBuffer()
    bytes = new Uint8Array(imageBuffer)
  } catch {
    return null
  }

  if (bytes.byteLength === 0) {
    return null
  }

  return `data:image/png;base64,${encodeBytesAsBase64(bytes)}`
}

async function generateImageFromPrompt(prompt: string, env: Env): Promise<string | null> {
  if (prompt.trim().length === 0) {
    return null
  }

  let response: Response

  try {
    response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.OPENAI_IMAGE_MODEL || DEFAULT_IMAGE_MODEL,
        prompt,
        size: '1024x1024',
        quality: 'low',
        output_format: 'png',
        background: 'auto',
      }),
    })
  } catch {
    return null
  }

  const payload = await readResponseBody(response)

  if (!response.ok || !payload || typeof payload !== 'object') {
    return null
  }

  const data = (payload as { data?: Array<{ b64_json?: unknown; url?: unknown }> }).data
  if (!Array.isArray(data) || data.length === 0) {
    return null
  }

  const first = data[0]
  if (!first || typeof first !== 'object') {
    return null
  }

  if (typeof first.b64_json === 'string' && first.b64_json.trim().length > 0) {
    return normalizeImageResult(first.b64_json)
  }

  if (typeof first.url === 'string' && first.url.trim().length > 0) {
    return resolveImageDataUrlFromGeneratedImageUrl(first.url)
  }

  return null
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
      text: '입력된 정보와 참고 이미지를 바탕으로 동화 JSON을 생성해 주세요.',
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
  const parsedPromptStorybook = parsePromptStorybookOutput(storyText)

  if (!parsedPromptStorybook) {
    return jsonResponse(
      {
        error: 'Invalid storybook prompt output schema.',
      },
      502,
    )
  }

  const ttsInstructions = resolveTtsInstructions(normalizedBody.language)
  const narrationSources = parsedPromptStorybook.ttsPages.slice(0, MAX_NARRATION_COUNT)

  const [coverImage, highlightImage, endImage, ...narrationResults] = await Promise.all([
    generateImageFromPrompt(parsedPromptStorybook.imagePrompts.cover, context.env),
    generateImageFromPrompt(parsedPromptStorybook.imagePrompts.highlight, context.env),
    generateImageFromPrompt(parsedPromptStorybook.imagePrompts.end, context.env),
    ...narrationSources.map((source) => generatePageNarration(source, ttsInstructions, context.env)),
  ])

  const narrations = narrationResults
    .filter((narration): narration is StoryPageNarration => narration !== null)
    .sort((left, right) => left.page - right.page)

  return jsonResponse({
    storybookId: `storybook-${crypto.randomUUID()}`,
    openaiResponseId: openAIResponseBody.id ?? null,
    promptVersion,
    pages: parsedPromptStorybook.pages,
    images: [
      coverImage ?? TRANSPARENT_PNG_DATA_URL,
      highlightImage ?? TRANSPARENT_PNG_DATA_URL,
      endImage ?? TRANSPARENT_PNG_DATA_URL,
    ],
    narrations,
    storyText,
  })
}
