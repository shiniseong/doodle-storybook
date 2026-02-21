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
  commonStyleGuide?: string
  commonWorld?: string
}

interface StoryCharacter {
  id: string
  name: string
  prompt: string
}

interface ParsedPromptStorybookOutput {
  pages: StoryPage[]
  ttsPages: StoryPageTtsSource[]
  imagePrompts: StoryImagePrompts
  characters: StoryCharacter[]
}

interface PromptOutputFallbackContext {
  title?: string
  description?: string
  language?: StoryLanguage
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
  prompt?: {
    id?: string
    version?: string | number
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const

const DEFAULT_PROMPT_ID = 'pmpt_6997ab7bf5a8819696d08aa2f6349bda056f201a80d93697'
const DEFAULT_PROMPT_VERSION = '13'
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

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value > 0) {
    return value
  }

  if (typeof value === 'string') {
    const compact = value.trim()
    if (compact.length === 0) {
      return null
    }

    const parsed = Number(compact)
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed > 0) {
      return parsed
    }
  }

  return null
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

      const parsedPage = parsePositiveInteger(pageCandidate.page)

      if (
        parsedPage === null ||
        typeof pageCandidate.content !== 'string'
      ) {
        return null
      }

      const normalizedContent = pageCandidate.content.trim()
      if (normalizedContent.length === 0) {
        return null
      }

      return {
        page: parsedPage,
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

function resolveImagePromptText(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (!value || typeof value !== 'object') {
    return null
  }

  const candidate = value as { prompt?: unknown; text?: unknown }
  if (typeof candidate.prompt === 'string' && candidate.prompt.trim().length > 0) {
    return candidate.prompt.trim()
  }

  if (typeof candidate.text === 'string' && candidate.text.trim().length > 0) {
    return candidate.text.trim()
  }

  return null
}

function parsePromptImagePrompts(candidate: unknown): StoryImagePrompts | null {
  if (!candidate || typeof candidate !== 'object') {
    return null
  }

  const imagePrompts = candidate as {
    cover?: unknown
    highlight?: unknown
    end?: unknown
    common?: unknown
  }

  const cover = resolveImagePromptText(imagePrompts.cover)
  const highlight = resolveImagePromptText(imagePrompts.highlight)
  const end = resolveImagePromptText(imagePrompts.end)

  if (!cover || !highlight || !end) {
    return null
  }

  const parsed: StoryImagePrompts = {
    cover,
    highlight,
    end,
  }

  if (imagePrompts.common && typeof imagePrompts.common === 'object') {
    const commonCandidate = imagePrompts.common as {
      styleGuide?: unknown
      world?: unknown
    }

    if (typeof commonCandidate.styleGuide === 'string' && commonCandidate.styleGuide.trim().length > 0) {
      parsed.commonStyleGuide = commonCandidate.styleGuide.trim()
    }

    if (typeof commonCandidate.world === 'string' && commonCandidate.world.trim().length > 0) {
      parsed.commonWorld = commonCandidate.world.trim()
    }
  }

  return parsed
}

function parsePromptCharacters(candidate: unknown): StoryCharacter[] {
  if (!Array.isArray(candidate)) {
    return []
  }

  const parsedCharacters: StoryCharacter[] = []
  const usedIds = new Set<string>()

  candidate.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const character = item as {
      id?: unknown
      name?: unknown
      prompt?: unknown
    }

    if (typeof character.name !== 'string' || typeof character.prompt !== 'string') {
      return
    }

    const rawId = typeof character.id === 'string' ? character.id.trim() : ''
    const name = character.name.trim()
    const prompt = character.prompt.trim()
    if (name.length === 0 || prompt.length === 0) {
      return
    }

    const id = rawId.length > 0 ? rawId : `c${index + 1}`
    if (usedIds.has(id)) {
      return
    }

    usedIds.add(id)
    parsedCharacters.push({
      id,
      name,
      prompt,
    })
  })

  return parsedCharacters
}

function resolveCharactersCandidate(
  candidate: {
    characters?: unknown
    charaters?: unknown
  } | null,
): unknown {
  return candidate?.characters ?? candidate?.charaters
}

function hasExpectedPageSequence(pages: Array<{ page: number }>): boolean {
  return pages.every((page, index) => page.page === index + 1)
}

function parseStructuredPromptStorybookOutput(parsed: unknown): ParsedPromptStorybookOutput | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null
  }

  const candidate = parsed as {
    highlightPage?: unknown
    pages?: unknown
    imagePrompts?: unknown
    characters?: unknown
    charaters?: unknown
  }

  const highlightPage = parsePositiveInteger(candidate.highlightPage)
  if (highlightPage === null || highlightPage > MAX_NARRATION_COUNT) {
    return null
  }

  const pagesWithContent = parsePromptStoryPagesForContent(candidate.pages)
  if (pagesWithContent.length !== MAX_NARRATION_COUNT) {
    return null
  }

  if (!hasExpectedPageSequence(pagesWithContent)) {
    return null
  }

  const parsedImagePrompts = parsePromptImagePrompts(candidate.imagePrompts)
  if (!parsedImagePrompts) {
    return null
  }

  const parsedCharacters = parsePromptCharacters(resolveCharactersCandidate(candidate))

  const normalizedTtsFromContent = pagesWithContent.map((page) => ({
    page: page.page,
    tts: normalizeNarrationText(page.content),
  }))

  return {
    pages: pagesWithContent.map((page) => ({
      page: page.page,
      content: page.content,
      isHighlight: page.page === highlightPage,
    })),
    ttsPages: normalizedTtsFromContent,
    imagePrompts: parsedImagePrompts,
    characters: parsedCharacters,
  }
}

interface LegacyStoryPage {
  page: number
  content: string
  isHighlight: boolean
}

function parseLegacyStoryPages(candidate: unknown): LegacyStoryPage[] {
  if (!Array.isArray(candidate)) {
    return []
  }

  const pages = candidate
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const pageCandidate = item as {
        page?: unknown
        content?: unknown
        tts?: unknown
        isHighlight?: unknown
      }

      const page = parsePositiveInteger(pageCandidate.page)
      if (page === null || typeof pageCandidate.content !== 'string') {
        return null
      }

      const content = pageCandidate.content.trim()
      if (content.length === 0) {
        return null
      }

      return {
        page,
        content,
        isHighlight: pageCandidate.isHighlight === true || pageCandidate.isHighlight === 'true',
      }
    })
    .filter((value): value is LegacyStoryPage => value !== null)
    .sort((left, right) => left.page - right.page)

  const hasDuplicatePage = pages.some((page, index) => index > 0 && pages[index - 1]?.page === page.page)
  if (hasDuplicatePage) {
    return []
  }

  return pages
}

function buildFallbackImagePrompts(
  pages: LegacyStoryPage[],
  highlightPage: number,
  fallbackContext?: PromptOutputFallbackContext,
): StoryImagePrompts {
  const title = fallbackContext?.title?.trim() || 'A warm bedtime adventure'
  const description = fallbackContext?.description?.trim() || pages[0]?.content || title
  const highlightScene = pages.find((page) => page.page === highlightPage)?.content || pages[5]?.content || description
  const endingScene = pages[pages.length - 1]?.content || description
  const language = fallbackContext?.language ? resolvePromptLanguage(fallbackContext.language) : 'korean'

  const styleGuide =
    'storybook illustration, clean outlines, gentle colors, soft light, cute well-formed faces, simple poses, consistent character design, no text, no letters, no logos, no watermark'

  return {
    cover: `Language: ${language}. Children's picture-book cover for "${title}". Scene: ${description}. ${styleGuide}.`,
    highlight: `Language: ${language}. Picture-book highlight scene for page ${highlightPage}. Scene: ${highlightScene}. ${styleGuide}.`,
    end: `Language: ${language}. Picture-book final scene with warm closure. Scene: ${endingScene}. ${styleGuide}.`,
  }
}

function parseLegacyPromptStorybookOutput(
  parsed: unknown,
  fallbackContext?: PromptOutputFallbackContext,
): ParsedPromptStorybookOutput | null {
  const rootObject = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  const legacyPagesCandidate = Array.isArray(parsed)
    ? parsed
    : (rootObject as { pages?: unknown } | null)?.pages

  const legacyPages = parseLegacyStoryPages(legacyPagesCandidate)
  if (legacyPages.length !== MAX_NARRATION_COUNT || !hasExpectedPageSequence(legacyPages)) {
    return null
  }

  const highlightPage = legacyPages.find((page) => page.isHighlight)?.page ?? 6
  const imagePrompts =
    parsePromptImagePrompts((rootObject as { imagePrompts?: unknown } | null)?.imagePrompts) ??
    buildFallbackImagePrompts(legacyPages, highlightPage, fallbackContext)
  const characters = parsePromptCharacters(
    resolveCharactersCandidate(rootObject as { characters?: unknown; charaters?: unknown } | null),
  )

  return {
    pages: legacyPages.map((page) => ({
      page: page.page,
      content: page.content,
      isHighlight: page.page === highlightPage,
    })),
    ttsPages: legacyPages.map((page) => ({
      page: page.page,
      tts: normalizeNarrationText(page.content),
    })),
    imagePrompts,
    characters,
  }
}

export function parsePromptStorybookOutput(
  rawText: string | null,
  fallbackContext?: PromptOutputFallbackContext,
): ParsedPromptStorybookOutput | null {
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

  return parseStructuredPromptStorybookOutput(parsed) ?? parseLegacyPromptStorybookOutput(parsed, fallbackContext)
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

function buildSingleImagePrompt(
  sceneRole: 'cover' | 'highlight' | 'end',
  scenePrompt: string,
  imagePrompts: StoryImagePrompts,
  characters: StoryCharacter[],
  storyTitle: string,
  storyDescription: string,
): string {
  const commonStyleGuide =
    imagePrompts.commonStyleGuide && imagePrompts.commonStyleGuide.trim().length > 0
      ? imagePrompts.commonStyleGuide.trim()
      : null
  const commonWorld =
    imagePrompts.commonWorld && imagePrompts.commonWorld.trim().length > 0
      ? imagePrompts.commonWorld.trim()
      : null

  const characterLines =
    characters.length > 0
      ? [
          'Character consistency reference (apply exactly across all three image requests):',
          ...characters.map((character) => `- [${character.id}] ${character.name}: ${character.prompt}`),
          `Main protagonist: ${characters[0]?.name ?? ''}. Keep this protagonist as the clear visual focus.`,
        ]
      : []

  return [
    'Create exactly one children\'s storybook illustration for a single scene.',
    'Output one full-frame image only. Do not create a collage, split-panel, triptych, or multi-scene composition.',
    'Keep protagonist identity, color palette, line quality, and painting style consistent with the rest of the book images.',
    'Service context: This service creates high-quality children\'s storybooks from a child\'s drawing, the user\'s story title, and the user\'s story description.',
    `User-provided story title: ${storyTitle}`,
    `User-provided story description: ${storyDescription}`,
    'No text, letters, logos, or watermarks.',
    ...characterLines,
    ...(commonStyleGuide ? [`Shared style guide: ${commonStyleGuide}`] : []),
    ...(commonWorld ? [`Shared world setting: ${commonWorld}`] : []),
    `Scene role: ${sceneRole}.`,
    `Scene description: ${scenePrompt}`,
  ].join('\n')
}

async function resolveGeneratedImageDataUrl(item: unknown): Promise<string | null> {
  if (!item || typeof item !== 'object') {
    return null
  }

  const candidate = item as {
    b64_json?: unknown
    url?: unknown
  }

  if (typeof candidate.b64_json === 'string' && candidate.b64_json.trim().length > 0) {
    return normalizeImageResult(candidate.b64_json)
  }

  if (typeof candidate.url === 'string' && candidate.url.trim().length > 0) {
    return resolveImageDataUrlFromGeneratedImageUrl(candidate.url)
  }

  return null
}

async function generateImageFromPrompt(
  sceneRole: 'cover' | 'highlight' | 'end',
  scenePrompt: string,
  imagePrompts: StoryImagePrompts,
  characters: StoryCharacter[],
  storyTitle: string,
  storyDescription: string,
  env: Env,
): Promise<string | null> {
  if (scenePrompt.trim().length === 0) {
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
        prompt: buildSingleImagePrompt(
          sceneRole,
          scenePrompt,
          imagePrompts,
          characters,
          storyTitle,
          storyDescription,
        ),
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
  if (!first) {
    return null
  }

  return resolveGeneratedImageDataUrl(first)
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

function normalizePromptVersion(value: unknown): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return null
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
  const upstreamPromptVersion = normalizePromptVersion(openAIResponseBody.prompt?.version)
  const parsedPromptStorybook = parsePromptStorybookOutput(storyText, {
    title: normalizedBody.title,
    description: normalizedBody.description,
    language: normalizedBody.language,
  })

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
    generateImageFromPrompt(
      'cover',
      parsedPromptStorybook.imagePrompts.cover,
      parsedPromptStorybook.imagePrompts,
      parsedPromptStorybook.characters,
      normalizedBody.title,
      normalizedBody.description,
      context.env,
    ),
    generateImageFromPrompt(
      'highlight',
      parsedPromptStorybook.imagePrompts.highlight,
      parsedPromptStorybook.imagePrompts,
      parsedPromptStorybook.characters,
      normalizedBody.title,
      normalizedBody.description,
      context.env,
    ),
    generateImageFromPrompt(
      'end',
      parsedPromptStorybook.imagePrompts.end,
      parsedPromptStorybook.imagePrompts,
      parsedPromptStorybook.characters,
      normalizedBody.title,
      normalizedBody.description,
      context.env,
    ),
    ...narrationSources.map((source) => generatePageNarration(source, ttsInstructions, context.env)),
  ])

  const narrations = narrationResults
    .filter((narration): narration is StoryPageNarration => narration !== null)
    .sort((left, right) => left.page - right.page)

  return jsonResponse({
    storybookId: `storybook-${crypto.randomUUID()}`,
    openaiResponseId: openAIResponseBody.id ?? null,
    promptVersion,
    upstreamPromptVersion,
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
