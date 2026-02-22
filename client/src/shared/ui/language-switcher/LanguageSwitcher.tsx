import { Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  LANGUAGE_OPTIONS,
  type AppLanguage,
  resolveAppLanguage,
} from '@shared/config/i18n/constants'

import './LanguageSwitcher.css'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const currentLanguage = resolveAppLanguage(i18n.language)

  return (
    <label className="language-switcher">
      <Globe className="language-switcher__icon" size={16} strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">{t('common.language')}</span>
      <select
        className="language-switcher__select"
        aria-label={t('common.language')}
        value={currentLanguage}
        onChange={async (event) => {
          await i18n.changeLanguage(event.target.value as AppLanguage)
        }}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.nativeLabel}
          </option>
        ))}
      </select>
    </label>
  )
}
