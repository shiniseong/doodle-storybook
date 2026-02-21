import { AnimatePresence, motion } from 'framer-motion'
import {
  AudioLines,
  BookOpenText,
  BrushCleaning,
  Eraser,
  Grid3x3,
  ImageUp,
  Palette,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  RotateCw,
  Sparkles,
  Volume2,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import {
  useCallback,
  type ChangeEvent,
  useEffect,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useTranslation } from 'react-i18next'

import { type StoryLanguage } from '@entities/storybook/model/storybook'
import type {
  CreateStorybookUseCasePort,
  StorybookGeneratedNarration,
  StorybookGeneratedPage,
} from '@features/storybook-creation/application/create-storybook.use-case'
import {
  selectRemainingFreeStories,
  useStorybookCreationStore,
} from '@features/storybook-creation/model/storybook-creation.store'
import {
  EMPTY_STORYBOOK_WORKSPACE_DRAFT,
  clearStorybookWorkspaceDraft,
  loadStorybookWorkspaceDraft,
  saveStorybookWorkspaceDraft,
  type StorybookWorkspaceDraft,
} from '@features/storybook-creation/model/storybook-compose-draft.storage'
import { StorybookDescriptionForm } from '@features/storybook-creation/ui/StorybookDescriptionForm'
import { resolveAppLanguage } from '@shared/config/i18n/constants'
import { LanguageSwitcher } from '@shared/ui/language-switcher/LanguageSwitcher'

import './StorybookWorkspace.css'

const drawingTools: ReadonlyArray<{ key: string; icon: LucideIcon }> = [
  { key: 'brushSize', icon: PenLine },
  { key: 'brushColor', icon: Palette },
  { key: 'opacity', icon: Sparkles },
  { key: 'eraser', icon: Eraser },
  { key: 'undo', icon: RotateCcw },
  { key: 'redo', icon: RotateCw },
]

const flowSteps: ReadonlyArray<{ key: string; icon: LucideIcon }> = [
  { key: 'stepOne', icon: PenLine },
  { key: 'stepTwo', icon: WandSparkles },
  { key: 'stepThree', icon: AudioLines },
  { key: 'stepFour', icon: BookOpenText },
]

const MAX_CANVAS_UNDO_STEPS = 30
const DEFAULT_PEN_COLOR = '#184867'
const MIN_PEN_WIDTH = 1
const MAX_PEN_WIDTH = 20
const DEFAULT_PEN_WIDTH = 3
const MIN_PEN_OPACITY = 5
const MAX_PEN_OPACITY = 100
const DEFAULT_PEN_OPACITY = 100
const MIN_ERASER_SIZE = 4
const MAX_ERASER_SIZE = 64
const DEFAULT_ERASER_SIZE = 20
const ERASER_STROKE_COLOR = '#111111'
const PEN_COLOR_OPTIONS = [
  '#184867',
  '#1d4ed8',
  '#0f766e',
  '#15803d',
  '#f97316',
  '#facc15',
  '#ffffff',
  '#f2c6a0',
  '#ec4899',
  '#84cc16',
  '#38bdf8',
  '#9ca3af',
  '#ca8a04',
  '#dc2626',
  '#9333ea',
  '#111827',
] as const
const LOADING_GAME_LANE_COUNT = 4
const LOADING_GAME_TICK_MS = 34
const LOADING_GAME_BASE_SPEED = 230
const LOADING_GAME_MAX_SPEED = 1200
const LOADING_GAME_ACCELERATION_PER_SECOND = 30
const LOADING_GAME_BASE_SPAWN_INTERVAL = 1.3
const LOADING_GAME_MIN_SPAWN_INTERVAL = 0.48
const LOADING_GAME_CAR_X_RATIO = 0.22
const LOADING_GAME_CAR_WIDTH = 30
const LOADING_GAME_CAR_HEIGHT = 20
const LOADING_GAME_CAR_COLLISION_WIDTH = 30
const LOADING_GAME_OBSTACLE_SIZE = 30
const LOADING_GAME_MAX_LIVES = 2
const LOADING_GAME_INITIAL_LANE = 1
const LOADING_GAME_BACKGROUND_LOOP_WIDTH = 2400
const LOADING_GAME_INITIAL_TRACK_WIDTH = 640
const LOADING_GAME_INITIAL_TRACK_HEIGHT = 208
const STORYBOOK_COVER_FLIP_DURATION_MS = 760
const STORYBOOK_PAGE_TURN_DURATION_MS = 540
const STORYBOOK_PAGE_TURN_DURATION_SECONDS = STORYBOOK_PAGE_TURN_DURATION_MS / 1000
const STORYBOOK_AUTO_NARRATION_WAIT_PADDING_MS = 48
const LOADING_GAME_OBSTACLES = [
  { key: 'banana', icon: '🍌' },
  { key: 'can', icon: '🥫' },
  { key: 'poop', icon: '💩' },
  { key: 'bug', icon: '🐞' },
] as const

type LoadingGameObstacleType = (typeof LOADING_GAME_OBSTACLES)[number]['key']

const LOADING_GAME_OBSTACLE_ICONS: Record<LoadingGameObstacleType, string> = {
  banana: '🍌',
  can: '🥫',
  poop: '💩',
  bug: '🐞',
}

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

interface CanvasPoint {
  x: number
  y: number
}

interface EraserPreviewState {
  x: number
  y: number
  visible: boolean
}

type DrawingToolMode = 'pen' | 'eraser'

interface CanvasDrawingStyleOptions {
  drawingMode: DrawingToolMode
  penWidth: number
  penColor: string
  penOpacity: number
  eraserSize: number
}

interface LoadingGameTrackMetrics {
  width: number
  height: number
}

interface LoadingGameObstacle {
  id: number
  lane: number
  x: number
  type: LoadingGameObstacleType
  counted: boolean
}

interface StorybookReaderBook {
  title: string
  authorName?: string
  pages: StorybookGeneratedPage[]
  coverImage?: string
  highlightImage?: string
  finalImage?: string
  narrations?: StorybookGeneratedNarration[]
}

export interface StorybookWorkspaceAuth {
  readonly isConfigured: boolean
  readonly isLoading: boolean
  readonly isSigningIn: boolean
  readonly userId: string | null
  readonly userEmail: string | null
  readonly signOut: () => Promise<void>
}

function resolveCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): CanvasPoint {
  const bounds = canvas.getBoundingClientRect()
  const scaleX = bounds.width === 0 ? 1 : canvas.width / bounds.width
  const scaleY = bounds.height === 0 ? 1 : canvas.height / bounds.height

  return {
    x: (clientX - bounds.left) * scaleX,
    y: (clientY - bounds.top) * scaleY,
  }
}

function clampRangeValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
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

function clampPenWidth(width: number): number {
  return clampRangeValue(width, MIN_PEN_WIDTH, MAX_PEN_WIDTH)
}

function clampPenOpacity(opacity: number): number {
  return clampRangeValue(opacity, MIN_PEN_OPACITY, MAX_PEN_OPACITY)
}

function clampEraserSize(size: number): number {
  return clampRangeValue(size, MIN_ERASER_SIZE, MAX_ERASER_SIZE)
}

function resolveCanvasOpacity(opacity: number): number {
  return clampPenOpacity(opacity) / 100
}

function resolveLoadingGameScoreMultiplier(speed: number): number {
  const normalizedSpeed = Math.max(0, speed - LOADING_GAME_BASE_SPEED)
  return 1 + Math.floor(normalizedSpeed / 65)
}

function resolveLoadingGameSpawnInterval(speed: number): number {
  const speedRatio = clampRangeValue(
    (speed - LOADING_GAME_BASE_SPEED) / (LOADING_GAME_MAX_SPEED - LOADING_GAME_BASE_SPEED),
    0,
    1,
  )
  const randomOffset = Math.random() * 0.24
  const interval = LOADING_GAME_BASE_SPAWN_INTERVAL - speedRatio * 0.64 + randomOffset

  return Math.max(LOADING_GAME_MIN_SPAWN_INTERVAL, interval)
}

function resolveRandomLoadingGameObstacleType(): LoadingGameObstacleType {
  const randomIndex = Math.floor(Math.random() * LOADING_GAME_OBSTACLES.length)
  return LOADING_GAME_OBSTACLES[randomIndex].key
}

function applyCanvasDrawingStyle(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  { drawingMode, penWidth, penColor, penOpacity, eraserSize }: CanvasDrawingStyleOptions,
): void {
  const bounds = canvas.getBoundingClientRect()
  const scale = bounds.width === 0 ? 1 : canvas.width / bounds.width

  if (drawingMode === 'eraser') {
    context.globalCompositeOperation = 'destination-out'
    context.globalAlpha = 1
    context.lineWidth = clampEraserSize(eraserSize) * scale
    context.strokeStyle = ERASER_STROKE_COLOR
    context.fillStyle = ERASER_STROKE_COLOR
    return
  }

  context.globalCompositeOperation = 'source-over'
  context.globalAlpha = resolveCanvasOpacity(penOpacity)
  context.lineWidth = clampPenWidth(penWidth) * scale
  context.strokeStyle = penColor
  context.fillStyle = penColor
}

function configureCanvasContext(canvas: HTMLCanvasElement, styleOptions: CanvasDrawingStyleOptions): CanvasRenderingContext2D | null {
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  context.lineCap = 'round'
  context.lineJoin = 'round'
  applyCanvasDrawingStyle(context, canvas, styleOptions)

  return context
}

interface RangeControlPanelProps {
  id: string
  panelClassName?: string
  ariaLabel: string
  sliderId: string
  sliderAriaLabel: string
  value: number
  min: number
  max: number
  decreaseAriaLabel: string
  increaseAriaLabel: string
  onDecrease: () => void
  onIncrease: () => void
  onChange: (nextValue: number) => void
  decreaseIconClassName: string
  increaseIconClassName: string
  valueClassName?: string
  formatValue?: (value: number) => string
}

function RangeControlPanel({
  id,
  panelClassName,
  ariaLabel,
  sliderId,
  sliderAriaLabel,
  value,
  min,
  max,
  decreaseAriaLabel,
  increaseAriaLabel,
  onDecrease,
  onIncrease,
  onChange,
  decreaseIconClassName,
  increaseIconClassName,
  valueClassName,
  formatValue,
}: RangeControlPanelProps) {
  const formattedValue = formatValue ? formatValue(value) : `${value}`
  const panelClasses = panelClassName ? `range-control-panel ${panelClassName}` : 'range-control-panel'
  const valueClasses = valueClassName ? `range-control-panel__value ${valueClassName}` : 'range-control-panel__value'

  return (
    <div className={panelClasses} id={id} role="group" aria-label={ariaLabel}>
      <button
        type="button"
        className="range-control-panel__step-button"
        aria-label={decreaseAriaLabel}
        onClick={onDecrease}
      >
        <span className={`range-control-panel__dot-icon ${decreaseIconClassName}`} aria-hidden="true" />
      </button>
      <input
        id={sliderId}
        className="range-control-panel__slider"
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-label={sliderAriaLabel}
        onChange={(event) => {
          onChange(Number.parseInt(event.target.value, 10))
        }}
      />
      <button
        type="button"
        className="range-control-panel__step-button"
        aria-label={increaseAriaLabel}
        onClick={onIncrease}
      >
        <span className={`range-control-panel__dot-icon ${increaseIconClassName}`} aria-hidden="true" />
      </button>
      <output className={valueClasses} htmlFor={sliderId}>
        {formattedValue}
      </output>
    </div>
  )
}

function AmbientBackdrop() {
  return <div className="ambient-layer" aria-hidden="true" />
}

interface WorkspaceHeaderProps {
  auth?: StorybookWorkspaceAuth
  onRequestAuthentication?: () => void
  onRequestWorkspaceReset?: () => void
}

function WorkspaceHeader({ auth, onRequestAuthentication, onRequestWorkspaceReset }: WorkspaceHeaderProps) {
  const { t } = useTranslation()
  const remainingFreeStories = useStorybookCreationStore(selectRemainingFreeStories)
  const isLoginButtonDisabled = !auth || !onRequestAuthentication

  return (
    <header className="workspace-header">
      <div className="brand-block">
        <p className="brand-block__eyebrow">
          <Sparkles size={14} strokeWidth={2.2} aria-hidden="true" />
          {t('workspace.eyebrow')}
        </p>
        <div className="brand-block__main">
          <img className="brand-block__mascot" src="/assets/drawing-fairy-detail-logo.png" alt="" aria-hidden="true" />
          <div className="brand-block__copy">
            <h1 className="brand-block__title">{t('common.appName')}</h1>
            <p className="brand-block__subtitle">{t('common.appSubtitle')}</p>
          </div>
        </div>
      </div>
      <div className="workspace-header__side">
        <div className="workspace-header__toolbar">
          <LanguageSwitcher />
          {!auth ? null : (
            <div className="workspace-auth" aria-live="polite">
              {auth.userId ? (
                <>
                  {auth.userEmail ? (
                    <p className="workspace-auth__identity">
                      {t('workspace.auth.signedInAs', { email: auth.userEmail })}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="workspace-auth__action"
                    onClick={() => {
                      onRequestWorkspaceReset?.()
                      void auth.signOut()
                    }}
                  >
                    {t('workspace.auth.signOut')}
                  </button>
                </>
              ) : (
                <>
                  {!auth.isConfigured ? (
                    <p className="workspace-auth__notice">{t('workspace.auth.notConfigured')}</p>
                  ) : null}
                  <button
                    type="button"
                    className="workspace-auth__action"
                    disabled={isLoginButtonDisabled}
                    onClick={() => {
                      onRequestAuthentication?.()
                    }}
                  >
                    {t('workspace.auth.signIn')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <ul className="status-list" aria-label={t('workspace.status.aria')}>
          <li className="status-item">
            <span className="status-item__label">{t('workspace.status.freeLabel')}</span>
            <strong className="status-item__value">
              {t('workspace.status.freeValue', { count: remainingFreeStories })}
            </strong>
          </li>
          <li className="status-item">
            <span className="status-item__label">{t('workspace.status.trialLabel')}</span>
            <strong className="status-item__value">{t('workspace.status.trialValue')}</strong>
          </li>
          <li className="status-item">
            <span className="status-item__label">{t('workspace.status.planLabel')}</span>
            <strong className="status-item__value">{t('workspace.status.planValue')}</strong>
          </li>
        </ul>
      </div>
    </header>
  )
}

interface DrawingBoardSectionProps {
  initialCanvasDataUrl: string | null
  onCanvasSnapshotChange: (nextCanvasDataUrl: string | null) => void
}

function DrawingBoardSection({ initialCanvasDataUrl, onCanvasSnapshotChange }: DrawingBoardSectionProps) {
  const { t } = useTranslation()
  const [activeToolMode, setActiveToolMode] = useState<DrawingToolMode>('pen')
  const [isGridVisible, setIsGridVisible] = useState(true)
  const [penColor, setPenColor] = useState(DEFAULT_PEN_COLOR)
  const [penWidth, setPenWidth] = useState(DEFAULT_PEN_WIDTH)
  const [penOpacity, setPenOpacity] = useState(DEFAULT_PEN_OPACITY)
  const [eraserSize, setEraserSize] = useState(DEFAULT_ERASER_SIZE)
  const [isPenWidthPanelOpen, setIsPenWidthPanelOpen] = useState(false)
  const [isPenColorPanelOpen, setIsPenColorPanelOpen] = useState(false)
  const [isPenOpacityPanelOpen, setIsPenOpacityPanelOpen] = useState(false)
  const [isEraserPanelOpen, setIsEraserPanelOpen] = useState(false)
  const [eraserPreview, setEraserPreview] = useState<EraserPreviewState>({
    x: 0,
    y: 0,
    visible: false,
  })
  const [undoDepth, setUndoDepth] = useState(0)
  const [redoDepth, setRedoDepth] = useState(0)
  const canvasStageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null)
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null)
  const undoSnapshotsRef = useRef<ImageData[]>([])
  const redoSnapshotsRef = useRef<ImageData[]>([])
  const isDrawingRef = useRef(false)
  const strokeBaseSnapshotRef = useRef<ImageData | null>(null)
  const strokePointsRef = useRef<CanvasPoint[]>([])
  const hasRestoredInitialCanvasRef = useRef(false)

  const emitCanvasSnapshot = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || canvas.width === 0 || canvas.height === 0) {
      onCanvasSnapshotChange(null)
      return
    }

    try {
      onCanvasSnapshotChange(canvas.toDataURL('image/png'))
    } catch {
      onCanvasSnapshotChange(null)
    }
  }, [onCanvasSnapshotChange])

  const clearRedoSnapshots = useCallback(() => {
    redoSnapshotsRef.current = []
    setRedoDepth(0)
  }, [])

  const pushRedoSnapshot = useCallback((snapshot: ImageData) => {
    redoSnapshotsRef.current.push(snapshot)

    if (redoSnapshotsRef.current.length > MAX_CANVAS_UNDO_STEPS) {
      redoSnapshotsRef.current.shift()
    }

    setRedoDepth(redoSnapshotsRef.current.length)
  }, [])

  const pushUndoStateSnapshot = useCallback((snapshot: ImageData) => {
    undoSnapshotsRef.current.push(snapshot)

    if (undoSnapshotsRef.current.length > MAX_CANVAS_UNDO_STEPS) {
      undoSnapshotsRef.current.shift()
    }

    setUndoDepth(undoSnapshotsRef.current.length)
  }, [])

  const pushUndoSnapshot = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvasContextRef.current

    if (!canvas || !context) {
      return null
    }

    // Save pre-stroke state so undo reverts one drawing action at a time.
    const snapshot = context.getImageData(0, 0, canvas.width, canvas.height)
    clearRedoSnapshots()
    pushUndoStateSnapshot(snapshot)
    return snapshot
  }, [clearRedoSnapshots, pushUndoStateSnapshot])

  const renderActiveStroke = useCallback(
    (
      context: CanvasRenderingContext2D,
      baseSnapshot: ImageData,
      points: readonly CanvasPoint[],
      isStraightLineMode: boolean,
    ) => {
      const canvas = canvasRef.current

      if (!canvas) {
        return
      }

      if (baseSnapshot.width !== canvas.width || baseSnapshot.height !== canvas.height) {
        return
      }

      context.putImageData(baseSnapshot, 0, 0)
      applyCanvasDrawingStyle(context, canvas, {
        drawingMode: activeToolMode,
        penWidth,
        penColor,
        penOpacity,
        eraserSize,
      })

      if (points.length === 0) {
        return
      }

      if (points.length === 1) {
        const [point] = points
        context.beginPath()
        context.arc(point.x, point.y, context.lineWidth * 0.5, 0, Math.PI * 2)
        context.fill()
        return
      }

      if (isStraightLineMode) {
        const firstPoint = points[0]
        const lastPoint = points[points.length - 1]

        context.beginPath()
        context.moveTo(firstPoint.x, firstPoint.y)
        context.lineTo(lastPoint.x, lastPoint.y)
        context.stroke()
        return
      }

      context.beginPath()
      context.moveTo(points[0].x, points[0].y)

      for (let index = 1; index < points.length; index += 1) {
        context.lineTo(points[index].x, points[index].y)
      }

      context.stroke()
    },
    [activeToolMode, eraserSize, penColor, penOpacity, penWidth],
  )

  const stopDrawing = useCallback(
    (event?: ReactPointerEvent<HTMLCanvasElement>) => {
      if (
        event &&
        typeof event.currentTarget.hasPointerCapture === 'function' &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }

      const shouldPersistSnapshot = isDrawingRef.current
      isDrawingRef.current = false
      strokeBaseSnapshotRef.current = null
      strokePointsRef.current = []

      if (shouldPersistSnapshot) {
        emitCanvasSnapshot()
      }
    },
    [emitCanvasSnapshot],
  )

  const showEraserPreview = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (activeToolMode !== 'eraser') {
        return
      }

      const canvas = canvasRef.current

      if (!canvas) {
        return
      }

      const bounds = canvas.getBoundingClientRect()

      if (bounds.width === 0 || bounds.height === 0) {
        return
      }

      const nextX = clampRangeValue(event.clientX - bounds.left, 0, bounds.width)
      const nextY = clampRangeValue(event.clientY - bounds.top, 0, bounds.height)

      setEraserPreview({ x: nextX, y: nextY, visible: true })
    },
    [activeToolMode],
  )

  const hideEraserPreview = useCallback(() => {
    setEraserPreview((previous) => {
      if (!previous.visible) {
        return previous
      }

      return {
        ...previous,
        visible: false,
      }
    })
  }, [])

  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvasContextRef.current

    if (!canvas || !context) {
      return
    }

    const previousSnapshot = undoSnapshotsRef.current.pop()

    if (!previousSnapshot) {
      return
    }

    const currentSnapshot = context.getImageData(0, 0, canvas.width, canvas.height)
    pushRedoSnapshot(currentSnapshot)

    if (previousSnapshot.width !== canvas.width || previousSnapshot.height !== canvas.height) {
      context.clearRect(0, 0, canvas.width, canvas.height)
    } else {
      context.putImageData(previousSnapshot, 0, 0)
    }

    setUndoDepth(undoSnapshotsRef.current.length)
    emitCanvasSnapshot()
  }, [emitCanvasSnapshot, pushRedoSnapshot])

  const handleRedo = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvasContextRef.current

    if (!canvas || !context) {
      return
    }

    const redoSnapshot = redoSnapshotsRef.current.pop()

    if (!redoSnapshot) {
      return
    }

    const currentSnapshot = context.getImageData(0, 0, canvas.width, canvas.height)
    pushUndoStateSnapshot(currentSnapshot)

    if (redoSnapshot.width !== canvas.width || redoSnapshot.height !== canvas.height) {
      context.clearRect(0, 0, canvas.width, canvas.height)
    } else {
      context.putImageData(redoSnapshot, 0, 0)
    }

    setRedoDepth(redoSnapshotsRef.current.length)
    emitCanvasSnapshot()
  }, [emitCanvasSnapshot, pushUndoStateSnapshot])

  const handleClearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvasContextRef.current

    if (!canvas || !context) {
      return
    }

    pushUndoSnapshot()
    context.clearRect(0, 0, canvas.width, canvas.height)
    isDrawingRef.current = false
    strokeBaseSnapshotRef.current = null
    strokePointsRef.current = []
    emitCanvasSnapshot()
  }, [emitCanvasSnapshot, pushUndoSnapshot])

  const handleRequestImageUpload = useCallback(() => {
    imageUploadInputRef.current?.click()
  }, [])

  const handleImageUploadChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0]
      event.target.value = ''

      if (!selectedFile || !selectedFile.type.startsWith('image/')) {
        return
      }

      const objectUrl = URL.createObjectURL(selectedFile)
      const uploadedImage = new Image()

      uploadedImage.onload = () => {
        URL.revokeObjectURL(objectUrl)

        const canvas = canvasRef.current
        const context = canvasContextRef.current

        if (!canvas || !context) {
          return
        }

        const previousSnapshot = pushUndoSnapshot()
        if (!previousSnapshot || uploadedImage.width === 0 || uploadedImage.height === 0) {
          return
        }

        const scale = Math.min(canvas.width / uploadedImage.width, canvas.height / uploadedImage.height)
        const drawWidth = Math.round(uploadedImage.width * scale)
        const drawHeight = Math.round(uploadedImage.height * scale)
        const offsetX = Math.round((canvas.width - drawWidth) * 0.5)
        const offsetY = Math.round((canvas.height - drawHeight) * 0.5)
        const nextGlobalAlpha = context.globalAlpha
        const nextCompositeOperation = context.globalCompositeOperation

        context.globalCompositeOperation = 'source-over'
        context.globalAlpha = 1
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.drawImage(uploadedImage, 0, 0, uploadedImage.width, uploadedImage.height, offsetX, offsetY, drawWidth, drawHeight)
        context.globalAlpha = nextGlobalAlpha
        context.globalCompositeOperation = nextCompositeOperation

        isDrawingRef.current = false
        strokeBaseSnapshotRef.current = null
        strokePointsRef.current = []
        emitCanvasSnapshot()
      }

      uploadedImage.onerror = () => {
        URL.revokeObjectURL(objectUrl)
      }

      uploadedImage.src = objectUrl
    },
    [emitCanvasSnapshot, pushUndoSnapshot],
  )

  const updatePenWidth = useCallback((nextWidth: number) => {
    setPenWidth(clampPenWidth(nextWidth))
  }, [])

  const updatePenOpacity = useCallback((nextOpacity: number) => {
    setPenOpacity(clampPenOpacity(nextOpacity))
  }, [])

  const updateEraserSize = useCallback((nextSize: number) => {
    setEraserSize(clampEraserSize(nextSize))
  }, [])

  const decreasePenWidth = useCallback(() => {
    updatePenWidth(penWidth - 1)
  }, [penWidth, updatePenWidth])

  const increasePenWidth = useCallback(() => {
    updatePenWidth(penWidth + 1)
  }, [penWidth, updatePenWidth])

  const decreasePenOpacity = useCallback(() => {
    updatePenOpacity(penOpacity - 1)
  }, [penOpacity, updatePenOpacity])

  const increasePenOpacity = useCallback(() => {
    updatePenOpacity(penOpacity + 1)
  }, [penOpacity, updatePenOpacity])

  const decreaseEraserSize = useCallback(() => {
    updateEraserSize(eraserSize - 1)
  }, [eraserSize, updateEraserSize])

  const increaseEraserSize = useCallback(() => {
    updateEraserSize(eraserSize + 1)
  }, [eraserSize, updateEraserSize])

  const togglePenWidthPanel = useCallback(() => {
    setIsPenWidthPanelOpen((previous) => !previous)
    setIsPenColorPanelOpen(false)
    setIsPenOpacityPanelOpen(false)
    setIsEraserPanelOpen(false)
    setActiveToolMode('pen')
  }, [])

  const togglePenColorPanel = useCallback(() => {
    setIsPenColorPanelOpen((previous) => !previous)
    setIsPenWidthPanelOpen(false)
    setIsPenOpacityPanelOpen(false)
    setIsEraserPanelOpen(false)
    setActiveToolMode('pen')
  }, [])

  const togglePenOpacityPanel = useCallback(() => {
    setIsPenOpacityPanelOpen((previous) => !previous)
    setIsPenWidthPanelOpen(false)
    setIsPenColorPanelOpen(false)
    setIsEraserPanelOpen(false)
    setActiveToolMode('pen')
  }, [])

  const toggleEraserPanel = useCallback(() => {
    setIsPenWidthPanelOpen(false)
    setIsPenColorPanelOpen(false)
    setIsPenOpacityPanelOpen(false)
    setIsEraserPanelOpen((previous) => {
      const next = !previous
      setActiveToolMode(next ? 'eraser' : 'pen')
      return next
    })
  }, [])

  const handleCanvasKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLCanvasElement>) => {
      const isUndoShortcut =
        (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z'
      const isRedoShortcut =
        (event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'z'

      if (isRedoShortcut && redoDepth > 0) {
        event.preventDefault()
        handleRedo()
        return
      }

      if (!isUndoShortcut || undoDepth === 0) {
        return
      }

      event.preventDefault()
      handleUndo()
    },
    [handleRedo, handleUndo, redoDepth, undoDepth],
  )

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0) {
        return
      }

      const canvas = canvasRef.current
      const context = canvasContextRef.current

      if (!canvas || !context) {
        return
      }

      const strokeBaseSnapshot = pushUndoSnapshot()

      if (!strokeBaseSnapshot) {
        return
      }

      const nextPoint = resolveCanvasPoint(canvas, event.clientX, event.clientY)

      isDrawingRef.current = true
      strokeBaseSnapshotRef.current = strokeBaseSnapshot
      strokePointsRef.current = [nextPoint]
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.focus({ preventScroll: true })

      showEraserPreview(event)
      renderActiveStroke(context, strokeBaseSnapshot, strokePointsRef.current, event.shiftKey)

      event.preventDefault()
    },
    [pushUndoSnapshot, renderActiveStroke, showEraserPreview],
  )

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    showEraserPreview(event)

    if (!isDrawingRef.current) {
      return
    }

    const canvas = canvasRef.current
    const context = canvasContextRef.current
    const strokeBaseSnapshot = strokeBaseSnapshotRef.current

    if (!canvas || !context || !strokeBaseSnapshot) {
      return
    }

    const nextPoint = resolveCanvasPoint(canvas, event.clientX, event.clientY)
    strokePointsRef.current.push(nextPoint)

    renderActiveStroke(context, strokeBaseSnapshot, strokePointsRef.current, event.shiftKey)
    event.preventDefault()
  }, [renderActiveStroke, showEraserPreview])

  const handlePointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      showEraserPreview(event)
    },
    [showEraserPreview],
  )

  const handlePointerLeave = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      stopDrawing(event)
      hideEraserPreview()
    },
    [hideEraserPreview, stopDrawing],
  )

  const handlePointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      stopDrawing(event)
      hideEraserPreview()
    },
    [hideEraserPreview, stopDrawing],
  )

  useEffect(() => {
    const stage = canvasStageRef.current
    const canvas = canvasRef.current

    if (!stage || !canvas) {
      return
    }

    const resizeCanvas = () => {
      const bounds = stage.getBoundingClientRect()

      if (bounds.width === 0 || bounds.height === 0) {
        return
      }

      const pixelRatio = window.devicePixelRatio || 1
      const nextWidth = Math.max(1, Math.round(bounds.width * pixelRatio))
      const nextHeight = Math.max(1, Math.round(bounds.height * pixelRatio))

      if (canvas.width === nextWidth && canvas.height === nextHeight) {
        canvasContextRef.current = configureCanvasContext(canvas, {
          drawingMode: activeToolMode,
          penWidth,
          penColor,
          penOpacity,
          eraserSize,
        })
        return
      }

      const previousBitmap = document.createElement('canvas')
      previousBitmap.width = canvas.width
      previousBitmap.height = canvas.height

      const previousBitmapContext = previousBitmap.getContext('2d')

      if (previousBitmapContext && canvas.width > 0 && canvas.height > 0) {
        previousBitmapContext.drawImage(canvas, 0, 0)
      }

      canvas.width = nextWidth
      canvas.height = nextHeight

      const context = configureCanvasContext(canvas, {
        drawingMode: activeToolMode,
        penWidth,
        penColor,
        penOpacity,
        eraserSize,
      })
      canvasContextRef.current = context

      if (context && previousBitmap.width > 0 && previousBitmap.height > 0) {
        const nextGlobalAlpha = context.globalAlpha
        const nextCompositeOperation = context.globalCompositeOperation
        context.globalCompositeOperation = 'source-over'
        context.globalAlpha = 1
        context.drawImage(previousBitmap, 0, 0, previousBitmap.width, previousBitmap.height, 0, 0, canvas.width, canvas.height)
        context.globalAlpha = nextGlobalAlpha
        context.globalCompositeOperation = nextCompositeOperation
      }

      undoSnapshotsRef.current = []
      redoSnapshotsRef.current = []
      setUndoDepth(0)
      setRedoDepth(0)
      isDrawingRef.current = false
      strokeBaseSnapshotRef.current = null
      strokePointsRef.current = []
    }

    resizeCanvas()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resizeCanvas)

      return () => {
        window.removeEventListener('resize', resizeCanvas)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas()
    })

    resizeObserver.observe(stage)

    return () => {
      resizeObserver.disconnect()
    }
  }, [activeToolMode, eraserSize, penColor, penOpacity, penWidth])

  useEffect(() => {
    if (hasRestoredInitialCanvasRef.current) {
      return
    }

    hasRestoredInitialCanvasRef.current = true
    if (!initialCanvasDataUrl) {
      return
    }

    let animationFrameId: number | null = null
    let isCancelled = false

    const restoreDraftCanvas = () => {
      if (isCancelled) {
        return
      }

      const canvas = canvasRef.current
      const context = canvasContextRef.current

      if (!canvas || !context || canvas.width === 0 || canvas.height === 0) {
        animationFrameId = window.requestAnimationFrame(restoreDraftCanvas)
        return
      }

      const draftImage = new Image()
      draftImage.onload = () => {
        if (isCancelled) {
          return
        }

        const nextGlobalAlpha = context.globalAlpha
        const nextCompositeOperation = context.globalCompositeOperation
        context.globalCompositeOperation = 'source-over'
        context.globalAlpha = 1
        context.clearRect(0, 0, canvas.width, canvas.height)
        context.drawImage(draftImage, 0, 0, draftImage.width, draftImage.height, 0, 0, canvas.width, canvas.height)
        context.globalAlpha = nextGlobalAlpha
        context.globalCompositeOperation = nextCompositeOperation
        undoSnapshotsRef.current = []
        redoSnapshotsRef.current = []
        setUndoDepth(0)
        setRedoDepth(0)
        emitCanvasSnapshot()
      }
      draftImage.src = initialCanvasDataUrl
    }

    animationFrameId = window.requestAnimationFrame(restoreDraftCanvas)

    return () => {
      isCancelled = true
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId)
      }
    }
  }, [emitCanvasSnapshot, initialCanvasDataUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvasContextRef.current

    if (!canvas || !context) {
      return
    }

    applyCanvasDrawingStyle(context, canvas, {
      drawingMode: activeToolMode,
      penWidth,
      penColor,
      penOpacity,
      eraserSize,
    })
  }, [activeToolMode, eraserSize, penColor, penOpacity, penWidth])

  useEffect(() => {
    if (activeToolMode === 'eraser') {
      return
    }

    const animationFrameId = window.requestAnimationFrame(() => {
      hideEraserPreview()
    })

    return () => {
      window.cancelAnimationFrame(animationFrameId)
    }
  }, [activeToolMode, hideEraserPreview])

  const canvasSurfaceClassName = `canvas-stage__surface${isGridVisible ? '' : ' canvas-stage__surface--plain'}${
    activeToolMode === 'eraser' ? ' canvas-stage__surface--eraser' : ''
  }`

  return (
    <motion.section
      className="panel panel--canvas"
      aria-labelledby="drawing-panel-title"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="panel-header">
        <h2 id="drawing-panel-title">{t('workspace.panels.canvas.title')}</h2>
        <p>{t('workspace.panels.canvas.description')}</p>
      </div>
      <div ref={canvasStageRef} className="canvas-stage">
        <canvas
          ref={canvasRef}
          className={canvasSurfaceClassName}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerEnter={handlePointerEnter}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={handlePointerLeave}
          onPointerCancel={handlePointerCancel}
          onKeyDown={handleCanvasKeyDown}
        />
        {activeToolMode === 'eraser' ? (
          <span
            className={`canvas-stage__eraser-preview${eraserPreview.visible ? ' canvas-stage__eraser-preview--visible' : ''}`}
            aria-hidden="true"
            style={{
              width: `${eraserSize}px`,
              height: `${eraserSize}px`,
              left: `${eraserPreview.x}px`,
              top: `${eraserPreview.y}px`,
            }}
          />
        ) : null}
      </div>
      <input
        ref={imageUploadInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleImageUploadChange}
      />
      <ul className="tool-chip-list" aria-label={t('workspace.panels.canvas.title')}>
        {drawingTools.map((tool) => {
          const Icon = tool.icon

          if (tool.key === 'brushSize') {
            return (
              <li key={tool.key}>
                <button
                  type="button"
                  className={`tool-chip tool-chip--button${isPenWidthPanelOpen ? ' tool-chip--active' : ''}`}
                  aria-expanded={isPenWidthPanelOpen}
                  aria-controls="pen-width-panel"
                  onClick={togglePenWidthPanel}
                >
                  <Icon className="tool-chip__icon" size={14} strokeWidth={2.3} aria-hidden="true" />
                  {t(`workspace.tools.${tool.key}`)}
                </button>
              </li>
            )
          }

          if (tool.key === 'brushColor') {
            return (
              <li key={tool.key}>
                <button
                  type="button"
                  className={`tool-chip tool-chip--button${isPenColorPanelOpen ? ' tool-chip--active' : ''}`}
                  aria-expanded={isPenColorPanelOpen}
                  aria-controls="pen-color-panel"
                  onClick={togglePenColorPanel}
                >
                  <Icon className="tool-chip__icon" size={14} strokeWidth={2.3} aria-hidden="true" />
                  <span className="tool-chip__color-preview" aria-hidden="true" style={{ backgroundColor: penColor }} />
                  {t(`workspace.tools.${tool.key}`)}
                </button>
              </li>
            )
          }

          if (tool.key === 'opacity') {
            return (
              <li key={tool.key}>
                <button
                  type="button"
                  className={`tool-chip tool-chip--button${isPenOpacityPanelOpen ? ' tool-chip--active' : ''}`}
                  aria-expanded={isPenOpacityPanelOpen}
                  aria-controls="pen-opacity-panel"
                  onClick={togglePenOpacityPanel}
                >
                  <Icon className="tool-chip__icon" size={14} strokeWidth={2.3} aria-hidden="true" />
                  {t(`workspace.tools.${tool.key}`)}
                </button>
              </li>
            )
          }

          if (tool.key === 'eraser') {
            const isEraserActive = activeToolMode === 'eraser'

            return (
              <li key={tool.key}>
                <button
                  type="button"
                  className={`tool-chip tool-chip--button${isEraserActive ? ' tool-chip--active' : ''}`}
                  aria-pressed={isEraserActive}
                  aria-expanded={isEraserPanelOpen}
                  aria-controls="eraser-size-panel"
                  onClick={toggleEraserPanel}
                >
                  <Icon className="tool-chip__icon" size={14} strokeWidth={2.3} aria-hidden="true" />
                  {t(`workspace.tools.${tool.key}`)}
                </button>
              </li>
            )
          }

          if (tool.key === 'undo') {
            return (
              <li key={tool.key}>
                <button
                  type="button"
                  className="tool-chip tool-chip--button"
                  onClick={handleUndo}
                >
                  <Icon className="tool-chip__icon" size={14} strokeWidth={2.3} aria-hidden="true" />
                  {t(`workspace.tools.${tool.key}`)}
                </button>
              </li>
            )
          }

          if (tool.key === 'redo') {
            return (
              <li key={tool.key}>
                <button
                  type="button"
                  className="tool-chip tool-chip--button"
                  disabled={redoDepth === 0}
                  onClick={handleRedo}
                >
                  <Icon className="tool-chip__icon" size={14} strokeWidth={2.3} aria-hidden="true" />
                  {t(`workspace.tools.${tool.key}`)}
                </button>
              </li>
            )
          }

          return (
            <li key={tool.key}>
              <span className="tool-chip">
                <Icon className="tool-chip__icon" size={14} strokeWidth={2.3} aria-hidden="true" />
                {t(`workspace.tools.${tool.key}`)}
              </span>
            </li>
          )
        })}
        <li className="tool-chip--canvas-action-start">
          <button
            type="button"
            className="tool-chip__grid-toggle"
            aria-label={t('workspace.canvas.uploadImage')}
            title={t('workspace.canvas.uploadImage')}
            onClick={handleRequestImageUpload}
          >
            <ImageUp size={14} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </li>
        <li>
          <button
            type="button"
            className="tool-chip__grid-toggle"
            aria-label={t('workspace.canvas.clearCanvas')}
            title={t('workspace.canvas.clearCanvas')}
            onClick={handleClearCanvas}
          >
            <BrushCleaning size={14} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </li>
        <li className="tool-chip--grid-toggle">
          <button
            type="button"
            className="tool-chip__grid-toggle"
            aria-pressed={isGridVisible}
            aria-label={isGridVisible ? t('workspace.canvas.toggleGridOff') : t('workspace.canvas.toggleGridOn')}
            title={isGridVisible ? t('workspace.canvas.toggleGridOff') : t('workspace.canvas.toggleGridOn')}
            onClick={() => {
              setIsGridVisible((previous) => !previous)
            }}
          >
            <Grid3x3 size={14} strokeWidth={2.3} aria-hidden="true" />
          </button>
        </li>
      </ul>
      {isPenWidthPanelOpen ? (
        <RangeControlPanel
          id="pen-width-panel"
          panelClassName="pen-width-panel"
          ariaLabel={t('workspace.tools.brushSize')}
          sliderId="pen-width-slider"
          sliderAriaLabel={t('workspace.tools.brushSize')}
          value={penWidth}
          min={MIN_PEN_WIDTH}
          max={MAX_PEN_WIDTH}
          decreaseAriaLabel={t('workspace.canvas.decreasePenWidth')}
          increaseAriaLabel={t('workspace.canvas.increasePenWidth')}
          onDecrease={decreasePenWidth}
          onIncrease={increasePenWidth}
          onChange={updatePenWidth}
          decreaseIconClassName="range-control-panel__dot-icon--thin"
          increaseIconClassName="range-control-panel__dot-icon--thick"
          valueClassName="pen-width-panel__value"
        />
      ) : null}
      {isPenOpacityPanelOpen ? (
        <RangeControlPanel
          id="pen-opacity-panel"
          panelClassName="pen-opacity-panel"
          ariaLabel={t('workspace.tools.opacity')}
          sliderId="pen-opacity-slider"
          sliderAriaLabel={t('workspace.tools.opacity')}
          value={penOpacity}
          min={MIN_PEN_OPACITY}
          max={MAX_PEN_OPACITY}
          decreaseAriaLabel={t('workspace.canvas.decreaseOpacity')}
          increaseAriaLabel={t('workspace.canvas.increaseOpacity')}
          onDecrease={decreasePenOpacity}
          onIncrease={increasePenOpacity}
          onChange={updatePenOpacity}
          decreaseIconClassName="range-control-panel__dot-icon--opacity-low"
          increaseIconClassName="range-control-panel__dot-icon--opacity-high"
          formatValue={(value) => `${value}%`}
        />
      ) : null}
      {isEraserPanelOpen ? (
        <RangeControlPanel
          id="eraser-size-panel"
          panelClassName="eraser-size-panel"
          ariaLabel={t('workspace.tools.eraser')}
          sliderId="eraser-size-slider"
          sliderAriaLabel={t('workspace.tools.eraser')}
          value={eraserSize}
          min={MIN_ERASER_SIZE}
          max={MAX_ERASER_SIZE}
          decreaseAriaLabel={t('workspace.canvas.decreaseEraserSize')}
          increaseAriaLabel={t('workspace.canvas.increaseEraserSize')}
          onDecrease={decreaseEraserSize}
          onIncrease={increaseEraserSize}
          onChange={updateEraserSize}
          decreaseIconClassName="range-control-panel__dot-icon--eraser-small"
          increaseIconClassName="range-control-panel__dot-icon--eraser-large"
        />
      ) : null}
      {isPenColorPanelOpen ? (
        <div className="pen-color-panel" id="pen-color-panel" role="group" aria-label={t('workspace.tools.brushColor')}>
          {PEN_COLOR_OPTIONS.map((color) => (
            <button
              key={color}
              type="button"
              className={`pen-color-panel__swatch${penColor === color ? ' pen-color-panel__swatch--active' : ''}`}
              aria-pressed={penColor === color}
              aria-label={t('workspace.canvas.selectPenColor', { color })}
              title={color}
              style={{ backgroundColor: color }}
              onClick={() => {
                setPenColor(color)
              }}
            />
          ))}
        </div>
      ) : null}
    </motion.section>
  )
}

function resolveStoryLanguage(language: string): StoryLanguage {
  return resolveAppLanguage(language) as StoryLanguage
}

function resolveErrorFeedbackText(
  feedback: ReturnType<typeof useStorybookCreationStore.getState>['feedback'],
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (feedback === null || feedback.kind === 'success') {
    return null
  }

  return t(`workspace.feedback.error.${feedback.code}`)
}

function normalizeStorybookGeneratedPages(pages: readonly StorybookGeneratedPage[] | undefined): StorybookGeneratedPage[] {
  if (!pages || pages.length === 0) {
    return []
  }

  return pages
    .map((page) => ({
      page: page.page,
      content: page.content.trim(),
      isHighlight: page.isHighlight,
    }))
    .filter((page) => Number.isFinite(page.page) && page.content.length > 0)
    .sort((left, right) => left.page - right.page)
}

function normalizeStorybookImageDataUrl(candidate: string): string | null {
  const compact = candidate.trim().replace(/\s+/g, '')
  if (compact.length === 0) {
    return null
  }

  const normalized = compact
    .replace(/^data:\s*/i, 'data:')
    .replace(/^data:image\/([a-z0-9.+-]+);bas64,/i, 'data:image/$1;base64,')

  if (normalized.startsWith('data:image/')) {
    return normalized
  }

  return `data:image/png;base64,${normalized}`
}

function normalizeStorybookGeneratedImages(images: readonly string[] | undefined): string[] {
  if (!images || images.length === 0) {
    return []
  }

  return images
    .map((image) => normalizeStorybookImageDataUrl(image))
    .filter((image): image is string => image !== null)
}

function normalizeStorybookNarrationDataUrl(candidate: string): string | null {
  const compact = candidate.trim().replace(/\s+/g, '')
  if (compact.length === 0) {
    return null
  }

  if (compact.startsWith('data:audio/')) {
    return compact
  }

  return `data:audio/mpeg;base64,${compact}`
}

function normalizeStorybookGeneratedNarrations(
  narrations: readonly StorybookGeneratedNarration[] | undefined,
): StorybookGeneratedNarration[] {
  if (!narrations || narrations.length === 0) {
    return []
  }

  const narrationsByPage = new Map<number, string>()

  narrations.forEach((narration) => {
    if (typeof narration.page !== 'number' || !Number.isFinite(narration.page)) {
      return
    }

    const normalizedAudioDataUrl = normalizeStorybookNarrationDataUrl(narration.audioDataUrl)
    if (!normalizedAudioDataUrl) {
      return
    }

    if (narrationsByPage.has(narration.page)) {
      return
    }

    narrationsByPage.set(narration.page, normalizedAudioDataUrl)
  })

  return [...narrationsByPage.entries()]
    .map(([page, audioDataUrl]) => ({ page, audioDataUrl }))
    .sort((left, right) => left.page - right.page)
}

function resolveReaderPageImage(
  page: StorybookGeneratedPage,
  pageIndex: number,
  totalPages: number,
  highlightImage?: string,
  finalImage?: string,
): string | undefined {
  const isLastPage = pageIndex === totalPages - 1
  if (isLastPage) {
    return finalImage
  }

  if (page.isHighlight) {
    return highlightImage
  }

  return undefined
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

function buildStorybookReaderPages(
  pages: readonly StorybookGeneratedPage[],
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

type StorybookPageTurnDirection = 'next' | 'previous'

interface StorybookPageTurnState {
  direction: StorybookPageTurnDirection
  targetSpreadStartIndex: number
  frontPage: StorybookReaderPage
  backPage: StorybookReaderPage
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

function StorybookReaderDialog({ book, onClose }: StorybookReaderDialogProps) {
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
    () => buildStorybookReaderPages(book.pages, narrationsByPage, book.highlightImage, book.finalImage),
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
  const canReturnToCover = isCoverOpened && activeSpreadStartIndex === 0
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

  const handleReturnToCover = useCallback(() => {
    if (!canReturnToCover || pageTurnState !== null) {
      return
    }

    closeBookToCover()
  }, [canReturnToCover, closeBookToCover, pageTurnState])

  const handleGoToCoverFromLastSpread = useCallback(() => {
    if (!isLastSpread || pageTurnState !== null) {
      return
    }

    closeBookToCover()
  }, [closeBookToCover, isLastSpread, pageTurnState])

  const handleGoPreviousSpread = useCallback(() => {
    if (!canGoPreviousSpread || pageTurnState !== null) {
      return
    }

    stopAutoNarration()
    const previousSpreadStartIndex = Math.max(0, activeSpreadStartIndex - pageAdvanceStep)

    if (isSinglePageReaderMode) {
      setActiveSpreadStartIndex(previousSpreadStartIndex)
      activeSpreadStartIndexRef.current = previousSpreadStartIndex
      return
    }

    const currentLeftPage = readerPages[activeSpreadStartIndex]
    const previousRightPage = readerPages[previousSpreadStartIndex + 1]

    if (!currentLeftPage || !previousRightPage) {
      setActiveSpreadStartIndex(previousSpreadStartIndex)
      activeSpreadStartIndexRef.current = previousSpreadStartIndex
      return
    }

    const nextPageTurnState: StorybookPageTurnState = {
      direction: 'previous',
      targetSpreadStartIndex: previousSpreadStartIndex,
      frontPage: currentLeftPage,
      backPage: previousRightPage,
    }
    setPageTurnState(nextPageTurnState)
    pageTurnStateRef.current = nextPageTurnState
    clearPageTurnTimeout()
    pageTurnTimeoutRef.current = window.setTimeout(() => {
      setActiveSpreadStartIndex(previousSpreadStartIndex)
      activeSpreadStartIndexRef.current = previousSpreadStartIndex
      setPageTurnState(null)
      pageTurnStateRef.current = null
      pageTurnTimeoutRef.current = null
    }, STORYBOOK_PAGE_TURN_DURATION_MS)
  }, [
    activeSpreadStartIndex,
    canGoPreviousSpread,
    clearPageTurnTimeout,
    isSinglePageReaderMode,
    pageAdvanceStep,
    pageTurnState,
    readerPages,
    stopAutoNarration,
  ])

  const handleGoNextSpread = useCallback(() => {
    if (!canGoNextSpread || pageTurnState !== null) {
      return
    }

    stopAutoNarration()
    const nextSpreadStartIndex = Math.min(Math.max(0, totalPages - 1), activeSpreadStartIndex + pageAdvanceStep)

    if (isSinglePageReaderMode) {
      setActiveSpreadStartIndex(nextSpreadStartIndex)
      activeSpreadStartIndexRef.current = nextSpreadStartIndex
      return
    }

    const currentRightPage = readerPages[activeSpreadStartIndex + 1]
    const nextLeftPage = readerPages[nextSpreadStartIndex]

    if (!currentRightPage || !nextLeftPage) {
      setActiveSpreadStartIndex(nextSpreadStartIndex)
      activeSpreadStartIndexRef.current = nextSpreadStartIndex
      return
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
    pageTurnTimeoutRef.current = window.setTimeout(() => {
      setActiveSpreadStartIndex(nextSpreadStartIndex)
      activeSpreadStartIndexRef.current = nextSpreadStartIndex
      setPageTurnState(null)
      pageTurnStateRef.current = null
      pageTurnTimeoutRef.current = null
    }, STORYBOOK_PAGE_TURN_DURATION_MS)
  }, [
    activeSpreadStartIndex,
    canGoNextSpread,
    clearPageTurnTimeout,
    isSinglePageReaderMode,
    pageAdvanceStep,
    pageTurnState,
    readerPages,
    stopAutoNarration,
    totalPages,
  ])

  const handleLeftTurnZoneClick = useCallback(() => {
    if (pageTurnState !== null) {
      return
    }

    if (canGoPreviousSpread) {
      handleGoPreviousSpread()
      return
    }

    if (canReturnToCover) {
      handleReturnToCover()
    }
  }, [canGoPreviousSpread, canReturnToCover, handleGoPreviousSpread, handleReturnToCover, pageTurnState])

  const handleTogglePageNarration = useCallback(
    (page: StorybookReaderTextPage) => {
      if (!page.narrationAudioUrl) {
        return
      }

      stopAutoNarration(false)

      if (activeNarrationPageNumber === page.pageNumber) {
        stopNarrationPlayback()
        return
      }

      void playNarrationForPage(page)
    },
    [activeNarrationPageNumber, playNarrationForPage, stopAutoNarration, stopNarrationPlayback],
  )

  const handleToggleAutoNarration = useCallback(() => {
    if (isAutoNarrationActive) {
      stopAutoNarration()
      return
    }

    if (narratablePageCount === 0 || totalPages === 0) {
      return
    }

    const runId = autoNarrationRunIdRef.current + 1
    autoNarrationRunIdRef.current = runId
    setIsAutoNarrationActive(true)

    void (async () => {
      if (!isCoverOpenedRef.current) {
        handleOpenCover()
        await waitForMilliseconds(STORYBOOK_COVER_FLIP_DURATION_MS + STORYBOOK_AUTO_NARRATION_WAIT_PADDING_MS)
      }

      if (!isCoverOpenedRef.current || autoNarrationRunIdRef.current !== runId) {
        if (autoNarrationRunIdRef.current === runId) {
          autoNarrationRunIdRef.current += 1
          setIsAutoNarrationActive(false)
        }
        return
      }

      while (autoNarrationRunIdRef.current === runId) {
        const spreadStartIndex = activeSpreadStartIndexRef.current
        const spreadNarrationPages = resolveNarratablePagesInView(
          readerPages,
          spreadStartIndex,
          isSinglePageReaderMode,
        )

        for (const spreadNarrationPage of spreadNarrationPages) {
          if (autoNarrationRunIdRef.current !== runId) {
            return
          }

          await playNarrationForPage(spreadNarrationPage)
        }

        if (autoNarrationRunIdRef.current !== runId) {
          return
        }

        const didMoveToNextSpread = await goNextSpreadForAutoNarration()
        if (!didMoveToNextSpread) {
          break
        }

        await waitForMilliseconds(STORYBOOK_AUTO_NARRATION_WAIT_PADDING_MS)
      }

      if (autoNarrationRunIdRef.current === runId) {
        autoNarrationRunIdRef.current += 1
        setIsAutoNarrationActive(false)
        stopNarrationPlayback()
      }
    })()
  }, [
    goNextSpreadForAutoNarration,
    handleOpenCover,
    isAutoNarrationActive,
    isSinglePageReaderMode,
    narratablePageCount,
    playNarrationForPage,
    readerPages,
    stopAutoNarration,
    stopNarrationPlayback,
    totalPages,
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

function StoryLoadingMiniGame() {
  const { t } = useTranslation()
  const trackRef = useRef<HTMLDivElement | null>(null)
  const obstacleIdRef = useRef(0)
  const spawnCountdownRef = useRef(resolveLoadingGameSpawnInterval(LOADING_GAME_BASE_SPEED))
  const speedRef = useRef(LOADING_GAME_BASE_SPEED)
  const scoreRef = useRef(0)
  const carLaneRef = useRef(LOADING_GAME_INITIAL_LANE)
  const livesRef = useRef(LOADING_GAME_MAX_LIVES)
  const isGameOverRef = useRef(false)
  const trackMetricsRef = useRef<LoadingGameTrackMetrics>({
    width: LOADING_GAME_INITIAL_TRACK_WIDTH,
    height: LOADING_GAME_INITIAL_TRACK_HEIGHT,
  })
  const obstaclesRef = useRef<LoadingGameObstacle[]>([])
  const hitTimeoutRef = useRef<number | null>(null)
  const [carLane, setCarLane] = useState(LOADING_GAME_INITIAL_LANE)
  const [speed, setSpeed] = useState(LOADING_GAME_BASE_SPEED)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(LOADING_GAME_MAX_LIVES)
  const [isGameOver, setIsGameOver] = useState(false)
  const [trackMetrics, setTrackMetrics] = useState<LoadingGameTrackMetrics>({
    width: LOADING_GAME_INITIAL_TRACK_WIDTH,
    height: LOADING_GAME_INITIAL_TRACK_HEIGHT,
  })
  const [obstacles, setObstacles] = useState<LoadingGameObstacle[]>([])
  const [backgroundOffset, setBackgroundOffset] = useState(0)
  const [isHit, setIsHit] = useState(false)

  const laneHeight = trackMetrics.height / LOADING_GAME_LANE_COUNT
  const carX = trackMetrics.width * LOADING_GAME_CAR_X_RATIO
  const carY = laneHeight * (carLane + 0.5)
  const scoreMultiplier = resolveLoadingGameScoreMultiplier(speed)

  const updateCarLane = useCallback((nextLane: number) => {
    const clampedLane = clampRangeValue(nextLane, 0, LOADING_GAME_LANE_COUNT - 1)

    setCarLane(clampedLane)
    carLaneRef.current = clampedLane
  }, [])

  const moveCar = useCallback(
    (delta: number) => {
      if (isGameOverRef.current) {
        return
      }

      updateCarLane(carLaneRef.current + delta)
    },
    [updateCarLane],
  )

  const triggerHitFeedback = useCallback(() => {
    setIsHit(true)

    if (hitTimeoutRef.current !== null) {
      window.clearTimeout(hitTimeoutRef.current)
    }

    hitTimeoutRef.current = window.setTimeout(() => {
      setIsHit(false)
      hitTimeoutRef.current = null
    }, 190)
  }, [])

  useEffect(() => {
    return () => {
      if (hitTimeoutRef.current !== null) {
        window.clearTimeout(hitTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const track = trackRef.current

    if (!track) {
      return
    }

    const updateMetrics = () => {
      const bounds = track.getBoundingClientRect()

      if (bounds.width === 0 || bounds.height === 0) {
        return
      }

      const nextMetrics = {
        width: bounds.width,
        height: bounds.height,
      }
      trackMetricsRef.current = nextMetrics
      setTrackMetrics(nextMetrics)
    }

    updateMetrics()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateMetrics)

      return () => {
        window.removeEventListener('resize', updateMetrics)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      updateMetrics()
    })

    resizeObserver.observe(track)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    if (isGameOver) {
      return
    }

    trackRef.current?.focus({ preventScroll: true })
  }, [isGameOver])

  const resetMiniGame = useCallback(() => {
    if (hitTimeoutRef.current !== null) {
      window.clearTimeout(hitTimeoutRef.current)
      hitTimeoutRef.current = null
    }

    obstacleIdRef.current = 0
    spawnCountdownRef.current = resolveLoadingGameSpawnInterval(LOADING_GAME_BASE_SPEED)
    speedRef.current = LOADING_GAME_BASE_SPEED
    scoreRef.current = 0
    carLaneRef.current = LOADING_GAME_INITIAL_LANE
    obstaclesRef.current = []
    livesRef.current = LOADING_GAME_MAX_LIVES
    isGameOverRef.current = false
    setCarLane(LOADING_GAME_INITIAL_LANE)
    setSpeed(LOADING_GAME_BASE_SPEED)
    setScore(0)
    setLives(LOADING_GAME_MAX_LIVES)
    setIsGameOver(false)
    setObstacles([])
    setBackgroundOffset(0)
    setIsHit(false)
    trackRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (isGameOverRef.current) {
        return
      }

      const deltaSeconds = LOADING_GAME_TICK_MS / 1000
      const nextSpeed = Math.min(
        LOADING_GAME_MAX_SPEED,
        speedRef.current + LOADING_GAME_ACCELERATION_PER_SECOND * deltaSeconds,
      )
      const carCenterX = trackMetricsRef.current.width * LOADING_GAME_CAR_X_RATIO
      const carHalfWidth = LOADING_GAME_CAR_COLLISION_WIDTH * 0.5

      speedRef.current = nextSpeed
      setSpeed(nextSpeed)

      spawnCountdownRef.current -= deltaSeconds
      let nextObstacles = obstaclesRef.current

      if (spawnCountdownRef.current <= 0) {
        obstacleIdRef.current += 1
        nextObstacles = [
          ...nextObstacles,
          {
            id: obstacleIdRef.current,
            lane: Math.floor(Math.random() * LOADING_GAME_LANE_COUNT),
            x: trackMetricsRef.current.width + LOADING_GAME_OBSTACLE_SIZE,
            type: resolveRandomLoadingGameObstacleType(),
            counted: false,
          },
        ]
        spawnCountdownRef.current = resolveLoadingGameSpawnInterval(nextSpeed)
      }

      let nextScore = scoreRef.current
      let hasCollision = false
      const shiftedObstacles: LoadingGameObstacle[] = []

      for (const obstacle of nextObstacles) {
        const shiftedX = obstacle.x - nextSpeed * deltaSeconds
        const obstacleCenterX = shiftedX + LOADING_GAME_OBSTACLE_SIZE * 0.5
        const obstacleHalfWidth = LOADING_GAME_OBSTACLE_SIZE * 0.42
        let counted = obstacle.counted

        if (!counted && shiftedX + LOADING_GAME_OBSTACLE_SIZE < carCenterX - carHalfWidth) {
          counted = true
          nextScore += resolveLoadingGameScoreMultiplier(nextSpeed)
        }

        const isCollision =
          obstacle.lane === carLaneRef.current &&
          Math.abs(obstacleCenterX - carCenterX) < carHalfWidth + obstacleHalfWidth

        if (isCollision) {
          hasCollision = true
          continue
        }

        if (shiftedX > -LOADING_GAME_OBSTACLE_SIZE) {
          shiftedObstacles.push({
            ...obstacle,
            x: shiftedX,
            counted,
          })
        }
      }

      if (hasCollision) {
        triggerHitFeedback()
        const nextLives = Math.max(0, livesRef.current - 1)

        if (nextLives !== livesRef.current) {
          livesRef.current = nextLives
          setLives(nextLives)
        }

        if (nextLives === 0) {
          isGameOverRef.current = true
          setIsGameOver(true)
        }

        nextScore = Math.max(0, nextScore - Math.max(2, resolveLoadingGameScoreMultiplier(nextSpeed) * 2))
      }

      if (nextScore !== scoreRef.current) {
        scoreRef.current = nextScore
        setScore(nextScore)
      }

      obstaclesRef.current = shiftedObstacles
      setObstacles(shiftedObstacles)
      setBackgroundOffset((previous) => {
        const nextOffset = previous + nextSpeed * deltaSeconds

        if (nextOffset >= LOADING_GAME_BACKGROUND_LOOP_WIDTH) {
          return nextOffset - LOADING_GAME_BACKGROUND_LOOP_WIDTH
        }

        return nextOffset
      })
    }, LOADING_GAME_TICK_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [triggerHitFeedback])

  const handleTrackKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isGameOverRef.current) {
        return
      }

      const key = event.key.toLowerCase()

      if (event.key === 'ArrowUp' || key === 'w') {
        event.preventDefault()
        moveCar(-1)
      }

      if (event.key === 'ArrowDown' || key === 's') {
        event.preventDefault()
        moveCar(1)
      }
    },
    [moveCar],
  )

  const handleTrackPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isGameOverRef.current) {
        return
      }

      const bounds = event.currentTarget.getBoundingClientRect()

      if (bounds.height === 0) {
        return
      }

      const relativeY = clampRangeValue(event.clientY - bounds.top, 0, bounds.height - 1)
      const nextLane = Math.floor(relativeY / (bounds.height / LOADING_GAME_LANE_COUNT))

      updateCarLane(nextLane)
      event.currentTarget.focus({ preventScroll: true })
    },
    [updateCarLane],
  )

  return (
    <section className="story-loading-game" data-testid="story-loading-mini-game" aria-label={t('workspace.miniGame.title')}>
      <header className="story-loading-game__header">
        <h3>{t('workspace.miniGame.title')}</h3>
        <p>{t('workspace.miniGame.description')}</p>
      </header>
      <div className="story-loading-game__hud" aria-live="polite">
        <span>
          {t('workspace.miniGame.score')}{' '}
          <strong className="story-loading-game__hud-value">{score}</strong>
        </span>
        <span>
          {t('workspace.miniGame.speed')}{' '}
          <strong className="story-loading-game__hud-value">{Math.round(speed)}</strong>
        </span>
        <span>{t('workspace.miniGame.bonus', { multiplier: scoreMultiplier })}</span>
      </div>
      <div
        ref={trackRef}
        className={`story-loading-game__track${isHit ? ' story-loading-game__track--hit' : ''}${
          isGameOver ? ' story-loading-game__track--game-over' : ''
        }`}
        tabIndex={isGameOver ? -1 : 0}
        role="application"
        aria-label={t('workspace.miniGame.title')}
        style={
          {
            '--story-loading-game-road-offset': `${backgroundOffset * -1.04}px`,
            backgroundPosition: `${backgroundOffset * -0.38}px 0, ${backgroundOffset * -0.94}px 0, 0 0`,
          } as CSSProperties
        }
        onKeyDown={handleTrackKeyDown}
        onPointerDown={handleTrackPointerDown}
      >
        <span className="story-loading-game__lives-hearts" data-testid="story-loading-game-lives" aria-hidden="true">
          {Array.from({ length: LOADING_GAME_MAX_LIVES }, (_, lifeIndex) => (
            <span
              key={lifeIndex}
              className={`story-loading-game__life${lifeIndex < lives ? ' story-loading-game__life--active' : ''}`}
            >
              ♥
            </span>
          ))}
        </span>
        {Array.from({ length: LOADING_GAME_LANE_COUNT - 1 }, (_, dividerIndex) => (
          <span
            key={dividerIndex}
            className={`story-loading-game__lane-divider${
              (dividerIndex + 1) * 2 === LOADING_GAME_LANE_COUNT ? ' story-loading-game__lane-divider--center' : ''
            }`}
            style={{ top: `${((dividerIndex + 1) / LOADING_GAME_LANE_COUNT) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        <span
          className="story-loading-game__car"
          style={{
            left: `${carX}px`,
            top: `${carY}px`,
            width: `${LOADING_GAME_CAR_WIDTH}px`,
            height: `${LOADING_GAME_CAR_HEIGHT}px`,
          }}
          aria-hidden="true"
        >
          🚗
        </span>
        {obstacles.map((obstacle) => (
          <span
            key={obstacle.id}
            className={`story-loading-game__obstacle story-loading-game__obstacle--${obstacle.type}`}
            style={{
              left: `${obstacle.x}px`,
              top: `${laneHeight * (obstacle.lane + 0.5)}px`,
              width: `${LOADING_GAME_OBSTACLE_SIZE}px`,
              height: `${LOADING_GAME_OBSTACLE_SIZE}px`,
            }}
            aria-hidden="true"
          >
            {LOADING_GAME_OBSTACLE_ICONS[obstacle.type]}
          </span>
        ))}
        {isGameOver ? (
          <div className="story-loading-game__game-over" data-testid="story-loading-game-over" role="status" aria-live="polite">
            <strong>{t('workspace.miniGame.gameOverTitle')}</strong>
            <p>{t('workspace.miniGame.gameOverScore', { score })}</p>
            <button type="button" className="story-loading-game__retry-button" onClick={resetMiniGame}>
              {t('workspace.miniGame.retry')}
            </button>
          </div>
        ) : null}
      </div>
      <div className="story-loading-game__controls">
        <button
          type="button"
          className="story-loading-game__control-button"
          onClick={() => moveCar(-1)}
          aria-label={t('workspace.miniGame.moveUp')}
          disabled={isGameOver}
        >
          ▲
        </button>
        <button
          type="button"
          className="story-loading-game__control-button"
          onClick={() => moveCar(1)}
          aria-label={t('workspace.miniGame.moveDown')}
          disabled={isGameOver}
        >
          ▼
        </button>
        <p>{t('workspace.miniGame.controls')}</p>
      </div>
    </section>
  )
}

function StoryLoadingGameDialog() {
  const { t } = useTranslation()

  useBodyScrollLock()

  return (
    <motion.div
      className="story-loading-game-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={t('workspace.banner.processing')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <div className="story-loading-game-dialog__backdrop" data-testid="story-loading-game-backdrop" aria-hidden="true" />
      <motion.article
        className="story-loading-game-dialog__sheet"
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <StoryLoadingMiniGame />
      </motion.article>
    </motion.div>
  )
}

interface StoryComposerSectionProps {
  dependencies: StorybookWorkspaceDependencies
  auth?: StorybookWorkspaceAuth
  initialTitle: string
  initialAuthorName: string
  initialDescription: string
  initialIsPreserveOriginalDrawingStyle: boolean
  onDraftChange: (draft: {
    title: string
    authorName: string
    description: string
    isPreserveOriginalDrawingStyle: boolean
  }) => void
  onRequestAuthentication?: () => void
}

interface AuthGateDialogProps {
  onConfirm: () => void
  onCancel: () => void
}

function AuthGateDialog({ onConfirm, onCancel }: AuthGateDialogProps) {
  const { t } = useTranslation()

  useBodyScrollLock()

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      onCancel()
    }

    window.addEventListener('keydown', handleWindowKeyDown)

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [onCancel])

  return (
    <motion.div
      className="auth-gate-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
      aria-describedby="auth-gate-description"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <button
        type="button"
        className="auth-gate-dialog__backdrop"
        aria-label={t('workspace.authGate.close')}
        onClick={onCancel}
      />
      <motion.article
        className="auth-gate-dialog__sheet"
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.98 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <h3 id="auth-gate-title">{t('workspace.authGate.title')}</h3>
        <p id="auth-gate-description">{t('workspace.authGate.description')}</p>
        <div className="auth-gate-dialog__actions">
          <button type="button" className="auth-gate-dialog__action auth-gate-dialog__action--secondary" onClick={onCancel}>
            {t('workspace.authGate.cancel')}
          </button>
          <button type="button" className="auth-gate-dialog__action auth-gate-dialog__action--primary" onClick={onConfirm}>
            {t('workspace.authGate.confirm')}
          </button>
        </div>
      </motion.article>
    </motion.div>
  )
}

function StoryComposerSection({
  dependencies,
  auth,
  initialTitle,
  initialAuthorName,
  initialDescription,
  initialIsPreserveOriginalDrawingStyle,
  onDraftChange,
  onRequestAuthentication,
}: StoryComposerSectionProps) {
  const { i18n, t } = useTranslation()
  const createStatus = useStorybookCreationStore((state) => state.createStatus)
  const feedback = useStorybookCreationStore((state) => state.feedback)
  const startSubmitting = useStorybookCreationStore((state) => state.startSubmitting)
  const markSuccess = useStorybookCreationStore((state) => state.markSuccess)
  const markError = useStorybookCreationStore((state) => state.markError)
  const [readerBook, setReaderBook] = useState<StorybookReaderBook | null>(null)
  const [isAuthGateDialogOpen, setIsAuthGateDialogOpen] = useState(false)

  const useCase = useMemo(() => dependencies.createStorybookUseCase, [dependencies])
  const feedbackText = useMemo(() => resolveErrorFeedbackText(feedback, t), [feedback, t])
  const isSubmitting = createStatus === 'submitting'
  const closeReaderBook = useCallback(() => {
    setReaderBook(null)
  }, [])

  const requestAuthenticationForStoryCreation = useCallback(() => {
    setIsAuthGateDialogOpen(true)
  }, [])

  const closeAuthGateDialog = useCallback(() => {
    setIsAuthGateDialogOpen(false)
  }, [])

  const confirmAuthenticationRequest = useCallback(() => {
    setIsAuthGateDialogOpen(false)
    onRequestAuthentication?.()
  }, [onRequestAuthentication])

  return (
    <motion.section
      className="panel panel--compose"
      aria-labelledby="compose-panel-title"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
    >
      <div className="panel-header">
        <h2 id="compose-panel-title">{t('workspace.panels.compose.title')}</h2>
        <p>{t('workspace.panels.compose.description')}</p>
      </div>
      <StorybookDescriptionForm
        isSubmitting={isSubmitting}
        initialTitle={initialTitle}
        initialAuthorName={initialAuthorName}
        initialDescription={initialDescription}
        initialIsPreserveOriginalDrawingStyle={initialIsPreserveOriginalDrawingStyle}
        onDraftChange={onDraftChange}
        onSubmit={async ({ title, authorName, description, isPreserveOriginalDrawingStyle }) => {
          if (auth && !auth.userId) {
            requestAuthenticationForStoryCreation()
            return
          }

          setReaderBook(null)
          startSubmitting()

          const result = await useCase.execute({
            userId: auth?.userId ?? dependencies.currentUserId,
            title,
            description,
            language: resolveStoryLanguage(i18n.language),
            isPreserveOriginalDrawingStyle,
          })

          if (result.ok) {
            markSuccess(result.value.storybookId)
            const generatedPages = normalizeStorybookGeneratedPages(result.value.pages)
            const generatedImages = normalizeStorybookGeneratedImages(result.value.images)
            const generatedNarrations = normalizeStorybookGeneratedNarrations(result.value.narrations)

            if (generatedPages.length > 0) {
              setReaderBook({
                title: title.trim().length > 0 ? title.trim() : t('common.appName'),
                ...(authorName.length > 0 ? { authorName } : {}),
                pages: generatedPages,
                ...(generatedImages[0] ? { coverImage: generatedImages[0] } : {}),
                ...(generatedImages[1] ? { highlightImage: generatedImages[1] } : {}),
                ...(generatedImages[2] ? { finalImage: generatedImages[2] } : {}),
                ...(generatedNarrations.length > 0 ? { narrations: generatedNarrations } : {}),
              })
            }
          } else {
            markError(result.error.code)
          }
        }}
      />
      <AnimatePresence initial={false}>
        {feedbackText === null ? null : (
          <motion.p
            className="compose-feedback"
            aria-live="polite"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {feedbackText}
          </motion.p>
        )}
      </AnimatePresence>
      <div className="flow-group">
        <h3 className="flow-group__title">{t('workspace.flow.title')}</h3>
        <ol className="flow-step-list">
          {flowSteps.map((step) => {
            const Icon = step.icon

            return (
              <li key={step.key}>
                <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
                {t(`workspace.flow.${step.key}`)}
              </li>
            )
          })}
        </ol>
      </div>
      <AnimatePresence>
        {isAuthGateDialogOpen ? (
          <AuthGateDialog onCancel={closeAuthGateDialog} onConfirm={confirmAuthenticationRequest} />
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {readerBook ? <StorybookReaderDialog book={readerBook} onClose={closeReaderBook} /> : null}
      </AnimatePresence>
    </motion.section>
  )
}

function SubscriptionFooter() {
  const { t } = useTranslation()
  const createStatus = useStorybookCreationStore((state) => state.createStatus)
  const isSubmitting = createStatus === 'submitting'

  return (
    <motion.footer
      className="bottom-banner"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.16 }}
    >
      <p>
        {t('workspace.banner.prefix')} <strong>{t('workspace.banner.free')}</strong>{' '}
        {t('workspace.banner.and')} <strong>{t('workspace.banner.trial')}</strong>{' '}
        {t('workspace.banner.suffix')}
      </p>
      <button type="button" disabled={isSubmitting}>
        {isSubmitting ? t('workspace.banner.processing') : t('workspace.banner.cta')}
      </button>
    </motion.footer>
  )
}

interface StorybookWorkspaceProps {
  dependencies: StorybookWorkspaceDependencies
  auth?: StorybookWorkspaceAuth
  onRequestAuthentication?: () => void
}

export function StorybookWorkspace({ dependencies, auth, onRequestAuthentication }: StorybookWorkspaceProps) {
  const [draft, setDraft] = useState<StorybookWorkspaceDraft>(() => loadStorybookWorkspaceDraft())
  const [workspaceResetVersion, setWorkspaceResetVersion] = useState(0)
  const createStatus = useStorybookCreationStore((state) => state.createStatus)
  const isSubmitting = createStatus === 'submitting'

  useEffect(() => {
    saveStorybookWorkspaceDraft(draft)
  }, [draft])

  const resetWorkspaceDraft = useCallback(() => {
    clearStorybookWorkspaceDraft()
    setDraft(EMPTY_STORYBOOK_WORKSPACE_DRAFT)
    setWorkspaceResetVersion((previous) => previous + 1)
  }, [])

  const handleComposeDraftChange = useCallback(
    (nextDraft: {
      title: string
      authorName: string
      description: string
      isPreserveOriginalDrawingStyle: boolean
    }) => {
      setDraft((previous) => {
        if (
          previous.title === nextDraft.title &&
          previous.authorName === nextDraft.authorName &&
          previous.description === nextDraft.description &&
          previous.isPreserveOriginalDrawingStyle === nextDraft.isPreserveOriginalDrawingStyle
        ) {
          return previous
        }

        return {
          ...previous,
          title: nextDraft.title,
          authorName: nextDraft.authorName,
          description: nextDraft.description,
          isPreserveOriginalDrawingStyle: nextDraft.isPreserveOriginalDrawingStyle,
        }
      })
    },
    [],
  )

  const handleCanvasSnapshotChange = useCallback((nextCanvasDataUrl: string | null) => {
    setDraft((previous) => {
      if (previous.canvasDataUrl === nextCanvasDataUrl) {
        return previous
      }

      return {
        ...previous,
        canvasDataUrl: nextCanvasDataUrl,
      }
    })
  }, [])

  return (
    <div className="storybook-app">
      <AmbientBackdrop />
      <WorkspaceHeader
        auth={auth}
        onRequestAuthentication={onRequestAuthentication}
        onRequestWorkspaceReset={resetWorkspaceDraft}
      />
      <main className="layout-grid">
        <DrawingBoardSection
          key={`drawing-board-${workspaceResetVersion}`}
          initialCanvasDataUrl={draft.canvasDataUrl}
          onCanvasSnapshotChange={handleCanvasSnapshotChange}
        />
        <StoryComposerSection
          key={`story-composer-${workspaceResetVersion}`}
          dependencies={dependencies}
          auth={auth}
          initialTitle={draft.title}
          initialAuthorName={draft.authorName}
          initialDescription={draft.description}
          initialIsPreserveOriginalDrawingStyle={draft.isPreserveOriginalDrawingStyle}
          onDraftChange={handleComposeDraftChange}
          onRequestAuthentication={onRequestAuthentication}
        />
      </main>
      <SubscriptionFooter />
      <AnimatePresence>{isSubmitting ? <StoryLoadingGameDialog /> : null}</AnimatePresence>
    </div>
  )
}

export interface StorybookWorkspaceDependencies {
  readonly currentUserId: string
  readonly createStorybookUseCase: CreateStorybookUseCasePort
}
