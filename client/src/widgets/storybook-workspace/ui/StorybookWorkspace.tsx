import { useMemo } from 'react'

import type { CreateStorybookUseCasePort } from '@features/storybook-creation/application/create-storybook.use-case'
import {
  selectRemainingFreeStories,
  useStorybookCreationStore,
} from '@features/storybook-creation/model/storybook-creation.store'
import { StorybookDescriptionForm } from '@features/storybook-creation/ui/StorybookDescriptionForm'

import './StorybookWorkspace.css'

const drawingTools = ['굵기', '색상', '투명도', '지우개', '실행취소']
const previewPages = ['표지', '1페이지', '2페이지', '3페이지']
const flowSteps = ['그림 그리기', '설명 입력', '동화 생성', '페이지 넘기기 + TTS']

function AmbientBackdrop() {
  return (
    <div className="ambient-layer" aria-hidden="true">
      <span className="orb orb--sunrise" />
      <span className="orb orb--mint" />
      <span className="orb orb--sky" />
    </div>
  )
}

function WorkspaceHeader() {
  const remainingFreeStories = useStorybookCreationStore(selectRemainingFreeStories)

  return (
    <header className="topbar">
      <div className="brand-block">
        <p className="brand-block__eyebrow">AI 그림책 제작 스튜디오</p>
        <h1 className="brand-block__title">뚝딱 그림책</h1>
        <p className="brand-block__subtitle">Doodle Storybook</p>
      </div>
      <ul className="status-list" aria-label="서비스 상태">
        <li className="status-item">
          <span className="status-item__label">무료 생성</span>
          <strong className="status-item__value">{remainingFreeStories}편 남음</strong>
        </li>
        <li className="status-item">
          <span className="status-item__label">체험</span>
          <strong className="status-item__value">1일</strong>
        </li>
        <li className="status-item">
          <span className="status-item__label">월 구독</span>
          <strong className="status-item__value">₩6,900</strong>
        </li>
      </ul>
    </header>
  )
}

function DrawingBoardSection() {
  return (
    <section className="panel panel--canvas" aria-labelledby="drawing-panel-title">
      <div className="panel-header">
        <h2 id="drawing-panel-title">그림판</h2>
        <p>모바일, 태블릿, PC 공통 레이아웃 기준</p>
      </div>
      <div className="canvas-stage">
        <p className="canvas-stage__hint">여기에 캔버스가 들어갑니다</p>
      </div>
      <ul className="tool-chip-list" aria-label="그림 도구 목록">
        {drawingTools.map((toolName) => (
          <li className="tool-chip" key={toolName}>
            {toolName}
          </li>
        ))}
      </ul>
    </section>
  )
}

interface StoryComposerSectionProps {
  dependencies: StorybookWorkspaceDependencies
}

function StoryComposerSection({ dependencies }: StoryComposerSectionProps) {
  const createStatus = useStorybookCreationStore((state) => state.createStatus)
  const feedback = useStorybookCreationStore((state) => state.feedbackMessage)
  const startSubmitting = useStorybookCreationStore((state) => state.startSubmitting)
  const markSuccess = useStorybookCreationStore((state) => state.markSuccess)
  const markError = useStorybookCreationStore((state) => state.markError)

  const useCase = useMemo(() => dependencies.createStorybookUseCase, [dependencies])

  return (
    <section className="panel panel--compose" aria-labelledby="compose-panel-title">
      <div className="panel-header">
        <h2 id="compose-panel-title">설명 입력</h2>
        <p>최대 500자, 이후 동화 생성 API 연결</p>
      </div>
      <StorybookDescriptionForm
        isSubmitting={createStatus === 'submitting'}
        onSubmit={async ({ description, language }) => {
          startSubmitting()

          const result = await useCase.execute({
            userId: dependencies.currentUserId,
            description,
            language,
          })

          if (result.ok) {
            markSuccess(result.value.storybookId)
          } else {
            markError(result.error.message)
          }
        }}
      />
      {feedback !== null ? (
        <p className="compose-feedback" aria-live="polite">
          {feedback}
        </p>
      ) : null}
      <ol className="flow-step-list">
        {flowSteps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  )
}

function BookshelfSection() {
  return (
    <section className="panel panel--bookshelf" aria-labelledby="bookshelf-panel-title">
      <div className="panel-header">
        <h2 id="bookshelf-panel-title">그림책 미리보기</h2>
        <p>페이지 플립 + TTS 영역</p>
      </div>
      <ul className="page-preview-list" aria-label="생성 페이지 미리보기">
        {previewPages.map((pageLabel) => (
          <li className="page-preview-card" key={pageLabel}>
            <div className="page-preview-card__image" aria-hidden="true" />
            <div className="page-preview-card__text-group">
              <h3>{pageLabel}</h3>
              <p>페이지 텍스트와 오디오 컨트롤이 여기에 배치됩니다.</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SubscriptionFooter() {
  const createStatus = useStorybookCreationStore((state) => state.createStatus)
  const isSubmitting = createStatus === 'submitting'

  return (
    <footer className="bottom-banner">
      <p>
        신규 회원은 <strong>무료 2편</strong> 또는 <strong>1일 체험</strong>으로 시작할 수 있어요.
      </p>
      <button type="button" disabled={isSubmitting}>
        {isSubmitting ? '동화 생성 처리 중...' : '1일 무료 사용 시작'}
      </button>
    </footer>
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
