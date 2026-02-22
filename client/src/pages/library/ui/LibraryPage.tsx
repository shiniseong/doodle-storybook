import { BookOpenText, RefreshCcw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  type ListStorybooksUseCasePort,
  type StorybookLibraryItem,
} from '@features/storybook-library/application/list-storybooks.use-case'
import { LanguageSwitcher } from '@shared/ui/language-switcher/LanguageSwitcher'

import './LibraryPage.css'

type LibraryLoadState = 'loading' | 'success' | 'error'

interface LibraryPageDependencies {
  listStorybooksUseCase: ListStorybooksUseCasePort
}

interface LibraryPageProps {
  dependencies: LibraryPageDependencies
  userId: string
  onBackToCreate?: () => void
}

function formatCreatedAt(value: string | null, language: string): string | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Intl.DateTimeFormat(language, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

function StorybookLibraryCard({
  item,
  locale,
  unknownAuthorLabel,
  createdAtLabel,
}: {
  item: StorybookLibraryItem
  locale: string
  unknownAuthorLabel: string
  createdAtLabel: string
}) {
  const createdAt = formatCreatedAt(item.createdAt, locale)

  return (
    <li className="library-card">
      <article>
        <div className="library-card__cover">
          {item.originImageUrl ? (
            <img src={item.originImageUrl} alt={item.title} loading="lazy" />
          ) : (
            <div className="library-card__placeholder" aria-hidden="true">
              <BookOpenText size={30} strokeWidth={2.1} />
            </div>
          )}
        </div>
        <div className="library-card__meta">
          <h2>{item.title}</h2>
          <p>{item.authorName ?? unknownAuthorLabel}</p>
          {createdAt ? (
            <time dateTime={item.createdAt ?? undefined}>
              {createdAtLabel} {createdAt}
            </time>
          ) : null}
        </div>
      </article>
    </li>
  )
}

export function LibraryPage({ dependencies, userId, onBackToCreate }: LibraryPageProps) {
  const { i18n, t } = useTranslation()
  const [loadState, setLoadState] = useState<LibraryLoadState>('loading')
  const [items, setItems] = useState<StorybookLibraryItem[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)
  const listStorybooksUseCase = useMemo(() => dependencies.listStorybooksUseCase, [dependencies])

  useEffect(() => {
    let isDisposed = false

    void listStorybooksUseCase.execute({
      userId,
      limit: 60,
    }).then((result) => {
      if (isDisposed) {
        return
      }

      if (!result.ok) {
        setLoadState('error')
        setErrorMessage(result.error.message)
        return
      }

      setItems(result.value.items)
      setLoadState('success')
    })

    return () => {
      isDisposed = true
    }
  }, [listStorybooksUseCase, userId, reloadVersion])

  return (
    <div className="library-page">
      <header className="library-header">
        <div className="library-header__main">
          <p>{t('library.eyebrow')}</p>
          <h1>{t('library.title')}</h1>
          <span>{t('library.description')}</span>
        </div>
        <div className="library-header__actions">
          <LanguageSwitcher />
          <button type="button" onClick={onBackToCreate}>
            {t('library.actions.backToCreate')}
          </button>
        </div>
      </header>

      {loadState === 'loading' ? (
        <section className="library-state">
          <p>{t('library.state.loading')}</p>
        </section>
      ) : null}

      {loadState === 'error' ? (
        <section className="library-state">
          <p>{errorMessage ?? t('library.state.error')}</p>
          <button
            type="button"
            className="library-state__retry"
            onClick={() => {
              setLoadState('loading')
              setErrorMessage(null)
              setReloadVersion((previous) => previous + 1)
            }}
          >
            <RefreshCcw size={14} strokeWidth={2.4} />
            {t('library.actions.retry')}
          </button>
        </section>
      ) : null}

      {loadState === 'success' && items.length === 0 ? (
        <section className="library-state">
          <p>{t('library.state.empty')}</p>
        </section>
      ) : null}

      {loadState === 'success' && items.length > 0 ? (
        <ul className="library-grid">
          {items.map((item) => (
            <StorybookLibraryCard
              key={item.storybookId}
              item={item}
              locale={i18n.language}
              unknownAuthorLabel={t('library.card.unknownAuthor')}
              createdAtLabel={t('library.card.createdAt')}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}
