import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useStorybookCreationStore } from '@features/storybook-creation/model/storybook-creation.store'
import {
  StorybookWorkspace,
  type StorybookWorkspaceDependencies,
} from '@widgets/storybook-workspace/ui/StorybookWorkspace'

describe('StorybookWorkspace', () => {
  beforeEach(() => {
    useStorybookCreationStore.getState().reset()
  })

  it('동화 생성 성공 시 피드백 메시지를 출력한다', async () => {
    const user = userEvent.setup()
    const execute = vi.fn(async () => ({
      ok: true as const,
      value: { storybookId: 'storybook-101' },
    }))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute,
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    expect(screen.getByText('2편 남음')).toBeInTheDocument()

    await user.type(screen.getByLabelText('그림 설명'), '달빛 아래에서 캠핑을 해요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(execute).toHaveBeenCalledWith({
      userId: 'user-1',
      description: '달빛 아래에서 캠핑을 해요',
      language: 'ko',
    })
    expect(screen.getByText('동화 생성 요청 완료 · #storybook-101')).toBeInTheDocument()
    expect(screen.getByText('1편 남음')).toBeInTheDocument()
  })

  it('생성 진행 중에는 하단 CTA 버튼을 비활성화한다', async () => {
    const user = userEvent.setup()
    let resolveRequest!: (value: { ok: true; value: { storybookId: string } }) => void
    const pending = new Promise<{ ok: true; value: { storybookId: string } }>((resolve) => {
      resolveRequest = resolve
    })

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(() => pending),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.type(screen.getByLabelText('그림 설명'), '숲속에서 친구를 만나요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    const pendingButton = screen.getByRole('button', { name: '동화 생성 처리 중...' })
    expect(pendingButton).toBeDisabled()

    resolveRequest({ ok: true, value: { storybookId: 'storybook-200' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1일 무료 사용 시작' })).toBeEnabled()
    })
  })

  it('생성 실패 시 다국어 오류 피드백을 보여준다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: false as const,
          error: {
            code: 'QUOTA_EXCEEDED' as const,
            message: '무료 생성 한도를 초과했습니다. 구독 후 이용해 주세요.',
          },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.type(screen.getByLabelText('그림 설명'), '숲속에서 마법 지팡이를 찾았어요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(
      screen.getByText('무료 제작 횟수를 모두 사용했어요. 구독 후 계속 만들 수 있어요.'),
    ).toBeInTheDocument()
  })

  it('그리드 토글 버튼으로 캔버스 격자 표시를 전환한다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-320' },
        })),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const surface = container.querySelector('.canvas-stage__surface')

    expect(surface).not.toBeNull()
    expect(surface).not.toHaveClass('canvas-stage__surface--plain')

    const toggleButton = screen.getByRole('button', { name: '그리드 끄기' })
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true')
    expect(toggleButton).toHaveAttribute('title', '그리드 끄기')

    await user.click(toggleButton)

    expect(toggleButton).toHaveAttribute('aria-label', '그리드 켜기')
    expect(toggleButton).toHaveAttribute('title', '그리드 켜기')
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false')
    expect(surface).toHaveClass('canvas-stage__surface--plain')

    await user.click(toggleButton)

    expect(toggleButton).toHaveAttribute('aria-label', '그리드 끄기')
    expect(toggleButton).toHaveAttribute('title', '그리드 끄기')
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true')
    expect(surface).not.toHaveClass('canvas-stage__surface--plain')
  })

  it('라이브 북 미리보기 섹션을 렌더링하지 않는다', () => {
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-330' },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    expect(screen.queryByRole('heading', { name: '라이브 북 미리보기' })).not.toBeInTheDocument()
  })

  it('지구본 언어 설정으로 전체 UI 문구가 바뀐다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-300' },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.selectOptions(screen.getByLabelText('언어'), 'en')

    await waitFor(() => {
      expect(screen.getByText('Free stories')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create Storybook' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Start 1-day free trial' })).toBeInTheDocument()
    })
  })
})
