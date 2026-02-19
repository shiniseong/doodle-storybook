import { create } from 'zustand'

const FREE_STORY_QUOTA_TOTAL = 2

export type StorybookCreationStatus = 'idle' | 'submitting' | 'success' | 'error'

interface StorybookCreationState {
  readonly createStatus: StorybookCreationStatus
  readonly feedbackMessage: string | null
  readonly lastCreatedStorybookId: string | null
  readonly freeStoryQuotaTotal: number
  readonly freeStoryQuotaUsed: number
  startSubmitting: () => void
  markSuccess: (storybookId: string) => void
  markError: (message: string) => void
  syncQuota: (total: number, used: number) => void
  reset: () => void
}

const initialState = {
  createStatus: 'idle' as const,
  feedbackMessage: null,
  lastCreatedStorybookId: null,
  freeStoryQuotaTotal: FREE_STORY_QUOTA_TOTAL,
  freeStoryQuotaUsed: 0,
}

export const useStorybookCreationStore = create<StorybookCreationState>((set) => ({
  ...initialState,
  startSubmitting: () => {
    set({
      createStatus: 'submitting',
      feedbackMessage: null,
    })
  },
  markSuccess: (storybookId: string) => {
    set((state) => ({
      createStatus: 'success',
      feedbackMessage: `동화 생성 요청 완료: ${storybookId}`,
      lastCreatedStorybookId: storybookId,
      freeStoryQuotaUsed: Math.min(state.freeStoryQuotaUsed + 1, state.freeStoryQuotaTotal),
    }))
  },
  markError: (message: string) => {
    set({
      createStatus: 'error',
      feedbackMessage: message,
    })
  },
  syncQuota: (total: number, used: number) => {
    set({
      freeStoryQuotaTotal: Math.max(0, total),
      freeStoryQuotaUsed: Math.max(0, used),
    })
  },
  reset: () => {
    set(initialState)
  },
}))

export const selectRemainingFreeStories = (state: StorybookCreationState): number =>
  Math.max(0, state.freeStoryQuotaTotal - state.freeStoryQuotaUsed)
