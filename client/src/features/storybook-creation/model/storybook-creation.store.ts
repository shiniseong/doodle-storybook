import { create } from 'zustand'

const FREE_STORY_QUOTA_TOTAL = 2

export type StorybookCreationStatus = 'idle' | 'submitting' | 'success' | 'error'
export type StorybookCreationErrorCode =
  | 'EMPTY_DESCRIPTION'
  | 'DESCRIPTION_TOO_LONG'
  | 'INVALID_LANGUAGE'
  | 'QUOTA_EXCEEDED'
  | 'REQUIRED_AGREEMENTS_NOT_ACCEPTED'
  | 'UNEXPECTED'

export type StorybookCreationFeedback =
  | { kind: 'success'; storybookId: string }
  | { kind: 'error'; code: StorybookCreationErrorCode; message?: string }

interface StorybookCreationState {
  readonly createStatus: StorybookCreationStatus
  readonly feedback: StorybookCreationFeedback | null
  readonly lastCreatedStorybookId: string | null
  readonly freeStoryQuotaTotal: number
  readonly freeStoryQuotaUsed: number
  startSubmitting: () => void
  markSuccess: (storybookId: string) => void
  markError: (code: StorybookCreationErrorCode, message?: string) => void
  syncQuota: (total: number, used: number) => void
  reset: () => void
}

const initialState = {
  createStatus: 'idle' as const,
  feedback: null,
  lastCreatedStorybookId: null,
  freeStoryQuotaTotal: FREE_STORY_QUOTA_TOTAL,
  freeStoryQuotaUsed: 0,
}

export const useStorybookCreationStore = create<StorybookCreationState>((set) => ({
  ...initialState,
  startSubmitting: () => {
    set({
      createStatus: 'submitting',
      feedback: null,
    })
  },
  markSuccess: (storybookId: string) => {
    set((state) => ({
      createStatus: 'success',
      feedback: { kind: 'success', storybookId },
      lastCreatedStorybookId: storybookId,
      freeStoryQuotaUsed: Math.min(state.freeStoryQuotaUsed + 1, state.freeStoryQuotaTotal),
    }))
  },
  markError: (code: StorybookCreationErrorCode, message?: string) => {
    set({
      createStatus: 'error',
      feedback: { kind: 'error', code, ...(message ? { message } : {}) },
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
