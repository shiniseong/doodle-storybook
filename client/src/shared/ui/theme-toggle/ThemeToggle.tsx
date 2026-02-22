import { Moon, Sun } from 'lucide-react'
import type { MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@shared/lib/theme/theme-context'

import './ThemeToggle.css'

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()
  const isDayTheme = theme === 'day'

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    toggleTheme({
      x: bounds.left + bounds.width / 2,
      y: bounds.top + bounds.height / 2,
    })
  }

  return (
    <button
      type="button"
      className={`theme-toggle ${isDayTheme ? 'theme-toggle--day' : 'theme-toggle--night'}`}
      aria-label={isDayTheme ? t('common.theme.switchToNight') : t('common.theme.switchToDay')}
      onClick={handleClick}
    >
      {isDayTheme ? (
        <Sun className="theme-toggle__icon" size={16} strokeWidth={2} aria-hidden="true" />
      ) : (
        <Moon className="theme-toggle__icon" size={16} strokeWidth={2} aria-hidden="true" />
      )}
      <span className="theme-toggle__label">{isDayTheme ? t('common.theme.dayLabel') : t('common.theme.nightLabel')}</span>
    </button>
  )
}
