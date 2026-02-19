import { AnimatePresence, motion } from 'framer-motion'
import {
  AudioLines,
  BookOpenText,
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
import type { CreateStorybookUseCasePort } from '@features/storybook-creation/application/create-storybook.use-case'
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

interface CanvasPoint {
  x: number
  y: number
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

function resolveCanvasOpacity(opacity: number): number {
  return clampPenOpacity(opacity) / 100
}

function configureCanvasContext(
  canvas: HTMLCanvasElement,
  penWidth: number,
  penColor: string,
  penOpacity: number,
): CanvasRenderingContext2D | null {
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  const bounds = canvas.getBoundingClientRect()
  const scale = bounds.width === 0 ? 1 : canvas.width / bounds.width

  context.strokeStyle = penColor
  context.fillStyle = penColor
  context.lineWidth = penWidth * scale
  context.globalAlpha = resolveCanvasOpacity(penOpacity)
  context.lineCap = 'round'
  context.lineJoin = 'round'

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
  return (
    <div className="ambient-layer" aria-hidden="true">
      <span className="orb orb--sunrise" />
      <span className="orb orb--mint" />
      <span className="orb orb--sky" />
      <span className="ambient-grid" />
    </div>
  )
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
        <h1 className="brand-block__title">{t('common.appName')}</h1>
        <p className="brand-block__subtitle">{t('common.appSubtitle')}</p>
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
  const [isGridVisible, setIsGridVisible] = useState(true)
  const [penColor, setPenColor] = useState(DEFAULT_PEN_COLOR)
  const [penWidth, setPenWidth] = useState(DEFAULT_PEN_WIDTH)
  const [penOpacity, setPenOpacity] = useState(DEFAULT_PEN_OPACITY)
  const [isPenWidthPanelOpen, setIsPenWidthPanelOpen] = useState(false)
  const [isPenColorPanelOpen, setIsPenColorPanelOpen] = useState(false)
  const [isPenOpacityPanelOpen, setIsPenOpacityPanelOpen] = useState(false)
  const [undoDepth, setUndoDepth] = useState(0)
  const canvasStageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null)
  const undoSnapshotsRef = useRef<ImageData[]>([])
  const isDrawingRef = useRef(false)
  const previousPointRef = useRef<CanvasPoint | null>(null)

  const pushUndoSnapshot = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvasContextRef.current

    if (!canvas || !context) {
      return
    }

    // Save pre-stroke state so undo reverts one drawing action at a time.
    const snapshot = context.getImageData(0, 0, canvas.width, canvas.height)
    undoSnapshotsRef.current.push(snapshot)

    if (undoSnapshotsRef.current.length > MAX_CANVAS_UNDO_STEPS) {
      undoSnapshotsRef.current.shift()
    }

    setUndoDepth(undoSnapshotsRef.current.length)
  }, [])

  const stopDrawing = useCallback((event?: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    isDrawingRef.current = false
    previousPointRef.current = null
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

  const updatePenWidth = useCallback((nextWidth: number) => {
    setPenWidth(clampPenWidth(nextWidth))
  }, [])

  const updatePenOpacity = useCallback((nextOpacity: number) => {
    setPenOpacity(clampPenOpacity(nextOpacity))
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

  const togglePenWidthPanel = useCallback(() => {
    setIsPenWidthPanelOpen((previous) => !previous)
    setIsPenColorPanelOpen(false)
    setIsPenOpacityPanelOpen(false)
  }, [])

  const togglePenColorPanel = useCallback(() => {
    setIsPenColorPanelOpen((previous) => !previous)
    setIsPenWidthPanelOpen(false)
    setIsPenOpacityPanelOpen(false)
  }, [])

  const togglePenOpacityPanel = useCallback(() => {
    setIsPenOpacityPanelOpen((previous) => !previous)
    setIsPenWidthPanelOpen(false)
    setIsPenColorPanelOpen(false)
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

      pushUndoSnapshot()

      const nextPoint = resolveCanvasPoint(canvas, event.clientX, event.clientY)

      isDrawingRef.current = true
      previousPointRef.current = nextPoint
      event.currentTarget.setPointerCapture(event.pointerId)
      event.currentTarget.focus({ preventScroll: true })

      context.beginPath()
      context.arc(nextPoint.x, nextPoint.y, context.lineWidth * 0.5, 0, Math.PI * 2)
      context.fill()
      context.beginPath()
      context.moveTo(nextPoint.x, nextPoint.y)

      event.preventDefault()
    },
    [pushUndoSnapshot],
  )

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return
    }

    const canvas = canvasRef.current
    const context = canvasContextRef.current
    const previousPoint = previousPointRef.current

    if (!canvas || !context || previousPoint === null) {
      return
    }

    const nextPoint = resolveCanvasPoint(canvas, event.clientX, event.clientY)

    context.beginPath()
    context.moveTo(previousPoint.x, previousPoint.y)
    context.lineTo(nextPoint.x, nextPoint.y)
    context.stroke()

    previousPointRef.current = nextPoint
    event.preventDefault()
  }, [])

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
        canvasContextRef.current = configureCanvasContext(canvas, penWidth, penColor, penOpacity)
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

      const context = configureCanvasContext(canvas, penWidth, penColor, penOpacity)
      canvasContextRef.current = context

      if (context && previousBitmap.width > 0 && previousBitmap.height > 0) {
        const nextGlobalAlpha = context.globalAlpha
        context.globalAlpha = 1
        context.drawImage(previousBitmap, 0, 0, previousBitmap.width, previousBitmap.height, 0, 0, canvas.width, canvas.height)
        context.globalAlpha = nextGlobalAlpha
      }

      undoSnapshotsRef.current = []
      setUndoDepth(0)
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
  }, [penColor, penOpacity, penWidth])

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvasContextRef.current

    if (!canvas || !context) {
      return
    }

    const bounds = canvas.getBoundingClientRect()
    const scale = bounds.width === 0 ? 1 : canvas.width / bounds.width

    context.lineWidth = penWidth * scale
    context.strokeStyle = penColor
    context.fillStyle = penColor
    context.globalAlpha = resolveCanvasOpacity(penOpacity)
  }, [penColor, penOpacity, penWidth])

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
          className={`canvas-stage__surface${isGridVisible ? '' : ' canvas-stage__surface--plain'}`}
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerCancel={stopDrawing}
          onKeyDown={handleCanvasKeyDown}
        />
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

  const useCase = useMemo(() => dependencies.createStorybookUseCase, [dependencies])
  const feedbackText = useMemo(() => resolveFeedbackText(feedback, t), [feedback, t])

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
        isSubmitting={createStatus === 'submitting'}
        onSubmit={async ({ description }) => {
          startSubmitting()

          const result = await useCase.execute({
            userId: dependencies.currentUserId,
            description,
            language: resolveStoryLanguage(i18n.language),
          })

          if (result.ok) {
            markSuccess(result.value.storybookId)
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
