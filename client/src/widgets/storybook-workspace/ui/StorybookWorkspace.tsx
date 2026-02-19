import { AnimatePresence, motion } from 'framer-motion'
import {
  AudioLines,
  BookOpenText,
  Eraser,
  Palette,
  PenLine,
  RotateCcw,
  Sparkles,
  WandSparkles,
  type LucideIcon,
} from 'lucide-react'
import { useMemo } from 'react'
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

const previewPages: ReadonlyArray<{ key: 'cover' | 'pageOne' | 'pageTwo' | 'pageThree'; tone: string }> = [
  { key: 'cover', tone: 'sunrise' },
  { key: 'pageOne', tone: 'sky' },
  { key: 'pageTwo', tone: 'mint' },
  { key: 'pageThree', tone: 'violet' },
]

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
      <div className="canvas-stage">
        <motion.div
          className="canvas-stage__surface"
          whileHover={{
            rotateX: 6,
            rotateY: -7,
            scale: 1.01,
          }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <div className="canvas-stage__badge">{t('workspace.canvas.ready')}</div>
        </motion.div>
        <motion.div
          className="canvas-stage__floating canvas-stage__floating--one"
          animate={{ y: [0, -8, 0], rotate: [0, 3, 0] }}
          transition={{ duration: 4.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        >
          {t('workspace.canvas.floatingOne')}
        </motion.div>
        <motion.div
          className="canvas-stage__floating canvas-stage__floating--two"
          animate={{ y: [0, -10, 0], rotate: [0, -3, 0] }}
          transition={{ duration: 4.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        >
          {t('workspace.canvas.floatingTwo')}
        </motion.div>
      </div>
      <ul className="tool-chip-list" aria-label={t('workspace.panels.canvas.title')}>
        {drawingTools.map((tool) => {
          const Icon = tool.icon

          return (
            <li className="tool-chip" key={tool.key}>
              <Icon className="tool-chip__icon" size={14} strokeWidth={2.3} aria-hidden="true" />
              {t(`workspace.tools.${tool.key}`)}
            </li>
          )
        })}
      </ul>
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

function BookshelfSection() {
  const { t } = useTranslation()

  return (
    <motion.section
      className="panel panel--bookshelf"
      aria-labelledby="bookshelf-panel-title"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
    >
      <div className="panel-header">
        <h2 id="bookshelf-panel-title">{t('workspace.panels.preview.title')}</h2>
        <p>{t('workspace.panels.preview.description')}</p>
      </div>
      <ul className="page-preview-list" aria-label={t('workspace.panels.preview.title')}>
        {previewPages.map((page, index) => (
          <motion.li
            className="page-preview-card"
            key={page.key}
            whileHover={{
              y: -4,
              rotateX: 2,
              rotateY: index % 2 === 0 ? 2 : -2,
            }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <div className={`page-preview-card__image page-preview-card__image--${page.tone}`}>
              <BookOpenText size={18} strokeWidth={2.1} aria-hidden="true" />
            </div>
            <div className="page-preview-card__text-group">
              <h3>{t(`workspace.preview.${page.key}Title`)}</h3>
              <p>{t(`workspace.preview.${page.key}Text`)}</p>
              <div className="page-preview-card__actions">
                <span>
                  <AudioLines size={13} strokeWidth={2.3} aria-hidden="true" />
                  {t('workspace.preview.listen')}
                </span>
                <span>
                  <WandSparkles size={13} strokeWidth={2.3} aria-hidden="true" />
                  {t('workspace.preview.open')}
                </span>
              </div>
            </div>
          </motion.li>
        ))}
      </ul>
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
        <BookshelfSection />
      </main>
      <SubscriptionFooter />
    </div>
  )
}

export interface StorybookWorkspaceDependencies {
  readonly currentUserId: string
  readonly createStorybookUseCase: CreateStorybookUseCasePort
}
