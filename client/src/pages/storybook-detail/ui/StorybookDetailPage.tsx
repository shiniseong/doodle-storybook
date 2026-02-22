import { AnimatePresence } from 'framer-motion'
import { BookImage, RefreshCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { StorybookDetailResponse } from '@entities/storybook/model/storybook-detail'
import { type DeleteStorybookUseCasePort } from '@features/storybook-deletion/application/delete-storybook.use-case'
import {
  type GetStorybookDetailUseCasePort,
} from '@features/storybook-detail/application/get-storybook-detail.use-case'
import { ConfirmDialog } from '@shared/ui/confirm-dialog/ConfirmDialog'
import { LanguageSwitcher } from '@shared/ui/language-switcher/LanguageSwitcher'
import { StorybookReaderDialog, type StorybookReaderBook } from '@widgets/storybook-reader/ui/StorybookReaderDialog'

import './StorybookDetailPage.css'

type StorybookDetailLoadState = 'loading' | 'success' | 'error'

interface StorybookDetailPageDependencies {
  getStorybookDetailUseCase: GetStorybookDetailUseCasePort
  deleteStorybookUseCase: DeleteStorybookUseCasePort
}

interface StorybookDetailPageProps {
  dependencies: StorybookDetailPageDependencies
  userId: string
  storybookId: string
  onBack?: () => void
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
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function StorybookDetailPage({ dependencies, userId, storybookId, onBack }: StorybookDetailPageProps) {
  const { i18n, t } = useTranslation()
  const [detail, setDetail] = useState<StorybookDetailResponse | null>(null)
  const [reloadVersion, setReloadVersion] = useState(0)
  const [resolvedRequestKey, setResolvedRequestKey] = useState<string | null>(null)
  const [failedRequest, setFailedRequest] = useState<{ requestKey: string; message: string } | null>(null)
  const [readerRequestKey, setReaderRequestKey] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null)

  const getStorybookDetailUseCase = useMemo(() => dependencies.getStorybookDetailUseCase, [dependencies])
  const deleteStorybookUseCase = useMemo(() => dependencies.deleteStorybookUseCase, [dependencies])
  const requestKey = useMemo(() => `${userId}:${storybookId}:${reloadVersion}`, [reloadVersion, storybookId, userId])

  useEffect(() => {
    let isDisposed = false

    void getStorybookDetailUseCase.execute({
      userId,
      storybookId,
    }).then((result) => {
      if (isDisposed) {
        return
      }

      if (!result.ok) {
        setFailedRequest({
          requestKey,
          message: result.error.message,
        })
        return
      }

      setDetail(result.value)
      setResolvedRequestKey(requestKey)
      setFailedRequest(null)
    }).catch((error: unknown) => {
      if (isDisposed) {
        return
      }

      setFailedRequest({
        requestKey,
        message: error instanceof Error ? error.message : 'Failed to fetch storybook detail.',
      })
    })

    return () => {
      isDisposed = true
    }
  }, [getStorybookDetailUseCase, requestKey, storybookId, userId])

  const loadState = useMemo<StorybookDetailLoadState>(() => {
    if (resolvedRequestKey === requestKey) {
      return 'success'
    }

    if (failedRequest?.requestKey === requestKey) {
      return 'error'
    }

    return 'loading'
  }, [failedRequest?.requestKey, requestKey, resolvedRequestKey])

  const activeDetail = resolvedRequestKey === requestKey ? detail : null
  const errorMessage = failedRequest?.requestKey === requestKey ? failedRequest.message : null
  const isReaderOpen = readerRequestKey === requestKey

  const readerBook = useMemo<StorybookReaderBook | null>(() => {
    if (!activeDetail) {
      return null
    }

    if (activeDetail.ebook.pages.length === 0) {
      return null
    }

    return {
      title: activeDetail.ebook.title,
      ...(activeDetail.ebook.authorName ? { authorName: activeDetail.ebook.authorName } : {}),
      pages: activeDetail.ebook.pages,
      ...(activeDetail.ebook.coverImageUrl ? { coverImage: activeDetail.ebook.coverImageUrl } : {}),
      ...(activeDetail.ebook.highlightImageUrl ? { highlightImage: activeDetail.ebook.highlightImageUrl } : {}),
      ...(activeDetail.ebook.finalImageUrl ? { finalImage: activeDetail.ebook.finalImageUrl } : {}),
      ...(activeDetail.ebook.narrations.length > 0 ? { narrations: activeDetail.ebook.narrations } : {}),
    }
  }, [activeDetail])

  const createdAt = useMemo(
    () => formatCreatedAt(activeDetail?.storybook.createdAt ?? null, i18n.language),
    [activeDetail?.storybook.createdAt, i18n.language],
  )

  const handleReload = () => {
    setReaderRequestKey(null)
    setDeleteErrorMessage(null)
    setIsDeleteDialogOpen(false)
    setReloadVersion((previous) => previous + 1)
  }

  const handleDeleteDialogClose = () => {
    if (isDeleting) {
      return
    }

    setIsDeleteDialogOpen(false)
  }

  const handleDeleteDialogOpen = () => {
    if (isDeleting || loadState !== 'success') {
      return
    }

    setDeleteErrorMessage(null)
    setIsDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (isDeleting || loadState !== 'success') {
      return
    }

    setDeleteErrorMessage(null)
    setReaderRequestKey(null)
    setIsDeleting(true)

    const result = await deleteStorybookUseCase.execute({
      userId,
      storybookId,
    })

    if (!result.ok) {
      setDeleteErrorMessage(result.error.message)
      setIsDeleting(false)
      setIsDeleteDialogOpen(false)
      return
    }

    setIsDeleting(false)
    setIsDeleteDialogOpen(false)

    if (onBack) {
      onBack()
      return
    }
  }

  return (
    <div className="storybook-detail-page">
      <header className="storybook-detail-header">
        <div className="storybook-detail-header__main">
          <p>{t('storybookDetail.eyebrow')}</p>
          <h1>{activeDetail?.storybook.title ?? t('storybookDetail.title')}</h1>
          <span>{t('storybookDetail.description')}</span>
        </div>
        <div className="storybook-detail-header__actions">
          <LanguageSwitcher />
          <button type="button" className="storybook-detail-header__action" onClick={onBack}>
            {t('storybookDetail.actions.back')}
          </button>
          <button
            type="button"
            className="storybook-detail-header__action storybook-detail-header__action--danger storybook-detail-header__action--icon-only"
            aria-label={isDeleting ? t('storybookDetail.actions.deleting') : t('storybookDetail.actions.delete')}
            onClick={handleDeleteDialogOpen}
            disabled={loadState !== 'success' || isDeleting || isDeleteDialogOpen}
          >
            <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </header>

      {deleteErrorMessage ? (
        <section className="storybook-detail-state storybook-detail-state--error" aria-live="polite">
          <p>{deleteErrorMessage}</p>
        </section>
      ) : null}

      {loadState === 'loading' ? (
        <section className="storybook-detail-state" aria-live="polite">
          <p>{t('storybookDetail.state.loading')}</p>
        </section>
      ) : null}

      {loadState === 'error' ? (
        <section className="storybook-detail-state storybook-detail-state--error" aria-live="polite">
          <p>{errorMessage ?? t('storybookDetail.state.error')}</p>
          <button type="button" className="storybook-detail-state__retry" onClick={handleReload}>
            <RefreshCcw size={14} strokeWidth={2.35} />
            {t('storybookDetail.actions.retry')}
          </button>
        </section>
      ) : null}

      {loadState === 'success' && activeDetail ? (
        <main className="storybook-detail-layout">
          <section className="storybook-detail-panel storybook-detail-panel--drawing" aria-labelledby="storybook-detail-drawing-title">
            <header>
              <h2 id="storybook-detail-drawing-title">{t('storybookDetail.panels.drawing.title')}</h2>
              <p>{t('storybookDetail.panels.drawing.description')}</p>
            </header>
            <div className="storybook-detail-drawing-block">
              {activeDetail.storybook.originImageUrl ? (
                <img src={activeDetail.storybook.originImageUrl} alt={activeDetail.storybook.title} loading="lazy" />
              ) : (
                <div className="storybook-detail-drawing-block__empty">
                  <BookImage size={32} strokeWidth={2.1} />
                  <span>{t('storybookDetail.state.noImage')}</span>
                </div>
              )}
            </div>
          </section>

          <section className="storybook-detail-panel storybook-detail-panel--director" aria-labelledby="storybook-detail-director-title">
            <header>
              <h2 id="storybook-detail-director-title">{t('storybookDetail.panels.director.title')}</h2>
              <p>{t('storybookDetail.panels.director.description')}</p>
            </header>
            <dl className="storybook-detail-director-grid">
              <div>
                <dt>{t('storybookDetail.meta.title')}</dt>
                <dd>{activeDetail.storybook.title}</dd>
              </div>
              <div>
                <dt>{t('storybookDetail.meta.author')}</dt>
                <dd>{activeDetail.storybook.authorName ?? t('library.card.unknownAuthor')}</dd>
              </div>
              <div>
                <dt>{t('storybookDetail.meta.description')}</dt>
                <dd>{activeDetail.storybook.description.length > 0 ? activeDetail.storybook.description : t('storybookDetail.state.noDescription')}</dd>
              </div>
              <div>
                <dt>{t('storybookDetail.meta.createdAt')}</dt>
                <dd>{createdAt ?? '-'}</dd>
              </div>
            </dl>
            <button
              type="button"
              className="storybook-detail-open-reader"
              onClick={() => {
                setReaderRequestKey(requestKey)
              }}
              disabled={!readerBook}
            >
              {t('storybookDetail.actions.openEbook')}
            </button>
          </section>
        </main>
      ) : null}

      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title={activeDetail?.storybook.title ?? t('storybookDetail.actions.delete')}
        description={t('storybookDetail.actions.deleteConfirm')}
        confirmLabel={isDeleting ? t('storybookDetail.actions.deleting') : t('storybookDetail.actions.delete')}
        cancelLabel={t('common.actions.cancel')}
        closeLabel={t('common.actions.close')}
        isConfirming={isDeleting}
        tone="danger"
        onConfirm={() => {
          void handleDelete()
        }}
        onCancel={handleDeleteDialogClose}
      />

      <AnimatePresence>
        {isReaderOpen && readerBook ? (
          <StorybookReaderDialog
            book={readerBook}
            onClose={() => {
              setReaderRequestKey(null)
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}
