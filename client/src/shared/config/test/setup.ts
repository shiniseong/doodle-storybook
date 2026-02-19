import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

import i18n from '@shared/config/i18n/i18n'
import { LANGUAGE_STORAGE_KEY } from '@shared/config/i18n/constants'

beforeEach(async () => {
  const storageCandidate = window.localStorage as unknown
  if (
    typeof storageCandidate === 'object' &&
    storageCandidate !== null &&
    'removeItem' in storageCandidate &&
    typeof storageCandidate.removeItem === 'function'
  ) {
    storageCandidate.removeItem(LANGUAGE_STORAGE_KEY)
  }
  await i18n.changeLanguage('ko')
})

afterEach(() => {
  cleanup()
})
