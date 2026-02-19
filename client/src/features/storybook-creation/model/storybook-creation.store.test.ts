import { beforeEach, describe, expect, it } from 'vitest'

import {
  selectRemainingFreeStories,
  useStorybookCreationStore,
} from '@features/storybook-creation/model/storybook-creation.store'

describe('storybookCreationStore', () => {
  beforeEach(() => {
    useStorybookCreationStore.getState().reset()
  })

  it('초기 상태는 idle, quota 2편이다', () => {
    const state = useStorybookCreationStore.getState()

    expect(state.createStatus).toBe('idle')
    expect(state.feedbackMessage).toBeNull()
    expect(selectRemainingFreeStories(state)).toBe(2)
  })

  it('startSubmitting 은 진행 상태와 피드백 초기화를 수행한다', () => {
    const { markError, startSubmitting } = useStorybookCreationStore.getState()
    markError('임시 오류')
    startSubmitting()

    const nextState = useStorybookCreationStore.getState()
    expect(nextState.createStatus).toBe('submitting')
    expect(nextState.feedbackMessage).toBeNull()
  })

  it('markSuccess 는 성공 상태, 메시지, quota 감소를 반영한다', () => {
    const { markSuccess } = useStorybookCreationStore.getState()
    markSuccess('storybook-100')

    const nextState = useStorybookCreationStore.getState()
    expect(nextState.createStatus).toBe('success')
    expect(nextState.feedbackMessage).toBe('동화 생성 요청 완료: storybook-100')
    expect(nextState.lastCreatedStorybookId).toBe('storybook-100')
    expect(selectRemainingFreeStories(nextState)).toBe(1)
  })

  it('quota 사용량은 전체 quota를 초과하지 않는다', () => {
    const { markSuccess } = useStorybookCreationStore.getState()
    markSuccess('storybook-1')
    markSuccess('storybook-2')
    markSuccess('storybook-3')

    const nextState = useStorybookCreationStore.getState()
    expect(nextState.freeStoryQuotaUsed).toBe(2)
    expect(selectRemainingFreeStories(nextState)).toBe(0)
  })

  it('syncQuota 는 서버에서 받은 quota를 반영한다', () => {
    const { syncQuota } = useStorybookCreationStore.getState()
    syncQuota(5, 3)

    const nextState = useStorybookCreationStore.getState()
    expect(nextState.freeStoryQuotaTotal).toBe(5)
    expect(nextState.freeStoryQuotaUsed).toBe(3)
    expect(selectRemainingFreeStories(nextState)).toBe(2)
  })
})
