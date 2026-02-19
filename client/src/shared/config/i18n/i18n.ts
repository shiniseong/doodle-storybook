import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import { LANGUAGE_STORAGE_KEY, resolveAppLanguage } from '@shared/config/i18n/constants'
import { i18nResources } from '@shared/config/i18n/resources'

const getStorage = () => {
  if (typeof window === 'undefined') {
    return null
  }

  const storageCandidate = window.localStorage as unknown
  if (
    typeof storageCandidate === 'object' &&
    storageCandidate !== null &&
    'getItem' in storageCandidate &&
    typeof storageCandidate.getItem === 'function' &&
    'setItem' in storageCandidate &&
    typeof storageCandidate.setItem === 'function'
  ) {
    return storageCandidate as Storage
  }

  return null
}

const resolveInitialLanguage = () => {
  const storage = getStorage()
  const storedLanguage = storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null
  return resolveAppLanguage(storedLanguage)
}

if (!i18n.isInitialized) {
  const initialLanguage = resolveInitialLanguage()

  void i18n.use(initReactI18next).init({
    resources: i18nResources,
    lng: initialLanguage,
    fallbackLng: 'ko',
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  })

  i18n.on('languageChanged', (nextLanguage) => {
    const resolvedLanguage = resolveAppLanguage(nextLanguage)
    const storage = getStorage()
    storage?.setItem(LANGUAGE_STORAGE_KEY, resolvedLanguage)
    if (typeof document !== 'undefined') {
      document.documentElement.lang = resolvedLanguage
    }
  })

  if (typeof document !== 'undefined') {
    document.documentElement.lang = initialLanguage
  }
}

export default i18n
