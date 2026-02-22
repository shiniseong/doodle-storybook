export const THEME_MODES = ['day', 'night'] as const

export type ThemeMode = (typeof THEME_MODES)[number]

export const THEME_STORAGE_KEY = 'doodle-storybook.theme.v1'

export function resolveThemeMode(rawTheme: string | null | undefined): ThemeMode {
  if (rawTheme === 'night') {
    return 'night'
  }

  return 'day'
}
