import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { THEME_STORAGE_KEY, type ThemeMode, resolveThemeMode } from '@shared/config/theme/constants'

const LIGHTS_ON_DURATION_MS = 520
const LIGHTS_OFF_APPLY_DELAY_MS = 120
const LIGHTS_OFF_TOTAL_DURATION_MS = 420
const REDUCED_MOTION_DURATION_MS = 120

export interface ThemeTransitionSourcePoint {
  x: number
  y: number
}

interface ThemeContextValue {
  theme: ThemeMode
  setTheme: (nextTheme: ThemeMode, sourcePoint?: ThemeTransitionSourcePoint) => void
  toggleTheme: (sourcePoint?: ThemeTransitionSourcePoint) => void
}

const FALLBACK_THEME_CONTEXT: ThemeContextValue = {
  theme: 'day',
  setTheme: () => {},
  toggleTheme: () => {},
}

const ThemeContext = createContext<ThemeContextValue>(FALLBACK_THEME_CONTEXT)

function resolveStorage(): Storage | null {
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

function resolveThemeFromSystemPreference(): ThemeMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'day'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'day'
}

function resolveInitialTheme(): ThemeMode {
  const storage = resolveStorage()
  const storedTheme = storage?.getItem(THEME_STORAGE_KEY) ?? null
  if (storedTheme !== null) {
    return resolveThemeMode(storedTheme)
  }

  return resolveThemeFromSystemPreference()
}

function shouldReduceMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function applyTransitionOrigin(sourcePoint?: ThemeTransitionSourcePoint): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.style.setProperty('--theme-transition-x', sourcePoint ? `${sourcePoint.x}px` : '50vw')
  root.style.setProperty('--theme-transition-y', sourcePoint ? `${sourcePoint.y}px` : '50vh')
}

function clearThemeTransition(): void {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.removeAttribute('data-theme-transition')
}

function applyThemeToDocument(theme: ThemeMode): void {
  if (typeof document === 'undefined') {
    return
  }

  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.style.colorScheme = theme === 'night' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => resolveInitialTheme())
  const currentThemeRef = useRef<ThemeMode>(theme)
  const applyThemeTimerRef = useRef<number | null>(null)
  const clearTransitionTimerRef = useRef<number | null>(null)

  const clearTransitionTimers = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (applyThemeTimerRef.current !== null) {
      window.clearTimeout(applyThemeTimerRef.current)
      applyThemeTimerRef.current = null
    }

    if (clearTransitionTimerRef.current !== null) {
      window.clearTimeout(clearTransitionTimerRef.current)
      clearTransitionTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    currentThemeRef.current = theme
  }, [theme])

  useEffect(() => {
    applyThemeToDocument(currentThemeRef.current)

    return () => {
      clearTransitionTimers()
      clearThemeTransition()
    }
  }, [clearTransitionTimers])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return
      }

      const nextTheme = resolveThemeMode(event.newValue)
      if (nextTheme === currentThemeRef.current) {
        return
      }

      clearTransitionTimers()
      clearThemeTransition()
      currentThemeRef.current = nextTheme
      setThemeState(nextTheme)
      applyThemeToDocument(nextTheme)
    }

    window.addEventListener('storage', handleStorage)

    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [clearTransitionTimers])

  const setTheme = useCallback(
    (nextTheme: ThemeMode, sourcePoint?: ThemeTransitionSourcePoint) => {
      const previousTheme = currentThemeRef.current
      if (previousTheme === nextTheme) {
        return
      }

      const storage = resolveStorage()
      try {
        storage?.setItem(THEME_STORAGE_KEY, nextTheme)
      } catch {
        // Ignore storage failures.
      }

      currentThemeRef.current = nextTheme
      setThemeState(nextTheme)

      if (typeof document === 'undefined') {
        return
      }

      clearTransitionTimers()
      clearThemeTransition()
      applyTransitionOrigin(sourcePoint)

      const root = document.documentElement
      if (shouldReduceMotion()) {
        root.setAttribute('data-theme-transition', 'simple')
        applyThemeToDocument(nextTheme)
        if (typeof window !== 'undefined') {
          clearTransitionTimerRef.current = window.setTimeout(() => {
            clearThemeTransition()
            clearTransitionTimerRef.current = null
          }, REDUCED_MOTION_DURATION_MS)
        }
        return
      }

      if (previousTheme === 'night' && nextTheme === 'day') {
        root.setAttribute('data-theme-transition', 'lights-on')
        applyThemeToDocument(nextTheme)
        if (typeof window !== 'undefined') {
          clearTransitionTimerRef.current = window.setTimeout(() => {
            clearThemeTransition()
            clearTransitionTimerRef.current = null
          }, LIGHTS_ON_DURATION_MS)
        }
        return
      }

      root.setAttribute('data-theme-transition', 'lights-off')
      if (typeof window !== 'undefined') {
        applyThemeTimerRef.current = window.setTimeout(() => {
          applyThemeToDocument(nextTheme)
          applyThemeTimerRef.current = null
        }, LIGHTS_OFF_APPLY_DELAY_MS)

        clearTransitionTimerRef.current = window.setTimeout(() => {
          clearThemeTransition()
          clearTransitionTimerRef.current = null
        }, LIGHTS_OFF_TOTAL_DURATION_MS)
      }
    },
    [clearTransitionTimers],
  )

  const toggleTheme = useCallback(
    (sourcePoint?: ThemeTransitionSourcePoint) => {
      const nextTheme = currentThemeRef.current === 'day' ? 'night' : 'day'
      setTheme(nextTheme, sourcePoint)
    },
    [setTheme],
  )

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
