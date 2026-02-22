import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { THEME_STORAGE_KEY } from '@shared/config/theme/constants'
import { ThemeProvider } from '@shared/lib/theme/theme-context'
import { ThemeToggle } from '@shared/ui/theme-toggle/ThemeToggle'

function setMatchMedia(matcher: (query: string) => boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) =>
      ({
        matches: matcher(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => true,
      }) as MediaQueryList,
  })
}

describe('ThemeToggle', () => {
  it('초기 day 모드에서 해 아이콘/낮 텍스트와 밤 전환 라벨을 보여준다', () => {
    window.localStorage.removeItem(THEME_STORAGE_KEY)
    setMatchMedia(() => false)

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    expect(screen.getByRole('button', { name: '밤 모드로 전환' })).toBeInTheDocument()
    expect(screen.getByText('낮')).toBeInTheDocument()
    expect(document.documentElement.getAttribute('data-theme')).toBe('day')
  })

  it('클릭 시 night 모드로 전환되며 텍스트와 aria-label이 바뀐다', async () => {
    const user = userEvent.setup()
    window.localStorage.removeItem(THEME_STORAGE_KEY)
    setMatchMedia(() => false)

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    )

    await user.click(screen.getByRole('button', { name: '밤 모드로 전환' }))

    expect(screen.getByRole('button', { name: '낮 모드로 전환' })).toBeInTheDocument()
    expect(screen.getByText('밤')).toBeInTheDocument()
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('night')
  })
})
