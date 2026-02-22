import { BookOpenText, RefreshCcw, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { type DeleteStorybookUseCasePort } from '@features/storybook-deletion/application/delete-storybook.use-case'
import {
  type ListStorybooksUseCasePort,
  type StorybookLibraryItem,
} from '@features/storybook-library/application/list-storybooks.use-case'
import { LanguageSwitcher } from '@shared/ui/language-switcher/LanguageSwitcher'

import './LibraryPage.css'

type LibraryLoadState = 'loading' | 'success' | 'error'
const LIBRARY_SKELETON_CARD_COUNT = 8

interface LibraryPageDependencies {
  listStorybooksUseCase: ListStorybooksUseCasePort
  deleteStorybookUseCase: DeleteStorybookUseCasePort
}

interface LibraryPageProps {
  dependencies: LibraryPageDependencies
  userId: string
  onBackToCreate?: () => void
  onOpenStorybookDetail?: (storybookId: string) => void
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
  onOpenStorybookDetail,
  onDeleteStorybook,
  isDeleting,
  deleteLabel,
  deletingLabel,
}: {
  item: StorybookLibraryItem
  locale: string
  unknownAuthorLabel: string
  createdAtLabel: string
  onOpenStorybookDetail?: (storybookId: string) => void
  onDeleteStorybook?: (storybookId: string) => void
  isDeleting?: boolean
  deleteLabel: string
  deletingLabel: string
}) {
  const createdAt = formatCreatedAt(item.createdAt, locale)
  const cardBody = (
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
  )

  return (
    <li className="library-card">
      {onOpenStorybookDetail ? (
        <button
          type="button"
          className="library-card__button"
          onClick={() => {
            onOpenStorybookDetail(item.storybookId)
          }}
          aria-label={item.title}
        >
          {cardBody}
        </button>
      ) : (
        cardBody
      )}
      {onDeleteStorybook ? (
        <button
          type="button"
          className="library-card__delete"
          aria-label={`${isDeleting ? deletingLabel : deleteLabel}: ${item.title}`}
          title={isDeleting ? deletingLabel : deleteLabel}
          onClick={() => {
            onDeleteStorybook(item.storybookId)
          }}
          disabled={isDeleting}
        >
          <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
          <span>{isDeleting ? deletingLabel : deleteLabel}</span>
        </button>
      ) : null}
    </li>
  )
}

function LibraryCardSkeleton() {
  return (
    <li className="library-card library-card--skeleton" aria-hidden="true">
      <article>
        <div className="library-card__cover">
          <div className="library-skeleton library-skeleton--cover" />
        </div>
        <div className="library-card__meta">
          <div className="library-skeleton library-skeleton--title" />
          <div className="library-skeleton library-skeleton--author" />
          <div className="library-skeleton library-skeleton--date" />
        </div>
      </article>
    </li>
  )
}

export function LibraryPage({ dependencies, userId, onBackToCreate, onOpenStorybookDetail }: LibraryPageProps) {
  const { i18n, t } = useTranslation()
  const [loadState, setLoadState] = useState<LibraryLoadState>('loading')
  const [items, setItems] = useState<StorybookLibraryItem[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)
  const [deletingStorybookIds, setDeletingStorybookIds] = useState<Set<string>>(new Set())
  const [reloadVersion, setReloadVersion] = useState(0)
  const listStorybooksUseCase = useMemo(() => dependencies.listStorybooksUseCase, [dependencies])
  const deleteStorybookUseCase = useMemo(() => dependencies.deleteStorybookUseCase, [dependencies])
  const handleReload = () => {
    setLoadState('loading')
    setErrorMessage(null)
    setDeleteErrorMessage(null)
    setReloadVersion((previous) => previous + 1)
  }

  const handleDeleteStorybook = useCallback(
    async (storybookId: string) => {
      const isConfirmed =
        typeof window === 'undefined'
          ? true
          : window.confirm(t('library.actions.deleteConfirm'))
      if (!isConfirmed) {
        return
      }

      setDeleteErrorMessage(null)
      setDeletingStorybookIds((previous) => {
        const next = new Set(previous)
        next.add(storybookId)
        return next
      })

      const result = await deleteStorybookUseCase.execute({
        userId,
        storybookId,
      })

      if (!result.ok) {
        setDeleteErrorMessage(result.error.message)
      } else {
        setItems((previous) => previous.filter((item) => item.storybookId !== storybookId))
      }

      setDeletingStorybookIds((previous) => {
        const next = new Set(previous)
        next.delete(storybookId)
        return next
      })
    },
    [deleteStorybookUseCase, t, userId],
  )

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
        setDeleteErrorMessage(null)
        return
      }

      setItems(result.value.items)
      setDeletingStorybookIds(new Set())
      setDeleteErrorMessage(null)
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
          <button type="button" className="library-header__action library-header__action--back" onClick={onBackToCreate}>
            {t('library.actions.backToCreate')}
          </button>
        </div>
      </header>

      <section className="library-toolbar" aria-live="polite">
        {loadState === 'loading' ? (
          <div className="library-toolbar__count library-toolbar__count--skeleton" aria-hidden="true" />
        ) : (
          <p className="library-toolbar__count">{t('library.meta.total', { count: items.length })}</p>
        )}
        <button
          type="button"
          className="library-toolbar__refresh"
          onClick={handleReload}
          disabled={loadState === 'loading'}
        >
          <RefreshCcw size={14} strokeWidth={2.35} />
          {t('library.actions.refresh')}
        </button>
      </section>

      {loadState === 'success' && deleteErrorMessage ? (
        <section className="library-state library-state--error" aria-live="polite">
          <p>{deleteErrorMessage}</p>
        </section>
      ) : null}

      {loadState === 'loading' ? (
        <section className="library-loading" aria-label={t('library.state.loading')}>
          <ul className="library-grid library-grid--skeleton" aria-hidden="true">
            {Array.from({ length: LIBRARY_SKELETON_CARD_COUNT }, (_, index) => (
              <LibraryCardSkeleton key={`library-skeleton-${index}`} />
            ))}
          </ul>
          <p className="sr-only" aria-live="polite">
            {t('library.state.loading')}
          </p>
        </section>
      ) : null}

      {loadState === 'error' ? (
        <section className="library-state library-state--error">
          <p>{errorMessage ?? t('library.state.error')}</p>
          <button type="button" className="library-state__retry" onClick={handleReload}>
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
              onOpenStorybookDetail={onOpenStorybookDetail}
              onDeleteStorybook={handleDeleteStorybook}
              isDeleting={deletingStorybookIds.has(item.storybookId)}
              deleteLabel={t('library.actions.delete')}
              deletingLabel={t('library.actions.deleting')}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )
}
