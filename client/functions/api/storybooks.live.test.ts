import { describe, expect, it } from 'vitest'

import { onRequestPost } from './storybooks'

const shouldRunLiveCheck = import.meta.env.VITE_OPENAI_LIVE_CHECK === '1'
const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY
const openaiPromptId = import.meta.env.VITE_OPENAI_PROMPT_ID
const openaiPromptVersion = import.meta.env.VITE_OPENAI_PROMPT_VERSION ?? '21'
const openaiImageModel = import.meta.env.VITE_OPENAI_IMAGE_MODEL
const openaiTtsModel = import.meta.env.VITE_OPENAI_TTS_MODEL
const openaiTtsVoice = import.meta.env.VITE_OPENAI_TTS_VOICE
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseSecretKey = import.meta.env.VITE_SUPABASE_SECRET_KEY ?? import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

const describeLive = shouldRunLiveCheck ? describe : describe.skip

describeLive('Storybooks OpenAI live check (optional)', () => {
  it(
    '프롬프트 응답 기반으로 이미지 3장 + TTS 10개를 생성해 ebook payload를 반환한다',
    async () => {
      expect(openaiApiKey).toBeTruthy()
      expect(supabaseUrl).toBeTruthy()
      expect(supabaseSecretKey).toBeTruthy()
      if (!openaiApiKey || !supabaseUrl || !supabaseSecretKey) {
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
          SUPABASE_URL: supabaseUrl,
          SUPABASE_SECRET_KEY: supabaseSecretKey,
          STORYBOOK_ASSETS_BUCKET: {
            put: async () => null,
          },
          ...(openaiPromptId ? { OPENAI_PROMPT_ID: openaiPromptId } : {}),
          ...(openaiImageModel ? { OPENAI_IMAGE_MODEL: openaiImageModel } : {}),
          ...(openaiTtsModel ? { OPENAI_TTS_MODEL: openaiTtsModel } : {}),
          ...(openaiTtsVoice ? { OPENAI_TTS_VOICE: openaiTtsVoice } : {}),
        },
      } as unknown as Parameters<typeof onRequestPost>[0])

      expect(response.status).toBe(200)

      const payload = (await response.json()) as {
        storybookId: string
        details: {
          output: Array<{
            pageIndex: number
            pageType: 'cover' | 'story'
          }>
        }
        ebook: {
          pages: Array<{ page: number; content: string; isHighlight: boolean }>
          narrations: Array<{ page: number; audioDataUrl: string }>
          coverImageUrl: string | null
          highlightImageUrl: string | null
          finalImageUrl: string | null
        }
      }

      expect(payload.storybookId.length).toBeGreaterThan(0)
      expect(payload.details.output).toHaveLength(11)
      expect(payload.ebook.pages).toHaveLength(10)
      expect(payload.ebook.pages.filter((page) => page.isHighlight)).toHaveLength(1)
      expect(payload.ebook.coverImageUrl === null || payload.ebook.coverImageUrl.length > 0).toBe(true)
      expect(payload.ebook.highlightImageUrl === null || payload.ebook.highlightImageUrl.length > 0).toBe(true)
      expect(payload.ebook.finalImageUrl === null || payload.ebook.finalImageUrl.length > 0).toBe(true)
      expect(payload.ebook.narrations.length <= 10).toBe(true)
      expect(payload.ebook.narrations.every((narration) => narration.page >= 1 && narration.page <= 10)).toBe(true)
    },
    180000,
  )
})
