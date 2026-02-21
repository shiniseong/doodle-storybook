import { beforeEach, describe, expect, it } from 'vitest'

import {
  STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY,
  clearStorybookWorkspaceDraft,
  loadStorybookWorkspaceDraft,
  saveStorybookWorkspaceDraft,
} from '@features/storybook-creation/model/storybook-compose-draft.storage'

describe('storybookWorkspaceDraftStorage', () => {
  beforeEach(() => {
    window.sessionStorage.removeItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY)
  })

  it('저장된 값이 없으면 빈 초안을 반환한다', () => {
    expect(loadStorybookWorkspaceDraft()).toEqual({
      title: '',
      authorName: '',
      description: '',
      canvasDataUrl: null,
    })
  })

  it('저장한 초안을 다시 읽어온다', () => {
    saveStorybookWorkspaceDraft({
      title: '달빛 캠핑',
      authorName: '별빛 작가',
      description: '캠핑장에 별빛이 내려요',
      canvasDataUrl: 'data:image/png;base64,mock',
    })

    expect(loadStorybookWorkspaceDraft()).toEqual({
      title: '달빛 캠핑',
      authorName: '별빛 작가',
      description: '캠핑장에 별빛이 내려요',
      canvasDataUrl: 'data:image/png;base64,mock',
    })
  })

  it('잘못된 저장값이면 빈 초안으로 안전하게 복구한다', () => {
    window.sessionStorage.setItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY, '{not-json')

    expect(loadStorybookWorkspaceDraft()).toEqual({
      title: '',
      authorName: '',
      description: '',
      canvasDataUrl: null,
    })
  })

  it('빈 초안을 저장하면 기존 저장값을 제거한다', () => {
    window.sessionStorage.setItem(
      STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        title: '기존 제목',
        authorName: '기존 작가',
        description: '기존 설명',
        canvasDataUrl: 'data:image/png;base64,existing',
      }),
    )

    saveStorybookWorkspaceDraft({
      title: '',
      authorName: '',
      description: '',
      canvasDataUrl: null,
    })

    expect(window.sessionStorage.getItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('clear는 저장된 초안을 제거한다', () => {
    saveStorybookWorkspaceDraft({
      title: '제목',
      authorName: '작가',
      description: '설명',
      canvasDataUrl: null,
    })

    clearStorybookWorkspaceDraft()

    expect(window.sessionStorage.getItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY)).toBeNull()
  })
})
