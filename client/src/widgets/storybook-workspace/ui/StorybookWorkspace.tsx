import { AnimatePresence, motion } from 'framer-motion'
import {
  AudioLines,
  BookOpenText,
  BrushCleaning,
  Eraser,
  Grid3x3,
  Palette,
  PenLine,
  RotateCcw,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
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
  StorybookGeneratedPage,
} from '@features/storybook-creation/application/create-storybook.use-case'
import {
  selectRemainingFreeStories,
  useStorybookCreationStore,
} from '@features/storybook-creation/model/storybook-creation.store'
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
const LOADING_GAME_BASE_SPEED = 190
const LOADING_GAME_MAX_SPEED = 420
const LOADING_GAME_ACCELERATION_PER_SECOND = 10
const LOADING_GAME_BASE_SPAWN_INTERVAL = 1.3
const LOADING_GAME_MIN_SPAWN_INTERVAL = 0.48
const LOADING_GAME_CAR_X_RATIO = 0.22
const LOADING_GAME_CAR_WIDTH = 56
const LOADING_GAME_CAR_HEIGHT = 30
const LOADING_GAME_OBSTACLE_SIZE = 30
const LOADING_GAME_BACKGROUND_LOOP_WIDTH = 2400
const LOADING_GAME_INITIAL_TRACK_WIDTH = 640
const LOADING_GAME_INITIAL_TRACK_HEIGHT = 208
const STORYBOOK_COVER_FLIP_DURATION_MS = 760
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
  storybookId: string
  openaiResponseId: string | null
  promptVersion: string | null
  pages: StorybookGeneratedPage[]
  coverImage?: string
  highlightImage?: string
  finalImage?: string
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

function WorkspaceHeader() {
  const { t } = useTranslation()
  const remainingFreeStories = useStorybookCreationStore(selectRemainingFreeStories)

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
        <LanguageSwitcher />
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

function DrawingBoardSection() {
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
  const canvasStageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null)
  const undoSnapshotsRef = useRef<ImageData[]>([])
  const isDrawingRef = useRef(false)
  const strokeBaseSnapshotRef = useRef<ImageData | null>(null)
  const strokePointsRef = useRef<CanvasPoint[]>([])

  const pushUndoSnapshot = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvasContextRef.current

    if (!canvas || !context) {
      return null
    }

    // Save pre-stroke state so undo reverts one drawing action at a time.
    const snapshot = context.getImageData(0, 0, canvas.width, canvas.height)
    undoSnapshotsRef.current.push(snapshot)

    if (undoSnapshotsRef.current.length > MAX_CANVAS_UNDO_STEPS) {
      undoSnapshotsRef.current.shift()
    }

    setUndoDepth(undoSnapshotsRef.current.length)
    return snapshot
  }, [])

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

  const stopDrawing = useCallback((event?: ReactPointerEvent<HTMLCanvasElement>) => {
    if (
      event &&
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    isDrawingRef.current = false
    strokeBaseSnapshotRef.current = null
    strokePointsRef.current = []
  }, [])

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

    if (previousSnapshot.width !== canvas.width || previousSnapshot.height !== canvas.height) {
      context.clearRect(0, 0, canvas.width, canvas.height)
    } else {
      context.putImageData(previousSnapshot, 0, 0)
    }

    setUndoDepth(undoSnapshotsRef.current.length)
  }, [])

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
  }, [pushUndoSnapshot])

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

      if (!isUndoShortcut || undoDepth === 0) {
        return
      }

      event.preventDefault()
      handleUndo()
    },
    [handleUndo, undoDepth],
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
      setUndoDepth(0)
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
    if (activeToolMode !== 'eraser') {
      hideEraserPreview()
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

function resolveFeedbackText(
  feedback: ReturnType<typeof useStorybookCreationStore.getState>['feedback'],
  t: (key: string, options?: Record<string, unknown>) => string,
): string | null {
  if (feedback === null) {
    return null
  }

  if (feedback.kind === 'success') {
    return t('workspace.feedback.success', { id: feedback.storybookId })
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

interface StorybookReaderDialogProps {
  book: StorybookReaderBook
  onClose: () => void
}

function StorybookReaderDialog({ book, onClose }: StorybookReaderDialogProps) {
  const [isCoverOpened, setIsCoverOpened] = useState(false)
  const [isCoverFlipping, setIsCoverFlipping] = useState(false)
  const [activePageIndex, setActivePageIndex] = useState(0)
  const coverFlipTimeoutRef = useRef<number | null>(null)

  const totalPages = book.pages.length
  const currentPage = totalPages > 0 ? book.pages[activePageIndex] : null
  const currentPageImage = currentPage
    ? resolveReaderPageImage(currentPage, activePageIndex, totalPages, book.highlightImage, book.finalImage)
    : undefined
  const canGoPreviousPage = isCoverOpened && activePageIndex > 0
  const canGoNextPage = isCoverOpened && activePageIndex < totalPages - 1

  const clearCoverFlipTimeout = useCallback(() => {
    if (coverFlipTimeoutRef.current === null) {
      return
    }

    window.clearTimeout(coverFlipTimeoutRef.current)
    coverFlipTimeoutRef.current = null
  }, [])

  const handleOpenCover = useCallback(() => {
    if (isCoverOpened || isCoverFlipping) {
      return
    }

    clearCoverFlipTimeout()
    setIsCoverFlipping(true)
    coverFlipTimeoutRef.current = window.setTimeout(() => {
      setIsCoverOpened(true)
      setIsCoverFlipping(false)
      setActivePageIndex(0)
      coverFlipTimeoutRef.current = null
    }, STORYBOOK_COVER_FLIP_DURATION_MS)
  }, [clearCoverFlipTimeout, isCoverFlipping, isCoverOpened])

  const handleGoPreviousPage = useCallback(() => {
    setActivePageIndex((previous) => Math.max(0, previous - 1))
  }, [])

  const handleGoNextPage = useCallback(() => {
    setActivePageIndex((previous) => Math.min(totalPages - 1, previous + 1))
  }, [totalPages])

  useEffect(() => {
    setIsCoverOpened(false)
    setIsCoverFlipping(false)
    setActivePageIndex(0)

    return () => {
      clearCoverFlipTimeout()
    }
  }, [book.storybookId, clearCoverFlipTimeout])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (!isCoverOpened || totalPages === 0) {
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        handleGoPreviousPage()
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        handleGoNextPage()
      }
    }

    window.addEventListener('keydown', handleWindowKeyDown)
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [handleGoNextPage, handleGoPreviousPage, isCoverOpened, onClose, totalPages])

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
        onClick={onClose}
      />
      <div className="storybook-reader-dialog__sheet">
        <header className="storybook-reader-dialog__header">
          <div className="storybook-reader-dialog__header-copy">
            <p className="storybook-reader-dialog__eyebrow">
              {book.promptVersion ? `Prompt v${book.promptVersion}` : 'Generated storybook'}
            </p>
            <h2>{book.title}</h2>
            <p>
              #{book.storybookId}
              {book.openaiResponseId ? ` · ${book.openaiResponseId}` : ''}
            </p>
          </div>
          <button type="button" className="storybook-reader-dialog__close" onClick={onClose}>
            닫기
          </button>
        </header>
        <div className="storybook-reader-dialog__stage">
          {!isCoverOpened ? (
            <button
              type="button"
              className={`storybook-cover${isCoverFlipping ? ' storybook-cover--flipping' : ''}`}
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
                <strong>{book.title}</strong>
                <small>{isCoverFlipping ? '책장을 넘기는 중...' : '표지를 눌러서 첫 장으로 넘어가요'}</small>
              </span>
            </button>
          ) : currentPage ? (
            <motion.article
              key={currentPage.page}
              className="storybook-reader-page"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {currentPageImage ? (
                <figure className="storybook-reader-page__figure">
                  <img src={currentPageImage} alt={`${currentPage.page}페이지 삽화`} />
                </figure>
              ) : null}
              <div className="storybook-reader-page__body">
                <p className="storybook-reader-page__label">
                  Page {currentPage.page}
                  {currentPage.isHighlight ? ' · Highlight' : ''}
                </p>
                <p className="storybook-reader-page__content">{currentPage.content}</p>
              </div>
            </motion.article>
          ) : (
            <div className="storybook-reader-page__empty">
              <p>표시할 페이지가 아직 없어요.</p>
            </div>
          )}
        </div>
        {isCoverOpened && totalPages > 0 ? (
          <footer className="storybook-reader-dialog__footer">
            <button type="button" onClick={handleGoPreviousPage} disabled={!canGoPreviousPage}>
              이전
            </button>
            <p>
              {activePageIndex + 1} / {totalPages}
            </p>
            <button type="button" onClick={handleGoNextPage} disabled={!canGoNextPage}>
              다음
            </button>
          </footer>
        ) : null}
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
  const carLaneRef = useRef(1)
  const trackMetricsRef = useRef<LoadingGameTrackMetrics>({
    width: LOADING_GAME_INITIAL_TRACK_WIDTH,
    height: LOADING_GAME_INITIAL_TRACK_HEIGHT,
  })
  const obstaclesRef = useRef<LoadingGameObstacle[]>([])
  const hitTimeoutRef = useRef<number | null>(null)
  const [carLane, setCarLane] = useState(1)
  const [speed, setSpeed] = useState(LOADING_GAME_BASE_SPEED)
  const [score, setScore] = useState(0)
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
    const intervalId = window.setInterval(() => {
      const deltaSeconds = LOADING_GAME_TICK_MS / 1000
      const nextSpeed = Math.min(
        LOADING_GAME_MAX_SPEED,
        speedRef.current + LOADING_GAME_ACCELERATION_PER_SECOND * deltaSeconds,
      )
      const carCenterX = trackMetricsRef.current.width * LOADING_GAME_CAR_X_RATIO
      const carHalfWidth = LOADING_GAME_CAR_WIDTH * 0.5

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
        className={`story-loading-game__track${isHit ? ' story-loading-game__track--hit' : ''}`}
        tabIndex={0}
        role="application"
        aria-label={t('workspace.miniGame.title')}
        style={{
          backgroundPosition: `${backgroundOffset * -0.72}px 0, ${backgroundOffset * -1.28}px 0, 0 0`,
        }}
        onKeyDown={handleTrackKeyDown}
        onPointerDown={handleTrackPointerDown}
      >
        {Array.from({ length: LOADING_GAME_LANE_COUNT - 1 }, (_, dividerIndex) => (
          <span
            key={dividerIndex}
            className="story-loading-game__lane-divider"
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
      </div>
      <div className="story-loading-game__controls">
        <button type="button" className="story-loading-game__control-button" onClick={() => moveCar(-1)} aria-label={t('workspace.miniGame.moveUp')}>
          ▲
        </button>
        <button type="button" className="story-loading-game__control-button" onClick={() => moveCar(1)} aria-label={t('workspace.miniGame.moveDown')}>
          ▼
        </button>
        <p>{t('workspace.miniGame.controls')}</p>
      </div>
    </section>
  )
}

interface StoryComposerSectionProps {
  dependencies: StorybookWorkspaceDependencies
}

function StoryComposerSection({ dependencies }: StoryComposerSectionProps) {
  const { i18n, t } = useTranslation()
  const createStatus = useStorybookCreationStore((state) => state.createStatus)
  const feedback = useStorybookCreationStore((state) => state.feedback)
  const startSubmitting = useStorybookCreationStore((state) => state.startSubmitting)
  const markSuccess = useStorybookCreationStore((state) => state.markSuccess)
  const markError = useStorybookCreationStore((state) => state.markError)
  const [readerBook, setReaderBook] = useState<StorybookReaderBook | null>(null)

  const useCase = useMemo(() => dependencies.createStorybookUseCase, [dependencies])
  const feedbackText = useMemo(() => resolveFeedbackText(feedback, t), [feedback, t])
  const isSubmitting = createStatus === 'submitting'
  const closeReaderBook = useCallback(() => {
    setReaderBook(null)
  }, [])

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
        onSubmit={async ({ title, description }) => {
          setReaderBook(null)
          startSubmitting()

          const result = await useCase.execute({
            userId: dependencies.currentUserId,
            title,
            description,
            language: resolveStoryLanguage(i18n.language),
          })

          if (result.ok) {
            markSuccess(result.value.storybookId)
            const generatedPages = normalizeStorybookGeneratedPages(result.value.pages)
            const generatedImages = normalizeStorybookGeneratedImages(result.value.images)

            if (generatedPages.length > 0) {
              setReaderBook({
                title: title.trim().length > 0 ? title.trim() : t('common.appName'),
                storybookId: result.value.storybookId,
                openaiResponseId:
                  typeof result.value.openaiResponseId === 'string' ? result.value.openaiResponseId : null,
                promptVersion:
                  typeof result.value.promptVersion === 'string' ? result.value.promptVersion : null,
                pages: generatedPages,
                ...(generatedImages[0] ? { coverImage: generatedImages[0] } : {}),
                ...(generatedImages[1] ? { highlightImage: generatedImages[1] } : {}),
                ...(generatedImages[2] ? { finalImage: generatedImages[2] } : {}),
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
      {isSubmitting ? (
        <StoryLoadingMiniGame />
      ) : (
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
      )}
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
}

export function StorybookWorkspace({ dependencies }: StorybookWorkspaceProps) {
  return (
    <div className="storybook-app">
      <AmbientBackdrop />
      <WorkspaceHeader />
      <main className="layout-grid">
        <DrawingBoardSection />
        <StoryComposerSection dependencies={dependencies} />
      </main>
      <SubscriptionFooter />
    </div>
  )
}

export interface StorybookWorkspaceDependencies {
  readonly currentUserId: string
  readonly createStorybookUseCase: CreateStorybookUseCasePort
}
