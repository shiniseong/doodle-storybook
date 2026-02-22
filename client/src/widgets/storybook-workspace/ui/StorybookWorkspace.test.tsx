import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SubscriptionAccessSnapshot } from '@features/subscription-access/application/subscription-access.use-case'
import { useStorybookCreationStore } from '@features/storybook-creation/model/storybook-creation.store'
import { STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY } from '@features/storybook-creation/model/storybook-compose-draft.storage'
import {
  StorybookWorkspace,
  type StorybookWorkspaceAuth,
  type StorybookWorkspaceDependencies,
} from '@widgets/storybook-workspace/ui/StorybookWorkspace'

type CreateStorybookExecuteResult = Awaited<
  ReturnType<StorybookWorkspaceDependencies['createStorybookUseCase']['execute']>
>

function createSuccessfulCreateResult(storybookId: string): CreateStorybookExecuteResult {
  return {
    ok: true,
    value: {
      storybookId,
      storybook: {
        storybookId,
        title: storybookId,
        authorName: null,
        description: '',
        originImageUrl: null,
        createdAt: null,
      },
      details: {
        origin: [],
        output: [],
      },
      ebook: {
        title: storybookId,
        authorName: null,
        coverImageUrl: null,
        highlightImageUrl: null,
        finalImageUrl: null,
        pages: [],
        narrations: [],
      },
    },
  }
}

function createMockCanvasContext(width: number, height: number): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    })),
    putImageData: vi.fn(),
    strokeStyle: '#184867',
    fillStyle: '#184867',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineWidth: 3,
    lineCap: 'round',
    lineJoin: 'round',
  } as unknown as CanvasRenderingContext2D
}

function createFixedDomRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

function createMockAuth(overrides: Partial<StorybookWorkspaceAuth> = {}): StorybookWorkspaceAuth {
  return {
    isConfigured: true,
    isLoading: false,
    isSigningIn: false,
    userId: 'user-1',
    userEmail: 'user-1@example.com',
    signOut: vi.fn(async () => {}),
    ...overrides,
  }
}

function createSubscriptionSnapshot(overrides: Partial<SubscriptionAccessSnapshot> = {}): SubscriptionAccessSnapshot {
  const base: SubscriptionAccessSnapshot = {
    subscription: null,
    quota: {
      freeStoryQuotaTotal: 2,
      freeStoryQuotaUsed: 0,
      remainingFreeStories: 2,
      dailyQuotaLimit: null,
      dailyQuotaUsed: 0,
      remainingDailyStories: null,
      dailyQuotaDateKst: null,
    },
    currentPlan: {
      code: 'free',
      name: 'Free',
    },
    plans: [
      {
        code: 'free',
        name: 'Free',
        priceUsdMonthly: 0,
        totalFreeStories: 2,
      },
      {
        code: 'standard',
        name: 'Standard',
        priceUsdMonthly: 4.99,
        dailyQuota: 30,
        trialDays: 1,
      },
      {
        code: 'pro',
        name: 'Pro',
        priceUsdMonthly: 8.99,
        dailyQuota: 60,
        trialDays: 1,
      },
    ],
    canCreate: true,
  }

  return {
    ...base,
    ...overrides,
    subscription: typeof overrides.subscription === 'undefined' ? base.subscription : overrides.subscription,
    quota: {
      ...base.quota,
      ...(overrides.quota ?? {}),
    },
    currentPlan: {
      ...base.currentPlan,
      ...(overrides.currentPlan ?? {}),
    },
    plans: overrides.plans ?? base.plans,
  }
}

describe('StorybookWorkspace', () => {
  beforeEach(() => {
    useStorybookCreationStore.getState().reset()
    window.sessionStorage.removeItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY)
    window.sessionStorage.setItem(
      STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY,
      JSON.stringify({
        title: '',
        authorName: '테스트 작가',
        description: '',
        canvasDataUrl: null,
      }),
    )
    document.body.style.overflow = ''
  })

  it('동화 생성 성공 시 uuid 디버그 메시지를 노출하지 않는다', async () => {
    const user = userEvent.setup()
    const execute = vi.fn(async () => (createSuccessfulCreateResult('storybook-101')))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute,
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    expect(screen.getByText('2편 남음')).toBeInTheDocument()

    await user.type(screen.getByLabelText('동화 제목'), '달빛 캠핑')
    await user.type(screen.getByLabelText('그림 설명'), '달빛 아래에서 캠핑을 해요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(execute).toHaveBeenCalledWith({
      userId: 'user-1',
      title: '달빛 캠핑',
      authorName: '테스트 작가',
      description: '달빛 아래에서 캠핑을 해요',
      language: 'ko',
    })
    expect(screen.queryByText('동화 생성 요청 완료 · #storybook-101')).not.toBeInTheDocument()
    expect(screen.getByText('1편 남음')).toBeInTheDocument()
  })

  it('로그인하지 않은 상태에서 생성을 누르면 확인 다이얼로그를 띄우고 취소 시 생성하지 않는다', async () => {
    const user = userEvent.setup()
    const execute = vi.fn(async () => (createSuccessfulCreateResult('storybook-need-auth')))
    const requestAuthentication = vi.fn()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'guest-user',
      createStorybookUseCase: {
        execute,
      },
    }

    render(
      <StorybookWorkspace
        dependencies={dependencies}
        auth={createMockAuth({
          userId: null,
          userEmail: null,
        })}
        onRequestAuthentication={requestAuthentication}
      />,
    )

    await user.type(screen.getByLabelText('동화 제목'), '로그인 필요')
    await user.type(screen.getByLabelText('그림 설명'), '로그인 전에 입력한 설명')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))
    expect(screen.getByRole('dialog', { name: '로그인이 필요해요' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '계속 작업할게요' }))

    expect(execute).not.toHaveBeenCalled()
    expect(requestAuthentication).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '로그인이 필요해요' })).not.toBeInTheDocument()
    })
  })

  it('로그인하지 않은 상태에서 확인하면 로그인 페이지 이동 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const execute = vi.fn(async () => (createSuccessfulCreateResult('storybook-need-auth-2')))
    const requestAuthentication = vi.fn()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'guest-user',
      createStorybookUseCase: {
        execute,
      },
    }

    render(
      <StorybookWorkspace
        dependencies={dependencies}
        auth={createMockAuth({
          userId: null,
          userEmail: null,
        })}
        onRequestAuthentication={requestAuthentication}
      />,
    )

    await user.type(screen.getByLabelText('동화 제목'), '로그인 이동')
    await user.type(screen.getByLabelText('그림 설명'), '승인 시 로그인 페이지로 이동')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))
    expect(screen.getByRole('dialog', { name: '로그인이 필요해요' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '로그인/가입 페이지로 이동' }))

    expect(execute).not.toHaveBeenCalled()
    expect(requestAuthentication).toHaveBeenCalledTimes(1)
  })

  it('제작 플로우 바로가기 버튼을 누르면 내 그림동화 이동 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const navigateToLibrary = vi.fn()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-library-shortcut'))),
      },
    }

    render(
      <StorybookWorkspace
        dependencies={dependencies}
        auth={createMockAuth({
          userId: 'signed-in-user',
          userEmail: 'signed-in-user@example.com',
        })}
        onNavigateToLibrary={navigateToLibrary}
      />,
    )

    await user.click(screen.getByRole('button', { name: '(바로가기)' }))

    expect(navigateToLibrary).toHaveBeenCalledTimes(1)
  })

  it('비로그인 상태에서 제작 플로우 바로가기 버튼을 누르면 인증 이동 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const requestAuthentication = vi.fn()
    const navigateToLibrary = vi.fn()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'guest-user',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-library-shortcut-auth'))),
      },
    }

    render(
      <StorybookWorkspace
        dependencies={dependencies}
        auth={createMockAuth({
          userId: null,
          userEmail: null,
        })}
        onRequestAuthentication={requestAuthentication}
        onNavigateToLibrary={navigateToLibrary}
      />,
    )

    await user.click(screen.getByRole('button', { name: '(바로가기)' }))

    expect(navigateToLibrary).not.toHaveBeenCalled()
    expect(requestAuthentication).toHaveBeenCalledTimes(1)
  })

  it('우측 상단 로그인 버튼을 누르면 로그인/가입 페이지 이동 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const requestAuthentication = vi.fn()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'guest-user',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-header-auth'))),
      },
    }

    render(
      <StorybookWorkspace
        dependencies={dependencies}
        auth={createMockAuth({
          userId: null,
          userEmail: null,
        })}
        onRequestAuthentication={requestAuthentication}
      />,
    )

    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(requestAuthentication).toHaveBeenCalledTimes(1)
  })

  it('워크스페이스를 다시 열어도 제목과 설명 초안이 유지된다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-draft-1'))),
      },
    }

    const { unmount } = render(<StorybookWorkspace dependencies={dependencies} />)

    await user.type(screen.getByLabelText('동화 제목'), '보관할 제목')
    await user.type(screen.getByLabelText('그림 설명'), '보관할 설명')

    unmount()

    render(<StorybookWorkspace dependencies={dependencies} />)

    expect(screen.getByLabelText('동화 제목')).toHaveValue('보관할 제목')
    expect(screen.getByLabelText('그림 설명')).toHaveValue('보관할 설명')
  })

  it('로그아웃 버튼 클릭 시 저장된 draft와 입력값을 초기화한다', async () => {
    const user = userEvent.setup()
    const signOut = vi.fn(async () => {})
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-reset-on-logout'))),
      },
    }

    render(
      <StorybookWorkspace
        dependencies={dependencies}
        auth={createMockAuth({
          userId: 'signed-in-user',
          userEmail: 'signed-in-user@example.com',
          signOut,
        })}
      />,
    )

    await user.type(screen.getByLabelText('동화 제목'), '로그아웃 이전 제목')
    await user.type(screen.getByLabelText('지은이'), '로그아웃 이전 작가')
    await user.type(screen.getByLabelText('그림 설명'), '로그아웃 이전 설명')

    await waitFor(() => {
      const raw = window.sessionStorage.getItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY)
      expect(raw).not.toBeNull()
      expect(raw).toContain('로그아웃 이전 제목')
    })

    await user.click(screen.getByRole('button', { name: /signed-in-user/i }))
    await user.click(screen.getByRole('menuitem', { name: '로그아웃' }))
    expect(signOut).toHaveBeenCalledTimes(1)

    await waitFor(() => {
      expect(screen.getByLabelText('동화 제목')).toHaveValue('')
      expect(screen.getByLabelText('지은이')).toHaveValue('')
      expect(screen.getByLabelText('그림 설명')).toHaveValue('')
      expect(window.sessionStorage.getItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY)).toBeNull()
    })
  })

  it('생성 진행 중에는 로딩 다이얼로그를 유지하고 닫힘 입력을 무시한다', async () => {
    const user = userEvent.setup()
    let resolveRequest!: (value: CreateStorybookExecuteResult) => void
    const pending = new Promise<CreateStorybookExecuteResult>((resolve) => {
      resolveRequest = resolve
    })

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(() => pending),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.type(screen.getByLabelText('동화 제목'), '숲속 친구')
    await user.type(screen.getByLabelText('그림 설명'), '숲속에서 친구를 만나요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(screen.getByRole('dialog', { name: '동화 생성 처리 중...' })).toBeInTheDocument()
    expect(screen.getByTestId('story-loading-mini-game')).toBeInTheDocument()
    expect(screen.getByTestId('story-loading-game-backdrop')).toBeInTheDocument()
    const gameTrack = screen.getByRole('application', { name: '기다리는 동안 미니 게임' })
    await waitFor(() => {
      expect(gameTrack).toHaveFocus()
    })
    expect(document.querySelectorAll('.story-loading-game__life--active')).toHaveLength(2)
    expect(screen.queryByTestId('story-loading-game-over')).not.toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: '동화 생성 처리 중...' })).toBeInTheDocument()

    await user.click(screen.getByTestId('story-loading-game-backdrop'))
    expect(screen.getByRole('dialog', { name: '동화 생성 처리 중...' })).toBeInTheDocument()

    resolveRequest(createSuccessfulCreateResult('storybook-200'))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '동화 생성 처리 중...' })).not.toBeInTheDocument()
      expect(screen.queryByTestId('story-loading-mini-game')).not.toBeInTheDocument()
    })
  })

  it('생성 로딩 다이얼로그와 이북 다이얼로그가 연속으로 열려도 body 스크롤 락을 해제한다', async () => {
    const user = userEvent.setup()
    let resolveRequest!: (value: CreateStorybookExecuteResult) => void
    const pending = new Promise<CreateStorybookExecuteResult>((resolve) => {
      resolveRequest = resolve
    })

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(() => pending),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    expect(document.body.style.overflow).toBe('')

    await user.type(screen.getByLabelText('동화 제목'), '스크롤 락 테스트')
    await user.type(screen.getByLabelText('그림 설명'), '로딩 다이얼로그와 이북 다이얼로그 연속 열림')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(await screen.findByRole('dialog', { name: '동화 생성 처리 중...' })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    resolveRequest({
      ok: true,
      value: {
        storybookId: 'storybook-scroll-lock',
        storybook: {
          storybookId: 'storybook-scroll-lock',
          title: '스크롤 락 테스트',
          authorName: null,
          description: '로딩 다이얼로그와 이북 다이얼로그 연속 열림',
          originImageUrl: null,
          createdAt: null,
        },
        details: {
          origin: [],
          output: [],
        },
        ebook: {
          title: '스크롤 락 테스트',
          authorName: null,
          coverImageUrl: 'data:image/png;base64,cover-scroll-lock',
          highlightImageUrl: null,
          finalImageUrl: null,
          pages: [
            { page: 1, content: '첫 페이지', isHighlight: false },
          ],
          narrations: [],
        },
      },
    })

    expect(await screen.findByRole('dialog', { name: '생성된 동화책: 스크롤 락 테스트' })).toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    await user.click(screen.getAllByRole('button', { name: '이북 닫기' })[0])

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '생성된 동화책: 스크롤 락 테스트' })).not.toBeInTheDocument()
    })
    expect(document.body.style.overflow).toBe('')
  })

  it('미니게임 게임오버 후 다시 도전하기를 누르면 하트가 복구되고 즉시 재시작된다', async () => {
    vi.useFakeTimers()
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.3)

    try {
      const dependencies: StorybookWorkspaceDependencies = {
        currentUserId: 'user-1',
        createStorybookUseCase: {
          execute: vi.fn(() => new Promise<CreateStorybookExecuteResult>(() => {})),
        },
      }

      const { unmount } = render(<StorybookWorkspace dependencies={dependencies} />)

      fireEvent.change(screen.getByLabelText('동화 제목'), { target: { value: '게임오버 테스트' } })
      fireEvent.change(screen.getByLabelText('그림 설명'), { target: { value: '재도전 버튼 동작 확인' } })
      fireEvent.click(screen.getByRole('button', { name: '동화 생성하기' }))

      expect(screen.getByRole('dialog', { name: '동화 생성 처리 중...' })).toBeInTheDocument()
      expect(document.querySelectorAll('.story-loading-game__life--active')).toHaveLength(2)

      let reachedGameOver = false
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(500)
        })

        if (screen.queryByTestId('story-loading-game-over')) {
          reachedGameOver = true
          break
        }
      }

      expect(reachedGameOver).toBe(true)
      expect(screen.getByTestId('story-loading-game-over')).toBeInTheDocument()
      expect(document.querySelectorAll('.story-loading-game__life--active')).toHaveLength(0)

      fireEvent.click(screen.getByRole('button', { name: '다시 도전하기' }))

      expect(screen.queryByTestId('story-loading-game-over')).not.toBeInTheDocument()
      expect(document.querySelectorAll('.story-loading-game__life--active')).toHaveLength(2)
      unmount()
    } finally {
      randomSpy.mockRestore()
      vi.useRealTimers()
    }
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

    await user.type(screen.getByLabelText('동화 제목'), '마법 지팡이')
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
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-320'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const surface = container.querySelector('.canvas-stage__surface')

    expect(surface).not.toBeNull()
    expect(surface).toHaveClass('canvas-stage__surface--plain')

    const toggleButton = screen.getByRole('button', { name: '그리드 켜기' })
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false')
    expect(toggleButton).toHaveAttribute('title', '그리드 켜기')

    await user.click(toggleButton)

    expect(toggleButton).toHaveAttribute('aria-label', '그리드 끄기')
    expect(toggleButton).toHaveAttribute('title', '그리드 끄기')
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true')
    expect(surface).not.toHaveClass('canvas-stage__surface--plain')

    await user.click(toggleButton)

    expect(toggleButton).toHaveAttribute('aria-label', '그리드 켜기')
    expect(toggleButton).toHaveAttribute('title', '그리드 켜기')
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false')
    expect(surface).toHaveClass('canvas-stage__surface--plain')
  })

  it('캔버스 전체 지우기 버튼을 누르면 현재 캔버스를 비운다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-321'))),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.click(screen.getByRole('button', { name: '캔버스 전체 지우기' }))

    expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, canvasWidth, canvasHeight)

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('펜 굵기 패널에서 슬라이더와 증감 버튼으로 굵기를 조절한다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-324'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const openButton = screen.getByRole('button', { name: '펜 굵기' })

    await user.click(openButton)

    const slider = screen.getByRole('slider', { name: '펜 굵기' })
    const decreaseButton = screen.getByRole('button', { name: '펜 굵기 줄이기' })
    const increaseButton = screen.getByRole('button', { name: '펜 굵기 늘리기' })
    const valueOutput = container.querySelector('.pen-width-panel__value')

    expect(slider).toHaveValue('3')
    expect(valueOutput).toHaveTextContent('3')

    await user.click(increaseButton)
    expect(slider).toHaveValue('4')
    expect(valueOutput).toHaveTextContent('4')

    await user.click(decreaseButton)
    expect(slider).toHaveValue('3')
    expect(valueOutput).toHaveTextContent('3')

    fireEvent.change(slider, { target: { value: '11' } })
    expect(slider).toHaveValue('11')
    expect(valueOutput).toHaveTextContent('11')
  })

  it('펜 색상 팔레트에서 색상을 고르면 캔버스 펜 색상이 바뀐다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-325-c'))),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    const colorToolButton = screen.getByRole('button', { name: '펜 색상' })
    expect(colorToolButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(colorToolButton)
    expect(colorToolButton).toHaveAttribute('aria-expanded', 'true')

    expect(screen.getByRole('button', { name: /#f97316/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#facc15/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#ffffff/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#f2c6a0/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#ec4899/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#84cc16/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#38bdf8/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#9ca3af/i })).toBeInTheDocument()

    const nextColorButton = screen.getByRole('button', { name: /#dc2626/i })
    expect(nextColorButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(nextColorButton)

    await waitFor(() => {
      expect(mockContext.strokeStyle).toBe('#dc2626')
      expect(mockContext.fillStyle).toBe('#dc2626')
    })

    expect(nextColorButton).toHaveAttribute('aria-pressed', 'true')

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('투명도 패널에서 슬라이더와 증감 버튼으로 투명도를 조절한다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-325-o'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const opacityToolButton = screen.getByRole('button', { name: '투명도' })

    expect(opacityToolButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(opacityToolButton)
    expect(opacityToolButton).toHaveAttribute('aria-expanded', 'true')

    const slider = screen.getByRole('slider', { name: '투명도' })
    const decreaseButton = screen.getByRole('button', { name: '투명도 줄이기' })
    const increaseButton = screen.getByRole('button', { name: '투명도 늘리기' })
    const valueOutput = container.querySelector('.pen-opacity-panel .range-control-panel__value')

    expect(slider).toHaveValue('100')
    expect(valueOutput).toHaveTextContent('100%')
    expect(mockContext.globalAlpha).toBe(1)

    await user.click(decreaseButton)
    expect(slider).toHaveValue('99')
    expect(valueOutput).toHaveTextContent('99%')
    expect(mockContext.globalAlpha).toBeCloseTo(0.99)

    await user.click(increaseButton)
    expect(slider).toHaveValue('100')
    expect(valueOutput).toHaveTextContent('100%')
    expect(mockContext.globalAlpha).toBe(1)

    fireEvent.change(slider, { target: { value: '35' } })
    expect(slider).toHaveValue('35')
    expect(valueOutput).toHaveTextContent('35%')
    expect(mockContext.globalAlpha).toBeCloseTo(0.35)

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('지우개 패널에서 슬라이더와 증감 버튼으로 크기를 조절한다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-325-e-size'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const eraserToolButton = screen.getByRole('button', { name: '지우개' })

    expect(eraserToolButton).toHaveAttribute('aria-expanded', 'false')
    expect(eraserToolButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(eraserToolButton)
    expect(eraserToolButton).toHaveAttribute('aria-expanded', 'true')
    expect(eraserToolButton).toHaveAttribute('aria-pressed', 'true')

    const slider = screen.getByRole('slider', { name: '지우개' })
    const decreaseButton = screen.getByRole('button', { name: '지우개 크기 줄이기' })
    const increaseButton = screen.getByRole('button', { name: '지우개 크기 늘리기' })
    const valueOutput = container.querySelector('.eraser-size-panel .range-control-panel__value')

    expect(slider).toHaveValue('20')
    expect(valueOutput).toHaveTextContent('20')

    await user.click(increaseButton)
    expect(slider).toHaveValue('21')
    expect(valueOutput).toHaveTextContent('21')

    await user.click(decreaseButton)
    expect(slider).toHaveValue('20')
    expect(valueOutput).toHaveTextContent('20')

    fireEvent.change(slider, { target: { value: '31' } })
    expect(slider).toHaveValue('31')
    expect(valueOutput).toHaveTextContent('31')

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('지우개 모드에서 그리면 destination-out 합성으로 지워진다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-325-e-mode'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const eraserToolButton = screen.getByRole('button', { name: '지우개' })
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    await user.click(eraserToolButton)
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(mockContext.globalCompositeOperation).toBe('destination-out')
    expect(mockContext.globalAlpha).toBe(1)
    expect(mockContext.lineWidth).toBeGreaterThan(3)
    expect(mockContext.stroke).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '펜 굵기' }))
    expect(mockContext.globalCompositeOperation).toBe('source-over')

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('지우개 모드에서 커서 클래스와 지우개 크기 미리보기를 표시한다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-325-e-preview'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const eraserToolButton = screen.getByRole('button', { name: '지우개' })
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    expect(canvas).not.toHaveClass('canvas-stage__surface--eraser')

    await user.click(eraserToolButton)
    expect(canvas).toHaveClass('canvas-stage__surface--eraser')

    const preview = container.querySelector('.canvas-stage__eraser-preview') as HTMLElement | null
    expect(preview).not.toBeNull()

    if (!preview) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    fireEvent.pointerEnter(canvas, { pointerId: 1, clientX: 40, clientY: 52 })

    expect(preview).toHaveClass('canvas-stage__eraser-preview--visible')
    expect(preview).toHaveStyle({ width: '20px', height: '20px' })

    fireEvent.pointerLeave(canvas, { pointerId: 1 })
    expect(preview).not.toHaveClass('canvas-stage__eraser-preview--visible')

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('드로잉 시작 전에도 실행취소 버튼은 활성화된다', () => {
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-325'))),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    expect(screen.getByRole('button', { name: '실행취소' })).toBeEnabled()
  })

  it('캔버스에 그리면 실행취소가 활성화되고 실행취소 시 다시 비활성화된다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const putImageDataSpy = mockContext.putImageData as unknown as { mock: { calls: unknown[][] } }
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-326'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const undoButton = screen.getByRole('button', { name: '실행취소' })
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    expect(undoButton).toBeEnabled()

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(mockContext.getImageData).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()
    expect(undoButton).toBeEnabled()

    const putImageDataCallsAfterDraw = putImageDataSpy.mock.calls.length
    await user.click(undoButton)

    expect(mockContext.putImageData).toHaveBeenCalled()
    expect(putImageDataSpy.mock.calls.length).toBe(putImageDataCallsAfterDraw + 1)

    const putImageDataCallsAfterUndo = putImageDataSpy.mock.calls.length
    await user.click(undoButton)
    expect(putImageDataSpy.mock.calls.length).toBe(putImageDataCallsAfterUndo)
    expect(undoButton).toBeEnabled()

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('실행취소 후 다시실행으로 마지막 상태를 복원한다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const putImageDataSpy = mockContext.putImageData as unknown as { mock: { calls: unknown[][] } }
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-326-redo'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const undoButton = screen.getByRole('button', { name: '실행취소' })
    const redoButton = screen.getByRole('button', { name: '다시실행' })
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    expect(redoButton).toBeDisabled()

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    await user.click(undoButton)
    expect(redoButton).toBeEnabled()

    const putImageDataCallsAfterUndo = putImageDataSpy.mock.calls.length
    await user.click(redoButton)

    expect(putImageDataSpy.mock.calls.length).toBe(putImageDataCallsAfterUndo + 1)
    expect(redoButton).toBeDisabled()

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('캔버스에서 Shift를 누르고 그리면 시작점과 현재점을 직선으로 잇는다', () => {
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const lineToSpy = mockContext.lineTo as unknown as { mock: { calls: Array<[number, number]> } }
    const moveToSpy = mockContext.moveTo as unknown as { mock: { calls: Array<[number, number]> } }
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-326-shift'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52, shiftKey: true })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 80, clientY: 64, shiftKey: true })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(moveToSpy.mock.calls.length).toBe(2)
    expect(lineToSpy.mock.calls.length).toBe(2)
    expect(moveToSpy.mock.calls[0]).toEqual([12, 14])
    expect(moveToSpy.mock.calls[1]).toEqual([12, 14])
    expect(lineToSpy.mock.calls[0]).toEqual([46, 52])
    expect(lineToSpy.mock.calls[1]).toEqual([80, 64])

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('캔버스가 활성화되어 있으면 ctrl+z로 실행취소한다', () => {
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const putImageDataSpy = mockContext.putImageData as unknown as { mock: { calls: unknown[][] } }
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-327'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const undoButton = screen.getByRole('button', { name: '실행취소' })
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(undoButton).toBeEnabled()
    const putImageDataCallsAfterDraw = putImageDataSpy.mock.calls.length
    fireEvent.keyDown(canvas, { key: 'z', ctrlKey: true })
    expect(putImageDataSpy.mock.calls.length).toBe(putImageDataCallsAfterDraw + 1)
    expect(undoButton).toBeEnabled()

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('캔버스가 활성화되어 있으면 ctrl+shift+z로 다시실행한다', () => {
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const putImageDataSpy = mockContext.putImageData as unknown as { mock: { calls: unknown[][] } }
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-327-redo-shortcut'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    const putImageDataCallsAfterDraw = putImageDataSpy.mock.calls.length
    fireEvent.keyDown(canvas, { key: 'z', ctrlKey: true })
    const putImageDataCallsAfterUndo = putImageDataSpy.mock.calls.length

    expect(putImageDataCallsAfterUndo).toBe(putImageDataCallsAfterDraw + 1)

    fireEvent.keyDown(canvas, { key: 'z', ctrlKey: true, shiftKey: true })
    expect(putImageDataSpy.mock.calls.length).toBe(putImageDataCallsAfterUndo + 1)

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('사진 업로드 버튼으로 로컬 이미지를 캔버스에 그릴 수 있다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const drawImageSpy = mockContext.drawImage as unknown as { mock: { calls: unknown[][] } }
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))
    const createObjectURLSpy = vi.fn(() => 'blob:storybook-upload')
    const revokeObjectURLSpy = vi.fn()
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL

    class MockImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      width = 1200
      height = 800

      set src(_value: string) {
        this.onload?.()
      }
    }

    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURLSpy,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURLSpy,
      configurable: true,
    })
    vi.stubGlobal('Image', MockImage as unknown as typeof Image)

    try {
      const dependencies: StorybookWorkspaceDependencies = {
        currentUserId: 'user-1',
        createStorybookUseCase: {
          execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-upload-photo'))),
        },
      }

      const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement | null

      expect(fileInput).not.toBeNull()
      if (!fileInput) {
        return
      }

      const drawImageCallsBeforeUpload = drawImageSpy.mock.calls.length
      await user.click(screen.getByRole('button', { name: '사진 업로드' }))

      const imageFile = new File(['image-bytes'], 'family.png', { type: 'image/png' })
      fireEvent.change(fileInput, {
        target: {
          files: [imageFile],
        },
      })

      await waitFor(() => {
        expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
        expect(revokeObjectURLSpy).toHaveBeenCalledTimes(1)
        expect(drawImageSpy.mock.calls.length).toBeGreaterThan(drawImageCallsBeforeUpload)
      })
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        value: originalCreateObjectURL,
        configurable: true,
      })
      Object.defineProperty(URL, 'revokeObjectURL', {
        value: originalRevokeObjectURL,
        configurable: true,
      })
      vi.unstubAllGlobals()
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
    }
  })

  it('텍스트 입력이 활성화되어 있으면 ctrl+z가 캔버스 실행취소를 건드리지 않는다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const putImageDataSpy = mockContext.putImageData as unknown as { mock: { calls: unknown[][] } }
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-328'))),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const undoButton = screen.getByRole('button', { name: '실행취소' })
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null
    const textarea = screen.getByLabelText('그림 설명')

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(undoButton).toBeEnabled()
    const putImageDataCallsBeforeTextUndo = putImageDataSpy.mock.calls.length

    await user.click(textarea)
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })

    expect(putImageDataSpy.mock.calls.length).toBe(putImageDataCallsBeforeTextUndo)
    expect(undoButton).toBeEnabled()

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('생성 응답에 pages/images가 있으면 표지 이후 양면 스프레드로 열고 엣지 클릭으로 넘긴다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: {
            storybookId: 'storybook-ebook-1',
            storybook: {
              storybookId: 'storybook-ebook-1',
              title: '숲속 모험',
              authorName: '달빛 작가',
              description: '토끼가 숲길을 달려요',
              originImageUrl: null,
              createdAt: null,
            },
            details: {
              origin: [],
              output: [],
            },
            ebook: {
              title: '숲속 모험',
              authorName: '달빛 작가',
              coverImageUrl: 'data:image/png;base64,coverimg',
              highlightImageUrl: 'data:image/png;base64,highlightimg',
              finalImageUrl: 'data:image/png;base64,lastimg',
              pages: [
                { page: 1, content: '첫 장면', isHighlight: false },
                { page: 2, content: '강조 장면', isHighlight: true },
                { page: 3, content: '마지막 장면', isHighlight: false },
              ],
              narrations: [],
            },
          },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.type(screen.getByLabelText('동화 제목'), '숲속 모험')
    await user.type(screen.getByLabelText('지은이'), '달빛 작가')
    await user.type(screen.getByLabelText('그림 설명'), '토끼가 숲길을 달려요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(await screen.findByRole('dialog', { name: '생성된 동화책: 숲속 모험' })).toBeInTheDocument()

    const coverImage = screen.getByAltText('숲속 모험 표지') as HTMLImageElement
    expect(coverImage.src).toContain('data:image/png;base64,coverimg')
    expect(screen.getByText('지은이: 달빛 작가')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '표지 넘기기' }))

    await waitFor(
      () => {
        expect(screen.getByText('- 1 -')).toBeInTheDocument()
        expect(screen.queryByText('- 2 -')).not.toBeInTheDocument()
        expect(screen.queryByText('강조 장면')).not.toBeInTheDocument()
      },
      { timeout: 1200 },
    )

    expect(screen.queryByText(/Prompt v/i)).not.toBeInTheDocument()

    expect(screen.queryByAltText('1페이지 삽화')).not.toBeInTheDocument()

    const highlightImage = screen.getByAltText('2페이지 삽화') as HTMLImageElement
    expect(highlightImage.src).toContain('data:image/png;base64,highlightimg')

    await user.click(screen.getByRole('button', { name: '다음 장으로 넘기기' }))
    await waitFor(() => {
      expect(screen.getByText('- 2 -')).toBeInTheDocument()
      expect(screen.queryByText('- 3 -')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '이전 장으로 넘기기' })).toBeEnabled()
      expect(screen.getByRole('button', { name: '다음 장으로 넘기기' })).toBeEnabled()
    })

    const lastImages = screen.getAllByAltText('3페이지 삽화') as HTMLImageElement[]
    expect(lastImages.some((image) => image.src.includes('data:image/png;base64,lastimg'))).toBe(true)
    expect(screen.getAllByText('강조 장면').length).toBeGreaterThan(0)
    expect(screen.queryByText('마지막 장면')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '다음 장으로 넘기기' }))
    await waitFor(() => {
      expect(screen.getByText('- 3 -')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '다음 장으로 넘기기' })).toBeDisabled()
    })

    expect(screen.getAllByText('마지막 장면').length).toBeGreaterThan(0)
    expect(screen.queryByAltText('3페이지 삽화')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '이전 장으로 넘기기' }))
    await waitFor(() => {
      expect(screen.getByText('- 2 -')).toBeInTheDocument()
      expect(screen.queryByText('- 3 -')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '이전 장으로 넘기기' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: '이전 장으로 넘기기' }))
    await waitFor(() => {
      expect(screen.getByText('- 1 -')).toBeInTheDocument()
      expect(screen.queryByText('- 2 -')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '표지로 돌아가기' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: '표지로 돌아가기' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '표지 넘기기' })).toBeInTheDocument()
    })
  }, 10000)

  it('마지막 페이지에서 처음으로 버튼을 누르면 표지로 이동한다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: {
            storybookId: 'storybook-ebook-back-to-cover',
            storybook: {
              storybookId: 'storybook-ebook-back-to-cover',
              title: '처음으로 테스트',
              authorName: '작가',
              description: '마지막 페이지 버튼 테스트',
              originImageUrl: null,
              createdAt: null,
            },
            details: {
              origin: [],
              output: [],
            },
            ebook: {
              title: '처음으로 테스트',
              authorName: '작가',
              coverImageUrl: 'data:image/png;base64,coverimg-2',
              highlightImageUrl: 'data:image/png;base64,highlightimg-2',
              finalImageUrl: 'data:image/png;base64,lastimg-2',
              pages: [
                { page: 1, content: '첫 페이지 텍스트', isHighlight: false },
                { page: 2, content: '마지막 페이지 텍스트', isHighlight: false },
              ],
              narrations: [],
            },
          },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.type(screen.getByLabelText('동화 제목'), '처음으로 테스트')
    await user.type(screen.getByLabelText('지은이'), '작가')
    await user.type(screen.getByLabelText('그림 설명'), '마지막 페이지 버튼 테스트')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(await screen.findByRole('dialog', { name: '생성된 동화책: 처음으로 테스트' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '표지 넘기기' }))
    await waitFor(() => {
      expect(screen.getByText('- 1 -')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '다음 장으로 넘기기' }))
    await waitFor(() => {
      expect(screen.getByText('- 2 -')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '다음 장으로 넘기기' })).toBeDisabled()
      expect(screen.getByRole('button', { name: '처음으로' })).toBeEnabled()
    })

    await user.click(screen.getByRole('button', { name: '처음으로' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '표지 넘기기' })).toBeInTheDocument()
    })
  })

  it('삽화 페이지를 제외한 텍스트 페이지에만 낭독 버튼을 보여준다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: {
            storybookId: 'storybook-tts-1',
            storybook: {
              storybookId: 'storybook-tts-1',
              title: '낭독 버튼 테스트',
              authorName: null,
              description: '텍스트 페이지만 낭독 버튼 표시',
              originImageUrl: null,
              createdAt: null,
            },
            details: {
              origin: [],
              output: [],
            },
            ebook: {
              title: '낭독 버튼 테스트',
              authorName: null,
              coverImageUrl: 'data:image/png;base64,cover-tts-1',
              highlightImageUrl: 'data:image/png;base64,highlight-tts-1',
              finalImageUrl: 'data:image/png;base64,last-tts-1',
              pages: [
                { page: 1, content: '첫 번째 텍스트', isHighlight: false },
                { page: 2, content: '두 번째 텍스트', isHighlight: true },
                { page: 3, content: '세 번째 텍스트', isHighlight: false },
              ],
              narrations: [
                { page: 1, audioDataUrl: 'data:audio/mpeg;base64,audio-1' },
                { page: 2, audioDataUrl: 'data:audio/mpeg;base64,audio-2' },
                { page: 3, audioDataUrl: 'data:audio/mpeg;base64,audio-3' },
              ],
            },
          },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.type(screen.getByLabelText('동화 제목'), '낭독 버튼 테스트')
    await user.type(screen.getByLabelText('그림 설명'), '텍스트 페이지만 낭독 버튼 표시')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))
    await user.click(await screen.findByRole('button', { name: '표지 넘기기' }))

    await waitFor(() => {
      expect(screen.getByText('- 1 -')).toBeInTheDocument()
    })

    expect(screen.getByAltText('2페이지 삽화')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '낭독 재생' })).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: '다음 장으로 넘기기' }))
    await waitFor(() => {
      expect(screen.getByText('- 2 -')).toBeInTheDocument()
    })

    expect(screen.getByAltText('3페이지 삽화')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: '낭독 재생' })).toHaveLength(1)
  })

  it('페이지 낭독 버튼을 누르면 기존 재생을 끊고 새 페이지 음성만 재생한다', async () => {
    const user = userEvent.setup()
    const createdAudios: Array<{
      src: string
      pause: ReturnType<typeof vi.fn>
      play: ReturnType<typeof vi.fn>
      onended: (() => void) | null
      onerror: (() => void) | null
      currentTime: number
      preload: string
    }> = []

    class MockAudio {
      src: string
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      currentTime = 0
      preload = 'auto'
      pause = vi.fn()
      play = vi.fn(async () => {})

      constructor(src: string) {
        this.src = src
        createdAudios.push(this)
      }
    }

    vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio)

    try {
      const dependencies: StorybookWorkspaceDependencies = {
        currentUserId: 'user-1',
        createStorybookUseCase: {
          execute: vi.fn(async () => ({
            ok: true as const,
            value: {
              storybookId: 'storybook-tts-2',
              storybook: {
                storybookId: 'storybook-tts-2',
                title: '단일 재생 테스트',
                authorName: null,
                description: '동시 재생 차단 확인',
                originImageUrl: null,
                createdAt: null,
              },
              details: {
                origin: [],
                output: [],
              },
              ebook: {
                title: '단일 재생 테스트',
                authorName: null,
                coverImageUrl: 'data:image/png;base64,cover-tts-2',
                highlightImageUrl: null,
                finalImageUrl: null,
                pages: [
                  { page: 1, content: '왼쪽 텍스트', isHighlight: false },
                  { page: 2, content: '오른쪽 텍스트', isHighlight: false },
                ],
                narrations: [
                  { page: 1, audioDataUrl: 'data:audio/mpeg;base64,left-audio' },
                  { page: 2, audioDataUrl: 'data:audio/mpeg;base64,right-audio' },
                ],
              },
            },
          })),
        },
      }

      render(<StorybookWorkspace dependencies={dependencies} />)

      await user.type(screen.getByLabelText('동화 제목'), '단일 재생 테스트')
      await user.type(screen.getByLabelText('그림 설명'), '동시 재생 차단 확인')
      await user.click(screen.getByRole('button', { name: '동화 생성하기' }))
      await user.click(await screen.findByRole('button', { name: '표지 넘기기' }))

      await waitFor(() => {
        expect(screen.getByText('- 1 -')).toBeInTheDocument()
        expect(screen.getByText('- 2 -')).toBeInTheDocument()
      })

      const playButtons = screen.getAllByRole('button', { name: '낭독 재생' })
      await user.click(playButtons[0])
      expect(createdAudios).toHaveLength(1)
      expect(createdAudios[0].src).toBe('data:audio/mpeg;base64,left-audio')
      expect(createdAudios[0].play).toHaveBeenCalledTimes(1)

      const secondPlayButton = screen.getByRole('button', { name: '낭독 재생' })
      await user.click(secondPlayButton)

      expect(createdAudios).toHaveLength(2)
      expect(createdAudios[0].pause).toHaveBeenCalledTimes(1)
      expect(createdAudios[1].src).toBe('data:audio/mpeg;base64,right-audio')
      expect(createdAudios[1].play).toHaveBeenCalledTimes(1)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('우측 페이지 낭독 버튼 클릭 시 페이지 넘김이 먼저 트리거되지 않는다', async () => {
    const user = userEvent.setup()
    const createdAudios: Array<{
      src: string
      pause: ReturnType<typeof vi.fn>
      play: ReturnType<typeof vi.fn>
      onended: (() => void) | null
      onerror: (() => void) | null
      currentTime: number
      preload: string
    }> = []

    class MockAudio {
      src: string
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      currentTime = 0
      preload = 'auto'
      pause = vi.fn()
      play = vi.fn(async () => {})

      constructor(src: string) {
        this.src = src
        createdAudios.push(this)
      }
    }

    vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio)

    try {
      const dependencies: StorybookWorkspaceDependencies = {
        currentUserId: 'user-1',
        createStorybookUseCase: {
          execute: vi.fn(async () => ({
            ok: true as const,
            value: {
              storybookId: 'storybook-tts-right-button',
              storybook: {
                storybookId: 'storybook-tts-right-button',
                title: '우측 버튼 클릭 안정성',
                authorName: null,
                description: '우측 페이지 버튼이 넘김보다 우선인지 확인',
                originImageUrl: null,
                createdAt: null,
              },
              details: {
                origin: [],
                output: [],
              },
              ebook: {
                title: '우측 버튼 클릭 안정성',
                authorName: null,
                coverImageUrl: 'data:image/png;base64,cover-right-button',
                highlightImageUrl: null,
                finalImageUrl: null,
                pages: [
                  { page: 1, content: '왼쪽 페이지 텍스트', isHighlight: false },
                  { page: 2, content: '오른쪽 페이지 텍스트', isHighlight: false },
                  { page: 3, content: '다음 스프레드 텍스트', isHighlight: false },
                ],
                narrations: [
                  { page: 1, audioDataUrl: 'data:audio/mpeg;base64,right-test-1' },
                  { page: 2, audioDataUrl: 'data:audio/mpeg;base64,right-test-2' },
                  { page: 3, audioDataUrl: 'data:audio/mpeg;base64,right-test-3' },
                ],
              },
            },
          })),
        },
      }

      render(<StorybookWorkspace dependencies={dependencies} />)

      await user.type(screen.getByLabelText('동화 제목'), '우측 버튼 클릭 안정성')
      await user.type(screen.getByLabelText('그림 설명'), '우측 페이지 버튼이 넘김보다 우선인지 확인')
      await user.click(screen.getByRole('button', { name: '동화 생성하기' }))
      await user.click(await screen.findByRole('button', { name: '표지 넘기기' }))

      await waitFor(() => {
        expect(screen.getByText('- 1 -')).toBeInTheDocument()
        expect(screen.getByText('- 2 -')).toBeInTheDocument()
      })

      const playButtons = screen.getAllByRole('button', { name: '낭독 재생' })
      await user.click(playButtons[1])

      expect(createdAudios).toHaveLength(1)
      expect(createdAudios[0].src).toBe('data:audio/mpeg;base64,right-test-2')

      await act(async () => {
        await new Promise<void>((resolve) => {
          window.setTimeout(() => {
            resolve()
          }, 900)
        })
      })

      expect(screen.getByText('- 1 -')).toBeInTheDocument()
      expect(screen.getByText('- 2 -')).toBeInTheDocument()
      expect(screen.queryByText('- 3 -')).not.toBeInTheDocument()
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('자동 낭독을 누르면 펼쳐진 텍스트를 순서대로 읽고 끝나면 자동으로 페이지를 넘긴다', async () => {
    const user = userEvent.setup()
    const playedSources: string[] = []

    class MockAudio {
      src: string
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      currentTime = 0
      preload = 'auto'
      pause = vi.fn()
      play = vi.fn(async () => {
        playedSources.push(this.src)
        window.setTimeout(() => {
          this.onended?.()
        }, 0)
      })

      constructor(src: string) {
        this.src = src
      }
    }

    vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio)

    try {
      const dependencies: StorybookWorkspaceDependencies = {
        currentUserId: 'user-1',
        createStorybookUseCase: {
          execute: vi.fn(async () => ({
            ok: true as const,
            value: {
              storybookId: 'storybook-tts-3',
              storybook: {
                storybookId: 'storybook-tts-3',
                title: '자동 낭독 테스트',
                authorName: null,
                description: '자동 낭독과 자동 페이지 넘김 확인',
                originImageUrl: null,
                createdAt: null,
              },
              details: {
                origin: [],
                output: [],
              },
              ebook: {
                title: '자동 낭독 테스트',
                authorName: null,
                coverImageUrl: 'data:image/png;base64,cover-tts-3',
                highlightImageUrl: 'data:image/png;base64,highlight-tts-3',
                finalImageUrl: null,
                pages: [
                  { page: 1, content: '첫 페이지', isHighlight: false },
                  { page: 2, content: '두 번째 페이지', isHighlight: true },
                  { page: 3, content: '세 번째 페이지', isHighlight: false },
                  { page: 4, content: '네 번째 페이지', isHighlight: false },
                ],
                narrations: [
                  { page: 1, audioDataUrl: 'data:audio/mpeg;base64,page-1' },
                  { page: 2, audioDataUrl: 'data:audio/mpeg;base64,page-2' },
                  { page: 3, audioDataUrl: 'data:audio/mpeg;base64,page-3' },
                  { page: 4, audioDataUrl: 'data:audio/mpeg;base64,page-4' },
                ],
              },
            },
          })),
        },
      }

      render(<StorybookWorkspace dependencies={dependencies} />)

      await user.type(screen.getByLabelText('동화 제목'), '자동 낭독 테스트')
      await user.type(screen.getByLabelText('그림 설명'), '자동 낭독과 자동 페이지 넘김 확인')
      await user.click(screen.getByRole('button', { name: '동화 생성하기' }))
      await user.click(await screen.findByRole('button', { name: '표지 넘기기' }))

      await waitFor(() => {
        expect(screen.getByText('- 1 -')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '자동 낭독' }))

      await waitFor(
        () => {
          expect(playedSources.length).toBeGreaterThanOrEqual(2)
          expect(screen.getByRole('button', { name: '자동 낭독' })).toBeInTheDocument()
        },
        { timeout: 7000 },
      )

      expect(playedSources).toContain('data:audio/mpeg;base64,page-1')
    } finally {
      vi.unstubAllGlobals()
    }
  }, 10000)

  it('모바일 세로모드에서는 한 페이지씩 보이고 자동낭독이 삽화 페이지와 충돌하지 않는다', async () => {
    const user = userEvent.setup()
    const playedSources: string[] = []

    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: query === '(max-width: 767px) and (orientation: portrait)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      })) as unknown as typeof window.matchMedia,
    )

    class MockAudio {
      src: string
      onended: (() => void) | null = null
      onerror: (() => void) | null = null
      currentTime = 0
      preload = 'auto'
      pause = vi.fn()
      play = vi.fn(async () => {
        playedSources.push(this.src)
        window.setTimeout(() => {
          this.onended?.()
        }, 0)
      })

      constructor(src: string) {
        this.src = src
      }
    }

    vi.stubGlobal('Audio', MockAudio as unknown as typeof Audio)

    try {
      const dependencies: StorybookWorkspaceDependencies = {
        currentUserId: 'user-1',
        createStorybookUseCase: {
          execute: vi.fn(async () => ({
            ok: true as const,
            value: {
              storybookId: 'storybook-tts-mobile-1',
              storybook: {
                storybookId: 'storybook-tts-mobile-1',
                title: '모바일 단일 페이지',
                authorName: null,
                description: '세로 모드 단일 페이지와 자동낭독 검증',
                originImageUrl: null,
                createdAt: null,
              },
              details: {
                origin: [],
                output: [],
              },
              ebook: {
                title: '모바일 단일 페이지',
                authorName: null,
                coverImageUrl: 'data:image/png;base64,cover-mobile-1',
                highlightImageUrl: 'data:image/png;base64,highlight-mobile-1',
                finalImageUrl: 'data:image/png;base64,last-mobile-1',
                pages: [
                  { page: 1, content: '첫 번째 텍스트', isHighlight: false },
                  { page: 2, content: '두 번째 텍스트', isHighlight: true },
                  { page: 3, content: '세 번째 텍스트', isHighlight: false },
                ],
                narrations: [
                  { page: 1, audioDataUrl: 'data:audio/mpeg;base64,mobile-page-1' },
                  { page: 2, audioDataUrl: 'data:audio/mpeg;base64,mobile-page-2' },
                  { page: 3, audioDataUrl: 'data:audio/mpeg;base64,mobile-page-3' },
                ],
              },
            },
          })),
        },
      }

      render(<StorybookWorkspace dependencies={dependencies} />)

      await user.type(screen.getByLabelText('동화 제목'), '모바일 단일 페이지')
      await user.type(screen.getByLabelText('그림 설명'), '세로 모드 단일 페이지와 자동낭독 검증')
      await user.click(screen.getByRole('button', { name: '동화 생성하기' }))
      await user.click(await screen.findByRole('button', { name: '표지 넘기기' }))

      await waitFor(() => {
        expect(screen.getByText('- 1 -')).toBeInTheDocument()
        expect(screen.queryByText('- 2 -')).not.toBeInTheDocument()
        expect(document.querySelectorAll('.storybook-book-page')).toHaveLength(1)
      })

      await user.click(screen.getByRole('button', { name: '다음 장으로 넘기기' }))
      await waitFor(() => {
        expect(screen.getByAltText('2페이지 삽화')).toBeInTheDocument()
      })
      expect(screen.queryByText('- 2 -')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: '이전 장으로 넘기기' }))
      await waitFor(() => {
        expect(screen.getByText('- 1 -')).toBeInTheDocument()
      })

      await user.click(screen.getByRole('button', { name: '자동 낭독' }))

      await waitFor(
        () => {
          expect(screen.getByText('- 3 -')).toBeInTheDocument()
          expect(screen.getByRole('button', { name: '자동 낭독' })).toBeInTheDocument()
        },
        { timeout: 9000 },
      )

      expect(playedSources).toEqual([
        'data:audio/mpeg;base64,mobile-page-1',
        'data:audio/mpeg;base64,mobile-page-2',
        'data:audio/mpeg;base64,mobile-page-3',
      ])
    } finally {
      vi.unstubAllGlobals()
    }
  }, 12000)

  it('라이브 북 미리보기 섹션을 렌더링하지 않는다', () => {
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-330'))),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    expect(screen.queryByRole('heading', { name: '라이브 북 미리보기' })).not.toBeInTheDocument()
  })

  it('비로그인 상태에서 로그인 칩을 누르면 인증 이동 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const requestAuthentication = vi.fn()
    const startTrial = vi.fn(async () => ({
      action: 'checkout' as const,
      checkoutUrl: 'https://checkout.example.com/session',
    }))
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'guest-user',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-cta-auth-gate'))),
      },
      subscriptionAccessUseCase: {
        getSnapshot: vi.fn(async () => createSubscriptionSnapshot()),
        startTrial,
        openPortal: vi.fn(async () => ({
          portalUrl: 'https://portal.example.com',
        })),
      },
    }

    render(
      <StorybookWorkspace
        dependencies={dependencies}
        auth={createMockAuth({
          userId: null,
          userEmail: null,
        })}
        onRequestAuthentication={requestAuthentication}
      />,
    )

    expect(screen.queryByLabelText('서비스 상태')).not.toBeInTheDocument()
    expect(screen.queryByText('무료 제작')).not.toBeInTheDocument()
    expect(screen.queryByText('월 구독')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(requestAuthentication).toHaveBeenCalledTimes(1)
    expect(startTrial).not.toHaveBeenCalled()
  })

  it('미구독 로그인 상태에서 메뉴의 1일 체험하기로 요금제 모달을 열고 checkout을 호출한다', async () => {
    const user = userEvent.setup()
    const getSnapshot = vi.fn(async () =>
      createSubscriptionSnapshot({
        quota: {
          freeStoryQuotaTotal: 2,
          freeStoryQuotaUsed: 1,
          remainingFreeStories: 1,
          dailyQuotaLimit: null,
          dailyQuotaUsed: 0,
          remainingDailyStories: null,
          dailyQuotaDateKst: null,
        },
      }),
    )
    const startTrial = vi.fn(async () => ({
      action: 'checkout' as const,
      checkoutUrl: 'https://checkout.example.com/session',
    }))
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-cta-checkout'))),
      },
      subscriptionAccessUseCase: {
        getSnapshot,
        startTrial,
        openPortal: vi.fn(async () => ({
          portalUrl: 'https://portal.example.com',
        })),
      },
    }

    render(
      <StorybookWorkspace
        dependencies={dependencies}
        auth={createMockAuth({
          userId: 'user-1',
          userEmail: 'user-1@example.com',
        })}
      />,
    )

    await waitFor(() => {
      expect(getSnapshot).toHaveBeenCalled()
      expect(screen.getByText('1편 남음')).toBeInTheDocument()
      expect(screen.getByText('미구독')).toBeInTheDocument()
      expect(screen.queryByText('체험')).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'user-1' }))
    const trialMenuItem = screen.getByRole('menuitem', { name: '1일 체험하기' })
    expect(trialMenuItem).toHaveClass('workspace-account-menu__item--trial')
    expect(screen.queryByRole('menuitem', { name: '구독 관리' })).not.toBeInTheDocument()
    await user.click(trialMenuItem)

    const pricingDialog = screen.getByRole('dialog', { name: '요금제 선택' })
    const subscribeButtons = within(pricingDialog).getAllByRole('button', { name: '구독하기' })
    await user.click(subscribeButtons[0])

    expect(startTrial).toHaveBeenCalledTimes(1)
    expect(startTrial).toHaveBeenCalledWith('standard')
    expect(screen.queryByRole('button', { name: /user-1: Free/i })).not.toBeInTheDocument()
  })

  it('미구독 + 무료 제작 소진 상태면 무료 제작/월 구독 카드 모두 1일 무료 체험 CTA를 노출한다', async () => {
    const user = userEvent.setup()
    const getSnapshot = vi.fn(async () =>
      createSubscriptionSnapshot({
        quota: {
          freeStoryQuotaTotal: 2,
          freeStoryQuotaUsed: 2,
          remainingFreeStories: 0,
          dailyQuotaLimit: null,
          dailyQuotaUsed: 0,
          remainingDailyStories: null,
          dailyQuotaDateKst: null,
        },
      }),
    )
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-cta-cards'))),
      },
      subscriptionAccessUseCase: {
        getSnapshot,
        startTrial: vi.fn(async () => ({
          action: 'checkout' as const,
          checkoutUrl: 'https://checkout.example.com/session',
        })),
        openPortal: vi.fn(async () => ({
          portalUrl: 'https://portal.example.com',
        })),
      },
    }

    render(
      <StorybookWorkspace
        dependencies={dependencies}
        auth={createMockAuth({
          userId: 'user-1',
          userEmail: 'user-1@example.com',
        })}
      />,
    )

    await waitFor(() => {
      expect(getSnapshot).toHaveBeenCalled()
      expect(screen.getByText('0편 남음')).toBeInTheDocument()
    })

    const trialButtons = screen.getAllByRole('button', { name: '1일 무료 체험' })
    expect(trialButtons).toHaveLength(2)

    await user.click(trialButtons[0])
    expect(screen.getByRole('dialog', { name: '요금제 선택' })).toBeInTheDocument()
  })

  it('active 상태에서 계정 메뉴의 구독 관리 클릭 시 portal URL로 이동한다', async () => {
    const user = userEvent.setup()
    const openPortal = vi.fn(async () => ({
      portalUrl: 'https://portal.example.com/session',
    }))
    const getSnapshot = vi.fn(async () =>
      createSubscriptionSnapshot({
        subscription: {
          status: 'active' as const,
          planCode: 'standard',
          trialStartAt: null,
          trialEndAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          providerCustomerId: 'cus_1',
          providerSubscriptionId: 'sub_1',
        },
        quota: {
          freeStoryQuotaTotal: 2,
          freeStoryQuotaUsed: 2,
          remainingFreeStories: 0,
          dailyQuotaLimit: 30,
          dailyQuotaUsed: 3,
          remainingDailyStories: 27,
          dailyQuotaDateKst: '2026-02-22',
        },
        currentPlan: {
          code: 'standard',
          name: 'Standard',
        },
      }),
    )
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-cta-portal'))),
      },
      subscriptionAccessUseCase: {
        getSnapshot,
        startTrial: vi.fn(async () => ({
          action: 'checkout' as const,
          checkoutUrl: 'https://checkout.example.com/session',
        })),
        openPortal,
      },
    }

    render(
      <StorybookWorkspace
        dependencies={dependencies}
        auth={createMockAuth({
          userId: 'user-1',
          userEmail: 'user-1@example.com',
        })}
      />,
    )

    await waitFor(() => {
      expect(getSnapshot).toHaveBeenCalled()
      expect(screen.getByRole('button', { name: 'user-1' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'user-1' }))
    expect(screen.queryByRole('menuitem', { name: '1일 체험하기' })).not.toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '구독 관리' })).toBeInTheDocument()
    await user.click(screen.getByRole('menuitem', { name: '구독 관리' }))

    expect(openPortal).toHaveBeenCalledTimes(1)
  })

  it('/create?checkout=success 복귀 시 상태를 재조회해 계정 플랜 칩을 갱신한다', async () => {
    window.history.replaceState({}, '', '/create?checkout=success')

    const getSnapshot = vi
      .fn()
      .mockResolvedValueOnce(
        createSubscriptionSnapshot({
          subscription: {
            status: 'incomplete' as const,
            planCode: 'standard',
            trialStartAt: null,
            trialEndAt: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            providerCustomerId: 'cus_1',
            providerSubscriptionId: 'sub_1',
          },
          quota: {
            freeStoryQuotaTotal: 2,
            freeStoryQuotaUsed: 2,
            remainingFreeStories: 0,
            dailyQuotaLimit: 30,
            dailyQuotaUsed: 30,
            remainingDailyStories: 0,
            dailyQuotaDateKst: '2026-02-22',
          },
          currentPlan: {
            code: 'standard',
            name: 'Standard',
          },
          canCreate: false,
        }),
      )
      .mockResolvedValueOnce(
        createSubscriptionSnapshot({
          subscription: {
            status: 'active' as const,
            planCode: 'standard',
            trialStartAt: null,
            trialEndAt: null,
            currentPeriodStart: null,
            currentPeriodEnd: null,
            providerCustomerId: 'cus_1',
            providerSubscriptionId: 'sub_1',
          },
          quota: {
            freeStoryQuotaTotal: 2,
            freeStoryQuotaUsed: 2,
            remainingFreeStories: 0,
            dailyQuotaLimit: 30,
            dailyQuotaUsed: 1,
            remainingDailyStories: 29,
            dailyQuotaDateKst: '2026-02-22',
          },
          currentPlan: {
            code: 'standard',
            name: 'Standard',
          },
          canCreate: true,
        }),
      )
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-checkout-return'))),
      },
      subscriptionAccessUseCase: {
        getSnapshot,
        startTrial: vi.fn(async () => ({
          action: 'checkout' as const,
          checkoutUrl: 'https://checkout.example.com/session',
        })),
        openPortal: vi.fn(async () => ({
          portalUrl: 'https://portal.example.com/session',
        })),
      },
    }

    render(
      <StorybookWorkspace
        dependencies={dependencies}
        auth={createMockAuth({
          userId: 'user-1',
          userEmail: 'user-1@example.com',
        })}
      />,
    )

    await waitFor(() => {
      expect(getSnapshot).toHaveBeenCalledTimes(2)
      expect(screen.getByRole('button', { name: 'user-1' })).toBeInTheDocument()
    })
    expect(window.location.search).toBe('')
  })

  it('테마 토글이 언어 설정 왼쪽에 렌더링된다', () => {
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-334'))),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    expect(screen.getByRole('button', { name: '밤 모드로 전환' })).toBeInTheDocument()

    const toolbar = document.querySelector('.workspace-header__toolbar')
    expect(toolbar?.children[0]).toHaveClass('theme-toggle')
    expect(toolbar?.children[1]).toHaveClass('language-switcher')
  })

  it('지구본 언어 설정으로 전체 UI 문구가 바뀐다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => (createSuccessfulCreateResult('storybook-300'))),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.selectOptions(screen.getByLabelText('언어'), 'en')

    await waitFor(() => {
      expect(screen.getByText('Free stories')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create Storybook' })).toBeInTheDocument()
    })
  })
})
