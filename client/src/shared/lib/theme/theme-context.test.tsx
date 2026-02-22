import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { THEME_STORAGE_KEY } from '@shared/config/theme/constants'
import { ThemeProvider, useTheme } from '@shared/lib/theme/theme-context'

function createMatchMedia(matcher: (query: string) => boolean) {
  return (query: string): MediaQueryList =>
    ({
      matches: matcher(query),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as unknown as MediaQueryList
}

function setMatchMedia(matcher: (query: string) => boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: createMatchMedia(matcher),
  })
}

function ThemeHarness() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <p data-testid="theme-value">{theme}</p>
      <button
        type="button"
        onClick={() => {
          setTheme('night', { x: 100, y: 200 })
        }}
      >
        to-night
      </button>
      <button
        type="button"
        onClick={() => {
          setTheme('day', { x: 120, y: 240 })
        }}
      >
        to-day
      </button>
    </div>
  )
}

afterEach(() => {
  vi.useRealTimers()
})

describe('theme-context', () => {
  it('저장된 테마가 시스템 테마보다 우선한다', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'night')
    setMatchMedia((query) => query === '(prefers-color-scheme: dark)')

    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value')).toHaveTextContent('night')
    expect(document.documentElement.getAttribute('data-theme')).toBe('night')
  })

  it('저장된 테마가 없으면 시스템 테마를 초기값으로 사용한다', () => {
    window.localStorage.removeItem(THEME_STORAGE_KEY)
    setMatchMedia((query) => query === '(prefers-color-scheme: dark)')

    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    )

    expect(screen.getByTestId('theme-value')).toHaveTextContent('night')
    expect(document.documentElement.getAttribute('data-theme')).toBe('night')
  })

  it('테마 전환 시 방향별 transition 속성과 저장값을 반영한다', () => {
    vi.useFakeTimers()
    window.localStorage.setItem(THEME_STORAGE_KEY, 'day')
    setMatchMedia(() => false)

    render(
      <ThemeProvider>
        <ThemeHarness />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'to-night' }))

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('night')
    expect(document.documentElement.getAttribute('data-theme-transition')).toBe('lights-off')
    expect(document.documentElement.getAttribute('data-theme')).toBe('day')
    expect(document.documentElement.style.getPropertyValue('--theme-transition-x')).toBe('100px')
    expect(document.documentElement.style.getPropertyValue('--theme-transition-y')).toBe('200px')

    act(() => {
      vi.advanceTimersByTime(120)
    })

    expect(document.documentElement.getAttribute('data-theme')).toBe('night')

    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(document.documentElement.getAttribute('data-theme-transition')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'to-day' }))

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('day')
    expect(document.documentElement.getAttribute('data-theme-transition')).toBe('lights-on')
    expect(document.documentElement.getAttribute('data-theme')).toBe('day')
    expect(document.documentElement.style.getPropertyValue('--theme-transition-x')).toBe('120px')
    expect(document.documentElement.style.getPropertyValue('--theme-transition-y')).toBe('240px')

    act(() => {
      vi.advanceTimersByTime(520)
    })

    expect(document.documentElement.getAttribute('data-theme-transition')).toBeNull()
  })
})
