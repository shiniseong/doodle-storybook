import { describe, expect, it } from 'vitest'

import { onRequestPost } from './storybooks'

const shouldRunLiveCheck = import.meta.env.VITE_OPENAI_LIVE_CHECK === '1'
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY
const openaiPromptId = import.meta.env.VITE_OPENAI_PROMPT_ID
const openaiPromptVersion = import.meta.env.VITE_OPENAI_PROMPT_VERSION ?? '19'
const openaiImageModel = import.meta.env.VITE_OPENAI_IMAGE_MODEL
const openaiTtsModel = import.meta.env.VITE_OPENAI_TTS_MODEL
const openaiTtsVoice = import.meta.env.VITE_OPENAI_TTS_VOICE

const describeLive = shouldRunLiveCheck ? describe : describe.skip

describeLive('Storybooks OpenAI live check (optional)', () => {
  it(
    '프롬프트 응답 기반으로 이미지 3장 + TTS 10개를 생성해 ebook payload를 반환한다',
    async () => {
      expect(openaiApiKey).toBeTruthy()
      if (!openaiApiKey) {
        return
      }

      const response = await onRequestPost({
        request: new Request('https://example.test/api/storybooks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: 'live-test-user',
            language: 'ko',
            title: '작은 별 배달부',
            description: '작은 여우가 잃어버린 별을 찾아 밤하늘에 돌려주는 이야기',
          }),
        }),
        env: {
          OPENAI_API_KEY: openaiApiKey,
          OPENAI_PROMPT_VERSION: openaiPromptVersion,
          ...(openaiPromptId ? { OPENAI_PROMPT_ID: openaiPromptId } : {}),
          ...(openaiImageModel ? { OPENAI_IMAGE_MODEL: openaiImageModel } : {}),
          ...(openaiTtsModel ? { OPENAI_TTS_MODEL: openaiTtsModel } : {}),
          ...(openaiTtsVoice ? { OPENAI_TTS_VOICE: openaiTtsVoice } : {}),
        },
      } as unknown as Parameters<typeof onRequestPost>[0])

      expect(response.status).toBe(200)

      const payload = (await response.json()) as {
        promptVersion: string
        upstreamPromptVersion: string | null
        pages: Array<{ page: number; content: string; isHighlight: boolean }>
        images: string[]
        narrations: Array<{ page: number; audioDataUrl: string }>
      }

      expect(payload.promptVersion).toBe(openaiPromptVersion)
      expect(payload.upstreamPromptVersion).toBe(openaiPromptVersion)
      expect(payload.pages).toHaveLength(10)
      expect(payload.images).toHaveLength(3)
      expect(payload.images.every((image) => image.startsWith('data:image/'))).toBe(true)
      expect(payload.narrations).toHaveLength(10)
      expect(payload.narrations.every((narration) => narration.audioDataUrl.startsWith('data:audio/mpeg;base64,'))).toBe(true)
    },
    180000,
  )
})
