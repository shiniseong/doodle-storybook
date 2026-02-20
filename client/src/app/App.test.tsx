import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import App from '@app/App'
import { useSupabaseGoogleAuth, type SupabaseGoogleAuthResult } from '@shared/lib/supabase/use-supabase-google-auth'

vi.mock('@shared/lib/supabase/use-supabase-google-auth', () => ({
  useSupabaseGoogleAuth: vi.fn(),
}))

vi.mock('@pages/home/ui/HomePage', () => ({
  HomePage: ({
    dependencies,
    onRequestAuthentication,
  }: {
    dependencies: {
      currentUserId: string
    }
    onRequestAuthentication?: () => void
  }) => (
    <div data-testid="home-page">
      {dependencies.currentUserId}
      <button type="button" onClick={onRequestAuthentication}>
        open-auth
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

function createMockAuth(overrides: Partial<SupabaseGoogleAuthResult> = {}): SupabaseGoogleAuthResult {
  return {
    isConfigured: true,
    isLoading: false,
    isSigningIn: false,
    userId: 'user-1',
    userEmail: 'user-1@example.com',
    signInWithEmail: vi.fn(async () => ({ ok: true })),
    signUpWithEmail: vi.fn(async () => ({ ok: true, requiresEmailVerification: true })),
    signInWithProvider: vi.fn(async () => {}),
    signInWithGoogle: vi.fn(async () => {}),
    signInWithApple: vi.fn(async () => {}),
    signInWithKakao: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('App', () => {
  it('기본 진입은 랜딩 페이지다', () => {
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(createMockAuth())

    render(<App />)

    expect(screen.getByTestId('landing-page')).toBeInTheDocument()
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('랜딩에서 시작 버튼을 누르면 홈 페이지를 렌더링한다', async () => {
    const user = userEvent.setup()
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(createMockAuth())

    render(<App />)
    await user.click(screen.getByRole('button', { name: 'start-workspace' }))

    expect(screen.getByTestId('home-page')).toHaveTextContent('user-1')
    expect(screen.queryByTestId('landing-page')).not.toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('로그인되지 않은 상태에서 랜딩을 거쳐도 홈 페이지는 demo-user로 동작한다', async () => {
    const user = userEvent.setup()
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(
      createMockAuth({
        userId: null,
        userEmail: null,
      }),
    )

    render(<App />)
    await user.click(screen.getByRole('button', { name: 'start-workspace' }))

    expect(screen.getByTestId('home-page')).toHaveTextContent('demo-user')
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument()
  })

  it('홈에서 인증 페이지 요청 시 로그인 페이지를 렌더링한다', async () => {
    const user = userEvent.setup()
    vi.mocked(useSupabaseGoogleAuth).mockReturnValue(
      createMockAuth({
        userId: null,
        userEmail: null,
      }),
    )

    render(<App />)
    await user.click(screen.getByRole('button', { name: 'start-workspace' }))

    await user.click(screen.getByRole('button', { name: 'open-auth' }))

    expect(screen.getByTestId('login-page')).toHaveTextContent('true')
    expect(screen.queryByTestId('home-page')).not.toBeInTheDocument()
  })
})
