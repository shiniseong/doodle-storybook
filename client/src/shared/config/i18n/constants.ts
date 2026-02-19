export const APP_LANGUAGE_CODES = ['ko', 'en', 'ja', 'zh'] as const

export type AppLanguage = (typeof APP_LANGUAGE_CODES)[number]

export const LANGUAGE_STORAGE_KEY = 'doodle-storybook.language'

export const LANGUAGE_OPTIONS: ReadonlyArray<{ code: AppLanguage; nativeLabel: string }> = [
  { code: 'ko', nativeLabel: '한국어' },
  { code: 'en', nativeLabel: 'English' },
  { code: 'ja', nativeLabel: '日本語' },
  { code: 'zh', nativeLabel: '简体中文' },
]

export const resolveAppLanguage = (rawLanguage: string | null | undefined): AppLanguage => {
  if (rawLanguage === null || rawLanguage === undefined) {
    return 'ko'
  }

  const normalized = rawLanguage.toLowerCase().split('-')[0]
  if (APP_LANGUAGE_CODES.includes(normalized as AppLanguage)) {
    return normalized as AppLanguage
  }

  return 'ko'
}
