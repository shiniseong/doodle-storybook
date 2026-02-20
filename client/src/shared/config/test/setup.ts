import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

import i18n from '@shared/config/i18n/i18n'
import { LANGUAGE_STORAGE_KEY } from '@shared/config/i18n/constants'

const STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY = 'doodle-storybook.workspace-draft.v1'

function isStorageLike(candidate: unknown): candidate is Storage {
  return (
    typeof candidate === 'object' &&
    candidate !== null &&
    'getItem' in candidate &&
    typeof candidate.getItem === 'function' &&
    'setItem' in candidate &&
    typeof candidate.setItem === 'function' &&
    'removeItem' in candidate &&
    typeof candidate.removeItem === 'function'
  )
}

function createInMemoryStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null
    },
    getItem(key: string) {
      return store.get(key) ?? null
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value))
    },
    removeItem(key: string) {
      store.delete(key)
    },
  }
}

function ensureLocalStorage() {
  if (isStorageLike(window.localStorage as unknown)) {
    return
  }

  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: createInMemoryStorage(),
  })
}

beforeEach(async () => {
  ensureLocalStorage()
  const storageCandidate = window.localStorage as unknown

  if (isStorageLike(storageCandidate)) {
    storageCandidate.removeItem(LANGUAGE_STORAGE_KEY)
    storageCandidate.removeItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY)
  }
  await i18n.changeLanguage('ko')
})

afterEach(() => {
  cleanup()
})
