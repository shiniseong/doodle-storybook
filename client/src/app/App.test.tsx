import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import App from '@app/App'
import { createAppDependencies } from '@app/providers/dependencies'
import { useSupabaseGoogleAuth, type SupabaseGoogleAuthResult } from '@shared/lib/supabase/use-supabase-google-auth'

vi.mock('@shared/lib/supabase/use-supabase-google-auth', () => ({
  useSupabaseGoogleAuth: vi.fn(),
}))

vi.mock('@app/providers/dependencies', () => ({
  createAppDependencies: vi.fn((options?: { currentUserId?: string }) => ({
    currentUserId: options?.currentUserId ?? 'demo-user',
    createStorybookUseCase: {
      execute: vi.fn(),
    },
    listStorybooksUseCase: {
      execute: vi.fn(),
    },
    getStorybookDetailUseCase: {
      execute: vi.fn(),
    },
    deleteStorybookUseCase: {
      execute: vi.fn(),
    },
    accountAgreementsUseCase: {
      getStatus: vi.fn(async () => ({
        requiredVersion: '2026-02-24',
        hasAcceptedRequiredAgreements: true,
        agreements: {
          termsOfService: true,
          adultPayer: true,
          noDirectChildDataCollection: true,
        },
        acceptedAt: '2026-02-24T10:00:00.000Z',
      })),
      acceptAllRequiredAgreements: vi.fn(async () => ({
        requiredVersion: '2026-02-24',
        hasAcceptedRequiredAgreements: true,
        agreements: {
          termsOfService: true,
          adultPayer: true,
          noDirectChildDataCollection: true,
        },
        acceptedAt: '2026-02-24T10:00:00.000Z',
      })),
    },
    subscriptionAccessUseCase: {
      getSnapshot: vi.fn(),
      startTrial: vi.fn(),
      openPortal: vi.fn(),
    },
  })),
}))

vi.mock('@pages/home/ui/HomePage', () => ({
  HomePage: ({
    dependencies,
    onRequestAuthentication,
    onNavigateToLibrary,
  }: {
    dependencies: {
      currentUserId: string
    }
    onRequestAuthentication?: () => void
    onNavigateToLibrary?: () => void
  }) => (
    <div data-testid="home-page">
      {dependencies.currentUserId}
      <button type="button" onClick={onRequestAuthentication}>
        open-auth
      </button>
      <button type="button" onClick={onNavigateToLibrary}>
        open-library
      </button>
    </div>
  ),
}))

vi.mock('@pages/landing/ui/LandingPage', () => ({
  LandingPage: ({ onStart }: { onStart: () => void }) => (
    <div data-testid="landing-page">
      <button type="button" onClick={onStart}>
        start-workspace
      </button>
    </div>
  ),
}))

vi.mock('@pages/auth/ui/LoginPage', () => ({
  LoginPage: ({
    isConfigured,
  }: {
    isConfigured: boolean
  }) => <div data-testid="login-page">{String(isConfigured)}</div>,
}))

vi.mock('@pages/agreements/ui/AgreementsPage', () => ({
  AgreementsPage: ({
    onCompleted,
  }: {
    onCompleted?: () => void
  }) => (
    <div data-testid="agreements-page">
      <button type="button" onClick={onCompleted}>
        agreements-complete
      </button>
    </div>
  ),
}))

vi.mock('@pages/library/ui/LibraryPage', () => ({
  LibraryPage: ({
    userId,
    onOpenStorybookDetail,
  }: {
    userId: string
    onOpenStorybookDetail?: (storybookId: string) => void
  }) => (
    <div data-testid="library-page">
      {userId}
      <button
        type="button"
        onClick={() => {
          onOpenStorybookDetail?.('storybook-77')
        }}
      >
        open-storybook-detail
      </button>
    </div>
  ),
}))

vi.mock('@pages/storybook-detail/ui/StorybookDetailPage', () => ({
  StorybookDetailPage: ({
    storybookId,
    onBack,
  }: {
    storybookId: string
    onBack?: () => void
  }) => (
    <div data-testid="storybook-detail-page">
      {storybookId}
      <button type="button" onClick={onBack}>
        detail-back
      </button>
    </div>
  ),
}))

function createMockAuth(overrides: Partial<SupabaseGoogleAuthResult> = {}): SupabaseGoogleAuthResult {
  return {
    isConfigured: true,
    isLoading: false,
    isSigningIn: false,
    userId: 'user-1',
    userEmail: 'user-1@example.com',
    accessToken: 'test-access-token',
    signInWithEmail: vi.fn(async () => ({ ok: true })),
    signUpWithEmail: vi.fn(async () => ({ ok: true, requiresEmailVerification: true })),
    signInWithProvider: vi.fn(async () => {}),
    signInWithGoogle: vi.fn(async () => {}),
    signInWithKakao: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...overrides,
  }
}

function renderAppAt(pathname = '/') {
  window.history.replaceState({}, '', pathname)
  return render(
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>,
  )
}

describe('App', () => {
  it('create dependencies를 호출한다', () => {
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(createMockAuth())

    renderAppAt('/')

    expect(vi.mocked(createAppDependencies)).toHaveBeenCalled()
  })

  it('기본 진입은 랜딩 페이지다', () => {
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(createMockAuth())

    renderAppAt('/')

    expect(screen.getByTestId('landing-page')).toBeInTheDocument()
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('랜딩에서 시작 버튼을 누르면 홈 페이지를 렌더링한다', async () => {
    const user = userEvent.setup()
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(createMockAuth())

    renderAppAt('/')
    await user.click(screen.getByRole('button', { name: 'start-workspace' }))

    expect(await screen.findByTestId('home-page')).toHaveTextContent('user-1')
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('새로고침으로 /create 경로에 들어와도 홈 페이지는 demo-user로 동작한다', () => {
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(
      createMockAuth({
        userId: null,
        userEmail: null,
      }),
    )

    renderAppAt('/create')

    expect(screen.getByTestId('home-page')).toHaveTextContent('demo-user')
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('로그인 사용자가 /create 진입 시 필수 동의가 미완료면 /agreements로 이동한다', async () => {
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(createMockAuth())
    vi.mocked(createAppDependencies).mockImplementationOnce((options?: { currentUserId?: string }) => ({
      currentUserId: options?.currentUserId ?? 'demo-user',
      createStorybookUseCase: {
        execute: vi.fn(),
      },
      listStorybooksUseCase: {
        execute: vi.fn(),
      },
      getStorybookDetailUseCase: {
        execute: vi.fn(),
      },
      deleteStorybookUseCase: {
        execute: vi.fn(),
      },
      accountAgreementsUseCase: {
        getStatus: vi.fn(async () => ({
          requiredVersion: '2026-02-24',
          hasAcceptedRequiredAgreements: false,
          agreements: {
            termsOfService: false,
            adultPayer: false,
            noDirectChildDataCollection: false,
          },
          acceptedAt: null,
        })),
        acceptAllRequiredAgreements: vi.fn(),
      },
      subscriptionAccessUseCase: {
        getSnapshot: vi.fn(),
        startTrial: vi.fn(),
        openPortal: vi.fn(),
      },
    }))

    renderAppAt('/create')

    expect(await screen.findByTestId('agreements-page')).toBeInTheDocument()
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
  })

  it('홈에서 인증 페이지 요청 시 로그인 페이지를 렌더링한다', async () => {
    const user = userEvent.setup()
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(
      createMockAuth({
        userId: null,
        userEmail: null,
      }),
    )

    renderAppAt('/')
    await user.click(screen.getByRole('button', { name: 'start-workspace' }))
    await screen.findByTestId('home-page')

    await user.click(screen.getByRole('button', { name: 'open-auth' }))

    expect(screen.getByTestId('login-page')).toHaveTextContent('true')
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
  })

  it('홈에서 내 그림동화 이동 요청 시 라이브러리 페이지를 렌더링한다', async () => {
    const user = userEvent.setup()
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(createMockAuth())

    renderAppAt('/')
    await user.click(screen.getByRole('button', { name: 'start-workspace' }))
    await screen.findByTestId('home-page')
    await user.click(screen.getByRole('button', { name: 'open-library' }))

    expect(screen.getByTestId('library-page')).toHaveTextContent('user-1')
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('새로고침으로 /auth 경로에 들어오면 로그인 페이지를 렌더링한다', () => {
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(
      createMockAuth({
        userId: null,
        userEmail: null,
      }),
    )

    renderAppAt('/auth')

    expect(screen.getByTestId('login-page')).toHaveTextContent('true')
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument()
  })

  it('/agreements는 인증이 없으면 로그인 페이지로 이동한다', () => {
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(
      createMockAuth({
        userId: null,
        userEmail: null,
      }),
    )

    renderAppAt('/agreements')

    expect(screen.getByTestId('login-page')).toHaveTextContent('true')
    expect(screen.queryByTestId('agreements-page')).not.toBeInTheDocument()
  })

  it('라이브러리 카드 클릭 시 상세 라우트로 이동한다', async () => {
    const user = userEvent.setup()
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(createMockAuth())

    renderAppAt('/library')

    await user.click(screen.getByRole('button', { name: 'open-storybook-detail' }))

    expect(screen.getByTestId('storybook-detail-page')).toHaveTextContent('storybook-77')
  })

  it('새로고침으로 /storybooks/:storybookId 경로 진입 시 상세 페이지를 렌더링한다', () => {
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(createMockAuth())

    renderAppAt('/storybooks/storybook-88')

    expect(screen.getByTestId('storybook-detail-page')).toHaveTextContent('storybook-88')
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('상세 라우트는 인증이 없으면 로그인 페이지로 이동한다', () => {
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(
      createMockAuth({
        userId: null,
        userEmail: null,
      }),
    )

    renderAppAt('/storybooks/storybook-99')

    expect(screen.getByTestId('login-page')).toHaveTextContent('true')
    expect(screen.queryByTestId('storybook-detail-page')).not.toBeInTheDocument()
  })

  it('상세 페이지 back 동작 시 라이브러리로 이동한다', async () => {
    const user = userEvent.setup()
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(createMockAuth())

    renderAppAt('/storybooks/storybook-55')
    await user.click(screen.getByRole('button', { name: 'detail-back' }))

    expect(screen.getByTestId('library-page')).toHaveTextContent('user-1')
  })
})
