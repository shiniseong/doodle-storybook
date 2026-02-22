import { motion } from 'framer-motion'
import { Pause, Play, Volume2 } from 'lucide-react'
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import './StorybookReaderDialog.css'

const STORYBOOK_COVER_FLIP_DURATION_MS = 760
const STORYBOOK_PAGE_TURN_DURATION_MS = 540
const STORYBOOK_PAGE_TURN_DURATION_SECONDS = STORYBOOK_PAGE_TURN_DURATION_MS / 1000
const STORYBOOK_AUTO_NARRATION_WAIT_PADDING_MS = 48

let bodyScrollLockCount = 0
let bodyOverflowBeforeScrollLock: string | null = null

function acquireBodyScrollLock(): void {
  if (typeof document === 'undefined') {
    return
  }

  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeScrollLock = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  bodyScrollLockCount += 1
}

function releaseBodyScrollLock(): void {
  if (typeof document === 'undefined' || bodyScrollLockCount === 0) {
    return
  }

  bodyScrollLockCount -= 1
  if (bodyScrollLockCount > 0) {
    return
  }

  document.body.style.overflow = bodyOverflowBeforeScrollLock ?? ''
  bodyOverflowBeforeScrollLock = null
}

function useBodyScrollLock(): void {
  useEffect(() => {
    acquireBodyScrollLock()

    return () => {
      releaseBodyScrollLock()
    }
  }, [])
}

function waitForMilliseconds(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve()
    }, durationMs)
  })
}

function resolveIsSinglePageReaderMode(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }

  return window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches
}

export interface StorybookReaderBookPage {
  page: number
  content: string
  isHighlight: boolean
}

export interface StorybookReaderBookNarration {
  page: number
  audioDataUrl: string
}

export interface StorybookReaderBook {
  title: string
  authorName?: string | null
  pages: readonly StorybookReaderBookPage[]
  coverImage?: string | null
  highlightImage?: string | null
  finalImage?: string | null
  narrations?: readonly StorybookReaderBookNarration[]
}

interface StorybookReaderTextPage {
  kind: 'text'
  pageNumber: number
  content: string
  narrationAudioUrl?: string
}

interface StorybookReaderIllustrationPage {
  kind: 'illustration'
  pageNumber: number
  image: string
}

type StorybookReaderPage = StorybookReaderTextPage | StorybookReaderIllustrationPage

type StorybookPageTurnDirection = 'next' | 'previous'

interface StorybookPageTurnState {
  direction: StorybookPageTurnDirection
  targetSpreadStartIndex: number
  frontPage: StorybookReaderPage
  backPage: StorybookReaderPage
}

function resolveReaderPageImage(
  page: StorybookReaderBookPage,
  pageIndex: number,
  totalPages: number,
  highlightImage?: string,
  finalImage?: string,
): string | undefined {
  const isLastPage = pageIndex === totalPages - 1
  if (isLastPage && finalImage) {
    return finalImage
  }

  if (page.isHighlight && highlightImage) {
    return highlightImage
  }

  return undefined
}

function buildStorybookReaderPages(
  pages: readonly StorybookReaderBookPage[],
  narrationsByPage: ReadonlyMap<number, string>,
  highlightImage?: string,
  finalImage?: string,
): StorybookReaderPage[] {
  const totalPages = pages.length

  return pages.flatMap((page, pageIndex) => {
    const narrationAudioUrl = narrationsByPage.get(page.page)
    const textPage: StorybookReaderTextPage = {
      kind: 'text',
      pageNumber: page.page,
      content: page.content,
      ...(narrationAudioUrl ? { narrationAudioUrl } : {}),
    }
    const illustration = resolveReaderPageImage(page, pageIndex, totalPages, highlightImage, finalImage)

    if (!illustration) {
      return [textPage]
    }

    return [
      {
        kind: 'illustration',
        pageNumber: page.page,
        image: illustration,
      },
      textPage,
    ]
  })
}

function resolveNarratablePagesInView(
  pages: readonly StorybookReaderPage[],
  pageStartIndex: number,
  isSinglePageReaderMode: boolean,
): StorybookReaderTextPage[] {
  const visiblePages = isSinglePageReaderMode
    ? [pages[pageStartIndex]]
    : [pages[pageStartIndex], pages[pageStartIndex + 1]]

  return visiblePages.filter(
    (page): page is StorybookReaderTextPage => page?.kind === 'text' && typeof page.narrationAudioUrl === 'string',
  )
}

interface StorybookBookPageContentProps {
  page: StorybookReaderPage
  surfaceClassName?: string
  showNarrationControl?: boolean
  isNarrating?: boolean
  onToggleNarration?: (page: StorybookReaderTextPage) => void
}

function StorybookBookPageContent({
  page,
  surfaceClassName,
  showNarrationControl = true,
  isNarrating = false,
  onToggleNarration,
}: StorybookBookPageContentProps) {
  const { t } = useTranslation()
  const isIllustrationPage = page.kind === 'illustration'
  const hasNarration = page.kind === 'text' && typeof page.narrationAudioUrl === 'string'
  const modifierClasses = [
    isIllustrationPage ? 'storybook-book-page__surface--illustration-only' : 'storybook-book-page__surface--text-only',
    surfaceClassName,
  ]
    .filter((classNameValue): classNameValue is string => typeof classNameValue === 'string' && classNameValue.length > 0)
    .join(' ')
  const className = modifierClasses.length > 0 ? `storybook-book-page__surface ${modifierClasses}` : 'storybook-book-page__surface'

  return (
    <div className={className}>
      {isIllustrationPage ? (
        <figure className="storybook-book-page__figure">
          <img src={page.image} alt={`${page.pageNumber}페이지 삽화`} />
        </figure>
      ) : (
        <p className="storybook-book-page__text">{page.content}</p>
      )}
      {isIllustrationPage ? null : <p className="storybook-book-page__number">- {page.pageNumber} -</p>}
      {!isIllustrationPage && hasNarration && showNarrationControl && onToggleNarration ? (
        <button
          type="button"
          className={`storybook-book-page__narration-button${isNarrating ? ' storybook-book-page__narration-button--active' : ''}`}
          aria-label={isNarrating ? t('workspace.reader.stopNarration') : t('workspace.reader.playNarration')}
          title={isNarrating ? t('workspace.reader.stopNarration') : t('workspace.reader.playNarration')}
          onPointerDown={(event) => {
            event.stopPropagation()
          }}
          onClick={(event) => {
            event.stopPropagation()
            onToggleNarration(page)
          }}
        >
          {isNarrating ? <Pause size={16} strokeWidth={2.2} aria-hidden="true" /> : <Volume2 size={16} strokeWidth={2.2} aria-hidden="true" />}
        </button>
      ) : null}
    </div>
  )
}

interface StorybookBookPageProps {
  side: 'left' | 'right'
  page: StorybookReaderPage | null
  activeNarrationPageNumber: number | null
  onToggleNarration: (page: StorybookReaderTextPage) => void
}

function StorybookBookPage({
  side,
  page,
  activeNarrationPageNumber,
  onToggleNarration,
}: StorybookBookPageProps) {
  if (!page) {
    return (
      <article className={`storybook-book-page storybook-book-page--${side} storybook-book-page--blank`} aria-hidden="true">
        <div className="storybook-book-page__surface storybook-book-page__surface--blank" />
      </article>
    )
  }

  return (
    <article className={`storybook-book-page storybook-book-page--${side}`}>
      <StorybookBookPageContent
        page={page}
        isNarrating={page.kind === 'text' && page.pageNumber === activeNarrationPageNumber}
        onToggleNarration={onToggleNarration}
      />
    </article>
  )
}

interface StorybookReaderDialogProps {
  book: StorybookReaderBook
  onClose: () => void
}

export function StorybookReaderDialog({ book, onClose }: StorybookReaderDialogProps) {
  const { t } = useTranslation()
  const [isCoverOpened, setIsCoverOpened] = useState(false)
  const [isCoverFlipping, setIsCoverFlipping] = useState(false)
  const [isCoverReturning, setIsCoverReturning] = useState(false)
  const [isSinglePageReaderMode, setIsSinglePageReaderMode] = useState(resolveIsSinglePageReaderMode)
  const [activeSpreadStartIndex, setActiveSpreadStartIndex] = useState(0)
  const [pageTurnState, setPageTurnState] = useState<StorybookPageTurnState | null>(null)
  const [activeNarrationPageNumber, setActiveNarrationPageNumber] = useState<number | null>(null)
  const [isAutoNarrationActive, setIsAutoNarrationActive] = useState(false)
  const coverFlipTimeoutRef = useRef<number | null>(null)
  const coverReturnTimeoutRef = useRef<number | null>(null)
  const pageTurnTimeoutRef = useRef<number | null>(null)
  const activeSpreadStartIndexRef = useRef(0)
  const pageTurnStateRef = useRef<StorybookPageTurnState | null>(null)
  const isCoverOpenedRef = useRef(false)
  const narrationAudioRef = useRef<HTMLAudioElement | null>(null)
  const narrationPlaybackDoneRef = useRef<(() => void) | null>(null)
  const autoNarrationRunIdRef = useRef(0)
  const narrationsByPage = useMemo(() => {
    const nextNarrationsByPage = new Map<number, string>()

    book.narrations?.forEach((narration) => {
      nextNarrationsByPage.set(narration.page, narration.audioDataUrl)
    })

    return nextNarrationsByPage
  }, [book.narrations])
  const readerPages = useMemo(
    () => buildStorybookReaderPages(book.pages, narrationsByPage, book.highlightImage ?? undefined, book.finalImage ?? undefined),
    [book.finalImage, book.highlightImage, book.pages, narrationsByPage],
  )
  const narratablePageCount = useMemo(
    () =>
      readerPages.filter((page) => page.kind === 'text' && typeof page.narrationAudioUrl === 'string').length,
    [readerPages],
  )

  const totalPages = readerPages.length
  const pageAdvanceStep = isSinglePageReaderMode ? 1 : 2
  const renderedSpreadStartIndex = pageTurnState?.targetSpreadStartIndex ?? activeSpreadStartIndex
  const leftPage = totalPages > 0 ? (readerPages[renderedSpreadStartIndex] ?? null) : null
  const rightPage = isSinglePageReaderMode ? null : totalPages > 0 ? (readerPages[renderedSpreadStartIndex + 1] ?? null) : null
  const canGoPreviousSpread = isCoverOpened && activeSpreadStartIndex > 0
  const canGoNextSpread = isCoverOpened && activeSpreadStartIndex + pageAdvanceStep < totalPages
  const isLastSpread = isCoverOpened && totalPages > 0 && activeSpreadStartIndex + pageAdvanceStep >= totalPages

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQueryList = window.matchMedia('(max-width: 767px) and (orientation: portrait)')
    const updateMode = () => {
      const nextIsSinglePageReaderMode = mediaQueryList.matches

      setIsSinglePageReaderMode(nextIsSinglePageReaderMode)
      if (!nextIsSinglePageReaderMode || pageTurnStateRef.current === null) {
        return
      }

      if (pageTurnTimeoutRef.current !== null) {
        window.clearTimeout(pageTurnTimeoutRef.current)
        pageTurnTimeoutRef.current = null
      }

      setPageTurnState(null)
      pageTurnStateRef.current = null
    }

    updateMode()

    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', updateMode)
      return () => {
        mediaQueryList.removeEventListener('change', updateMode)
      }
    }

    if (typeof mediaQueryList.addListener === 'function') {
      mediaQueryList.addListener(updateMode)
      return () => {
        mediaQueryList.removeListener(updateMode)
      }
    }
  }, [])

  useEffect(() => {
    activeSpreadStartIndexRef.current = activeSpreadStartIndex
  }, [activeSpreadStartIndex])

  useEffect(() => {
    pageTurnStateRef.current = pageTurnState
  }, [pageTurnState])

  useEffect(() => {
    isCoverOpenedRef.current = isCoverOpened
  }, [isCoverOpened])

  const clearCoverFlipTimeout = useCallback(() => {
    if (coverFlipTimeoutRef.current === null) {
      return
    }

    window.clearTimeout(coverFlipTimeoutRef.current)
    coverFlipTimeoutRef.current = null
  }, [])

  const clearCoverReturnTimeout = useCallback(() => {
    if (coverReturnTimeoutRef.current === null) {
      return
    }

    window.clearTimeout(coverReturnTimeoutRef.current)
    coverReturnTimeoutRef.current = null
  }, [])

  const clearPageTurnTimeout = useCallback(() => {
    if (pageTurnTimeoutRef.current === null) {
      return
    }

    window.clearTimeout(pageTurnTimeoutRef.current)
    pageTurnTimeoutRef.current = null
  }, [])

  const stopNarrationPlayback = useCallback(() => {
    const activeAudio = narrationAudioRef.current
    narrationAudioRef.current = null

    if (activeAudio) {
      activeAudio.onended = null
      activeAudio.onerror = null
      activeAudio.pause()
      activeAudio.currentTime = 0
    }

    const finalizePlayback = narrationPlaybackDoneRef.current
    narrationPlaybackDoneRef.current = null

    if (finalizePlayback) {
      finalizePlayback()
      return
    }

    setActiveNarrationPageNumber(null)
  }, [])

  const stopAutoNarration = useCallback(
    (shouldStopPlayback: boolean = true) => {
      autoNarrationRunIdRef.current += 1
      setIsAutoNarrationActive(false)

      if (shouldStopPlayback) {
        stopNarrationPlayback()
      }
    },
    [stopNarrationPlayback],
  )

  const handleCloseDialog = useCallback(() => {
    stopAutoNarration()
    onClose()
  }, [onClose, stopAutoNarration])

  const playNarrationForPage = useCallback(
    (page: StorybookReaderTextPage): Promise<void> => {
      if (!page.narrationAudioUrl) {
        return Promise.resolve()
      }

      return new Promise((resolve) => {
        stopNarrationPlayback()

        const narrationAudio = new Audio(page.narrationAudioUrl)
        narrationAudio.preload = 'auto'
        narrationAudioRef.current = narrationAudio
        setActiveNarrationPageNumber(page.pageNumber)

        let isDone = false
        const finalizePlayback = () => {
          if (isDone) {
            return
          }

          isDone = true
          if (narrationPlaybackDoneRef.current === finalizePlayback) {
            narrationPlaybackDoneRef.current = null
          }
          if (narrationAudioRef.current === narrationAudio) {
            narrationAudioRef.current = null
          }

          narrationAudio.onended = null
          narrationAudio.onerror = null
          setActiveNarrationPageNumber((currentPageNumber) =>
            currentPageNumber === page.pageNumber ? null : currentPageNumber,
          )
          resolve()
        }

        narrationPlaybackDoneRef.current = finalizePlayback
        narrationAudio.onended = finalizePlayback
        narrationAudio.onerror = finalizePlayback

        void narrationAudio.play().catch(() => {
          finalizePlayback()
        })
      })
    },
    [stopNarrationPlayback],
  )

  const goNextSpreadForAutoNarration = useCallback(async (): Promise<boolean> => {
    if (!isCoverOpenedRef.current || pageTurnStateRef.current !== null) {
      return false
    }

    const currentSpreadStartIndex = activeSpreadStartIndexRef.current
    if (currentSpreadStartIndex + pageAdvanceStep >= totalPages) {
      return false
    }

    const nextSpreadStartIndex = Math.min(Math.max(0, totalPages - 1), currentSpreadStartIndex + pageAdvanceStep)

    if (isSinglePageReaderMode) {
      setActiveSpreadStartIndex(nextSpreadStartIndex)
      activeSpreadStartIndexRef.current = nextSpreadStartIndex
      return true
    }

    const currentRightPage = readerPages[currentSpreadStartIndex + 1]
    const nextLeftPage = readerPages[nextSpreadStartIndex]

    if (!currentRightPage || !nextLeftPage) {
      setActiveSpreadStartIndex(nextSpreadStartIndex)
      activeSpreadStartIndexRef.current = nextSpreadStartIndex
      return true
    }

    const nextPageTurnState: StorybookPageTurnState = {
      direction: 'next',
      targetSpreadStartIndex: nextSpreadStartIndex,
      frontPage: currentRightPage,
      backPage: nextLeftPage,
    }

    setPageTurnState(nextPageTurnState)
    pageTurnStateRef.current = nextPageTurnState
    clearPageTurnTimeout()

    await new Promise<void>((resolve) => {
      pageTurnTimeoutRef.current = window.setTimeout(() => {
        setActiveSpreadStartIndex(nextSpreadStartIndex)
        activeSpreadStartIndexRef.current = nextSpreadStartIndex
        setPageTurnState(null)
        pageTurnStateRef.current = null
        pageTurnTimeoutRef.current = null
        resolve()
      }, STORYBOOK_PAGE_TURN_DURATION_MS)
    })

    return true
  }, [clearPageTurnTimeout, isSinglePageReaderMode, pageAdvanceStep, readerPages, totalPages])

  const handleOpenCover = useCallback(() => {
    if (isCoverOpened || isCoverFlipping || pageTurnState !== null) {
      return
    }

    clearCoverReturnTimeout()
    setIsCoverReturning(false)
    clearCoverFlipTimeout()
    setIsCoverFlipping(true)
    coverFlipTimeoutRef.current = window.setTimeout(() => {
      setIsCoverOpened(true)
      isCoverOpenedRef.current = true
      setIsCoverFlipping(false)
      setActiveSpreadStartIndex(0)
      activeSpreadStartIndexRef.current = 0
      coverFlipTimeoutRef.current = null
    }, STORYBOOK_COVER_FLIP_DURATION_MS)
  }, [clearCoverFlipTimeout, clearCoverReturnTimeout, isCoverFlipping, isCoverOpened, pageTurnState])

  const closeBookToCover = useCallback(() => {
    if (!isCoverOpenedRef.current || pageTurnStateRef.current !== null) {
      return
    }

    stopAutoNarration()
    clearPageTurnTimeout()
    clearCoverFlipTimeout()
    clearCoverReturnTimeout()
    setPageTurnState(null)
    pageTurnStateRef.current = null
    setIsCoverFlipping(false)
    setActiveSpreadStartIndex(0)
    activeSpreadStartIndexRef.current = 0
    setIsCoverOpened(false)
    isCoverOpenedRef.current = false
    setIsCoverReturning(true)
    coverReturnTimeoutRef.current = window.setTimeout(() => {
      setIsCoverReturning(false)
      coverReturnTimeoutRef.current = null
    }, STORYBOOK_COVER_FLIP_DURATION_MS)
  }, [clearCoverFlipTimeout, clearCoverReturnTimeout, clearPageTurnTimeout, stopAutoNarration])

  const handleGoPreviousSpread = useCallback(() => {
    if (!isCoverOpened || pageTurnState !== null || !canGoPreviousSpread) {
      return
    }

    stopAutoNarration()
    const previousSpreadStartIndex = Math.max(0, activeSpreadStartIndex - pageAdvanceStep)

    if (isSinglePageReaderMode) {
      setActiveSpreadStartIndex(previousSpreadStartIndex)
      return
    }

    const currentLeftPage = readerPages[activeSpreadStartIndex]
    const previousRightPage = readerPages[previousSpreadStartIndex + 1]

    if (!currentLeftPage || !previousRightPage) {
      setActiveSpreadStartIndex(previousSpreadStartIndex)
      return
    }

    const nextPageTurnState: StorybookPageTurnState = {
      direction: 'previous',
      targetSpreadStartIndex: previousSpreadStartIndex,
      frontPage: currentLeftPage,
      backPage: previousRightPage,
    }

    setPageTurnState(nextPageTurnState)
    clearPageTurnTimeout()

    pageTurnTimeoutRef.current = window.setTimeout(() => {
      setActiveSpreadStartIndex(previousSpreadStartIndex)
      setPageTurnState(null)
      pageTurnTimeoutRef.current = null
    }, STORYBOOK_PAGE_TURN_DURATION_MS)
  }, [
    activeSpreadStartIndex,
    canGoPreviousSpread,
    clearPageTurnTimeout,
    isCoverOpened,
    isSinglePageReaderMode,
    pageAdvanceStep,
    pageTurnState,
    readerPages,
    stopAutoNarration,
  ])

  const handleGoNextSpread = useCallback(() => {
    if (!isCoverOpened || pageTurnState !== null || !canGoNextSpread) {
      return
    }

    stopAutoNarration()
    const nextSpreadStartIndex = Math.min(Math.max(0, totalPages - 1), activeSpreadStartIndex + pageAdvanceStep)

    if (isSinglePageReaderMode) {
      setActiveSpreadStartIndex(nextSpreadStartIndex)
      return
    }

    const currentRightPage = readerPages[activeSpreadStartIndex + 1]
    const nextLeftPage = readerPages[nextSpreadStartIndex]

    if (!currentRightPage || !nextLeftPage) {
      setActiveSpreadStartIndex(nextSpreadStartIndex)
      return
    }

    const nextPageTurnState: StorybookPageTurnState = {
      direction: 'next',
      targetSpreadStartIndex: nextSpreadStartIndex,
      frontPage: currentRightPage,
      backPage: nextLeftPage,
    }

    setPageTurnState(nextPageTurnState)
    clearPageTurnTimeout()

    pageTurnTimeoutRef.current = window.setTimeout(() => {
      setActiveSpreadStartIndex(nextSpreadStartIndex)
      setPageTurnState(null)
      pageTurnTimeoutRef.current = null
    }, STORYBOOK_PAGE_TURN_DURATION_MS)
  }, [
    activeSpreadStartIndex,
    canGoNextSpread,
    clearPageTurnTimeout,
    isCoverOpened,
    isSinglePageReaderMode,
    pageAdvanceStep,
    pageTurnState,
    readerPages,
    stopAutoNarration,
    totalPages,
  ])

  const handleGoToCoverFromLastSpread = useCallback(() => {
    closeBookToCover()
  }, [closeBookToCover])

  const handleLeftTurnZoneClick = useCallback(() => {
    if (!isCoverOpened || pageTurnState !== null) {
      return
    }

    if (canGoPreviousSpread) {
      handleGoPreviousSpread()
      return
    }

    closeBookToCover()
  }, [canGoPreviousSpread, closeBookToCover, handleGoPreviousSpread, isCoverOpened, pageTurnState])

  const handleTogglePageNarration = useCallback(
    (page: StorybookReaderTextPage) => {
      if (!page.narrationAudioUrl) {
        return
      }

      if (activeNarrationPageNumber === page.pageNumber) {
        stopNarrationPlayback()
        return
      }

      stopAutoNarration(false)
      void playNarrationForPage(page)
    },
    [activeNarrationPageNumber, playNarrationForPage, stopAutoNarration, stopNarrationPlayback],
  )

  const handleToggleAutoNarration = useCallback(() => {
    if (isAutoNarrationActive) {
      stopAutoNarration()
      return
    }

    setIsAutoNarrationActive(true)
  }, [isAutoNarrationActive, stopAutoNarration])

  useEffect(() => {
    if (!isAutoNarrationActive) {
      return
    }

    const runId = autoNarrationRunIdRef.current + 1
    autoNarrationRunIdRef.current = runId

    const runAutoNarration = async () => {
      if (!isCoverOpenedRef.current) {
        handleOpenCover()
        await waitForMilliseconds(STORYBOOK_COVER_FLIP_DURATION_MS + STORYBOOK_AUTO_NARRATION_WAIT_PADDING_MS)
      }

      while (autoNarrationRunIdRef.current === runId) {
        const narratablePages = resolveNarratablePagesInView(
          readerPages,
          activeSpreadStartIndexRef.current,
          isSinglePageReaderMode,
        )

        if (narratablePages.length === 0) {
          const didAdvance = await goNextSpreadForAutoNarration()
          if (!didAdvance) {
            stopAutoNarration(false)
            break
          }

          await waitForMilliseconds(STORYBOOK_AUTO_NARRATION_WAIT_PADDING_MS)
          continue
        }

        for (const page of narratablePages) {
          if (autoNarrationRunIdRef.current !== runId) {
            return
          }

          await playNarrationForPage(page)
        }

        if (autoNarrationRunIdRef.current !== runId) {
          return
        }

        const didAdvance = await goNextSpreadForAutoNarration()
        if (!didAdvance) {
          stopAutoNarration(false)
          break
        }

        await waitForMilliseconds(STORYBOOK_AUTO_NARRATION_WAIT_PADDING_MS)
      }
    }

    void runAutoNarration()

    return () => {
      autoNarrationRunIdRef.current += 1
    }
  }, [
    goNextSpreadForAutoNarration,
    handleOpenCover,
    isAutoNarrationActive,
    isSinglePageReaderMode,
    playNarrationForPage,
    readerPages,
    stopAutoNarration,
  ])

  useEffect(() => {
    return () => {
      stopAutoNarration()
      clearCoverFlipTimeout()
      clearCoverReturnTimeout()
      clearPageTurnTimeout()
    }
  }, [clearCoverFlipTimeout, clearCoverReturnTimeout, clearPageTurnTimeout, stopAutoNarration])

  useBodyScrollLock()

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleCloseDialog()
        return
      }

      if (!isCoverOpened || totalPages === 0) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handleLeftTurnZoneClick()
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleGoNextSpread()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [handleCloseDialog, handleGoNextSpread, handleLeftTurnZoneClick, isCoverOpened, totalPages])

  const openBookInlineStyle = {
    '--storybook-page-turn-duration': `${STORYBOOK_PAGE_TURN_DURATION_SECONDS}s`,
  } as CSSProperties

  return (
    <motion.div
      className="storybook-reader-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={`생성된 동화책: ${book.title}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
    >
      <button
        type="button"
        className="storybook-reader-dialog__backdrop"
        aria-label="이북 닫기"
        onClick={handleCloseDialog}
      />
      <div className="storybook-reader-dialog__sheet">
        <header className="storybook-reader-dialog__header">
          <h2>{book.title}</h2>
          <div className="storybook-reader-dialog__actions">
            <button
              type="button"
              className={`storybook-reader-dialog__auto-narration${
                isAutoNarrationActive ? ' storybook-reader-dialog__auto-narration--active' : ''
              }`}
              aria-label={isAutoNarrationActive ? t('workspace.reader.stopAutoNarration') : t('workspace.reader.startAutoNarration')}
              onClick={handleToggleAutoNarration}
              disabled={narratablePageCount === 0 || totalPages === 0}
            >
              {isAutoNarrationActive ? <Pause size={14} strokeWidth={2.3} aria-hidden="true" /> : <Play size={14} strokeWidth={2.3} aria-hidden="true" />}
              {isAutoNarrationActive ? t('workspace.reader.stopAutoNarration') : t('workspace.reader.startAutoNarration')}
            </button>
            <button type="button" className="storybook-reader-dialog__close" aria-label="이북 닫기" onClick={handleCloseDialog}>
              ×
            </button>
          </div>
        </header>
        <div className="storybook-reader-dialog__stage">
          {!isCoverOpened ? (
            <button
              type="button"
              className={`storybook-cover${isCoverFlipping ? ' storybook-cover--flipping' : ''}${
                isCoverReturning ? ' storybook-cover--returning' : ''
              }`}
              onClick={handleOpenCover}
              aria-label={isCoverFlipping ? '표지 넘김 중' : '표지 넘기기'}
              disabled={isCoverFlipping}
            >
              <span className="storybook-cover__art">
                {book.coverImage ? (
                  <img src={book.coverImage} alt={`${book.title} 표지`} />
                ) : (
                  <span className="storybook-cover__fallback" aria-hidden="true" />
                )}
              </span>
              <span className="storybook-cover__title-overlay">
                <span className="storybook-cover__title-card">
                  <strong>{book.title}</strong>
                  {book.authorName ? <em className="storybook-cover__author">{t('workspace.reader.byAuthor', { author: book.authorName })}</em> : null}
                </span>
                <small>{isCoverFlipping ? '책장을 넘기는 중...' : '표지를 눌러 첫 장을 펼치세요'}</small>
              </span>
            </button>
          ) : leftPage ? (
            <motion.div
              key={`spread-${renderedSpreadStartIndex}-${isSinglePageReaderMode ? 'single' : 'spread'}`}
              className={`storybook-openbook${isSinglePageReaderMode ? ' storybook-openbook--single' : ''}`}
              style={openBookInlineStyle}
              initial={{ opacity: 0.84, scale: 0.995 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: 0.22,
                ease: [0.22, 0.74, 0.2, 1],
              }}
            >
              {isSinglePageReaderMode ? null : <span className="storybook-openbook__spine" aria-hidden="true" />}
              <StorybookBookPage
                side="left"
                page={leftPage}
                activeNarrationPageNumber={activeNarrationPageNumber}
                onToggleNarration={handleTogglePageNarration}
              />
              {isSinglePageReaderMode ? null : (
                <StorybookBookPage
                  side="right"
                  page={rightPage}
                  activeNarrationPageNumber={activeNarrationPageNumber}
                  onToggleNarration={handleTogglePageNarration}
                />
              )}
              {!isSinglePageReaderMode && pageTurnState ? (
                <span
                  className={`storybook-openbook__flip-sheet storybook-openbook__flip-sheet--${pageTurnState.direction}`}
                  aria-hidden="true"
                >
                  <span className="storybook-openbook__flip-face storybook-openbook__flip-face--front">
                    <StorybookBookPageContent
                      page={pageTurnState.frontPage}
                      surfaceClassName="storybook-book-page__surface--flip"
                      showNarrationControl={false}
                    />
                  </span>
                  <span className="storybook-openbook__flip-face storybook-openbook__flip-face--back">
                    <StorybookBookPageContent
                      page={pageTurnState.backPage}
                      surfaceClassName="storybook-book-page__surface--flip"
                      showNarrationControl={false}
                    />
                  </span>
                </span>
              ) : null}
              <button
                type="button"
                className="storybook-openbook__turn-zone storybook-openbook__turn-zone--left"
                aria-label={canGoPreviousSpread ? '이전 장으로 넘기기' : '표지로 돌아가기'}
                disabled={!isCoverOpened || totalPages === 0 || pageTurnState !== null}
                onClick={handleLeftTurnZoneClick}
              />
              <button
                type="button"
                className="storybook-openbook__turn-zone storybook-openbook__turn-zone--right"
                aria-label="다음 장으로 넘기기"
                disabled={!canGoNextSpread || pageTurnState !== null}
                onClick={handleGoNextSpread}
              />
              {isLastSpread && pageTurnState === null ? (
                <button
                  type="button"
                  className="storybook-openbook__back-to-cover"
                  aria-label={t('workspace.reader.backToCover')}
                  onClick={handleGoToCoverFromLastSpread}
                >
                  {t('workspace.reader.backToCover')}
                </button>
              ) : null}
            </motion.div>
          ) : (
            <div className="storybook-reader-page__empty">
              <p>표시할 페이지가 아직 없어요.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
