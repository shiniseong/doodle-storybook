import { type User, type SupabaseClient } from '@supabase/supabase-js'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resolveSupabaseClient } from '@shared/lib/supabase/client'
import { useSupabaseGoogleAuth } from '@shared/lib/supabase/use-supabase-google-auth'

vi.mock('@shared/lib/supabase/client', () => ({
  resolveSupabaseClient: vi.fn(),
}))

type AuthStateChangeHandler = (
  event: string,
  nextSession: {
    user: User | null
  } | null,
) => void

interface MockSupabaseAuthClient {
  client: SupabaseClient
  getUser: ReturnType<typeof vi.fn>
  onAuthStateChange: ReturnType<typeof vi.fn>
  signInWithOAuth: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  unsubscribe: ReturnType<typeof vi.fn>
  emitAuthStateChange: (nextUser: User | null) => void
}

function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    aud: 'authenticated',
    app_metadata: { provider: 'google' },
    user_metadata: {},
    created_at: '2026-02-20T00:00:00.000Z',
    email: 'user-1@example.com',
    ...overrides,
  } as User
}

function createMockSupabaseAuthClient(initialUser: User | null = null): MockSupabaseAuthClient {
  let authStateChangeHandler: AuthStateChangeHandler | null = null
  const unsubscribe = vi.fn()
  const getUser = vi.fn(async () => ({
    data: {
      user: initialUser,
    },
  }))
  const onAuthStateChange = vi.fn((callback: AuthStateChangeHandler) => {
    authStateChangeHandler = callback
    return {
      data: {
        subscription: {
          unsubscribe,
        },
      },
    }
  })
  const signInWithOAuth = vi.fn(async () => ({ error: null }))
  const signOut = vi.fn(async () => ({ error: null }))

  return {
    client: {
      auth: {
        getUser,
        onAuthStateChange,
        signInWithOAuth,
        signOut,
      },
    } as unknown as SupabaseClient,
    getUser,
    onAuthStateChange,
    signInWithOAuth,
    signOut,
    unsubscribe,
    emitAuthStateChange: (nextUser) => {
      if (!authStateChangeHandler) {
        return
      }
      authStateChangeHandler('SIGNED_IN', {
        user: nextUser,
      })
    },
  }
}

function HookHarness() {
  const auth = useSupabaseGoogleAuth()

  return (
    <div>
      <p data-testid="configured">{String(auth.isConfigured)}</p>
      <p data-testid="loading">{String(auth.isLoading)}</p>
      <p data-testid="signing">{String(auth.isSigningIn)}</p>
      <p data-testid="user-id">{auth.userId ?? ''}</p>
      <p data-testid="user-email">{auth.userEmail ?? ''}</p>
      <button
        type="button"
        onClick={() => {
          void auth.signInWithGoogle()
        }}
      >
        sign-in
      </button>
      <button
        type="button"
        onClick={() => {
          void auth.signOut()
        }}
      >
        sign-out
      </button>
    </div>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveSupabaseClient).mockReset()
})

describe('useSupabaseGoogleAuth', () => {
  it('Supabase가 설정되지 않았으면 비활성 상태를 반환한다', async () => {
    vi.mocked(resolveSupabaseClient).mockReturnValue(null)
    const user = userEvent.setup()

    render(<HookHarness />)

    expect(screen.getByTestId('configured')).toHaveTextContent('false')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
    expect(screen.getByTestId('signing')).toHaveTextContent('false')
    expect(screen.getByTestId('user-id')).toHaveTextContent('')
    expect(screen.getByTestId('user-email')).toHaveTextContent('')

    await user.click(screen.getByRole('button', { name: 'sign-in' }))
    await user.click(screen.getByRole('button', { name: 'sign-out' }))
  })

  it('초기 사용자 정보를 읽고 auth 상태 구독을 등록한다', async () => {
    const user = createMockUser()
    const supabase = createMockSupabaseAuthClient(user)
    vi.mocked(resolveSupabaseClient).mockReturnValue(supabase.client)

    render(<HookHarness />)

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
      expect(screen.getByTestId('user-id')).toHaveTextContent(user.id)
      expect(screen.getByTestId('user-email')).toHaveTextContent(user.email ?? '')
    })

    expect(supabase.getUser).toHaveBeenCalledTimes(1)
    expect(supabase.onAuthStateChange).toHaveBeenCalledTimes(1)
  })

  it('사용자 email이 없으면 userEmail은 null로 처리한다', async () => {
    const userWithoutEmail = createMockUser({
      email: undefined,
    })
    const supabase = createMockSupabaseAuthClient(userWithoutEmail)
    vi.mocked(resolveSupabaseClient).mockReturnValue(supabase.client)

    render(<HookHarness />)

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false')
      expect(screen.getByTestId('user-id')).toHaveTextContent(userWithoutEmail.id)
      expect(screen.getByTestId('user-email')).toHaveTextContent('')
    })
  })

  it('Google 로그인 호출 시 OAuth provider와 redirectTo를 전달한다', async () => {
    const supabase = createMockSupabaseAuthClient()
    vi.mocked(resolveSupabaseClient).mockReturnValue(supabase.client)
    const user = userEvent.setup()

    render(<HookHarness />)
    await user.click(screen.getByRole('button', { name: 'sign-in' }))

    await waitFor(() => {
      expect(supabase.signInWithOAuth).toHaveBeenCalledTimes(1)
    })
    expect(supabase.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })
  })

  it('로그인 에러가 나면 signing 상태를 원복한다', async () => {
    const supabase = createMockSupabaseAuthClient()
    supabase.signInWithOAuth.mockResolvedValue({
      error: {
        message: 'mock sign-in failure',
      },
    })
    vi.mocked(resolveSupabaseClient).mockReturnValue(supabase.client)
    const user = userEvent.setup()

    render(<HookHarness />)
    await user.click(screen.getByRole('button', { name: 'sign-in' }))

    await waitFor(() => {
      expect(screen.getByTestId('signing')).toHaveTextContent('false')
    })
  })

  it('auth state 변경 이벤트가 오면 사용자/상태를 갱신한다', async () => {
    const supabase = createMockSupabaseAuthClient()
    vi.mocked(resolveSupabaseClient).mockReturnValue(supabase.client)
    const user = userEvent.setup()

    render(<HookHarness />)
    await user.click(screen.getByRole('button', { name: 'sign-in' }))

    await waitFor(() => {
      expect(screen.getByTestId('signing')).toHaveTextContent('true')
    })

    const nextUser = createMockUser({
      id: 'user-2',
      email: 'user-2@example.com',
    })

    act(() => {
      supabase.emitAuthStateChange(nextUser)
    })

    await waitFor(() => {
      expect(screen.getByTestId('signing')).toHaveTextContent('false')
      expect(screen.getByTestId('user-id')).toHaveTextContent('user-2')
      expect(screen.getByTestId('user-email')).toHaveTextContent('user-2@example.com')
    })
  })

  it('signOut 호출 시 supabase signOut을 실행한다', async () => {
    const supabase = createMockSupabaseAuthClient()
    vi.mocked(resolveSupabaseClient).mockReturnValue(supabase.client)
    const user = userEvent.setup()

    render(<HookHarness />)
    await user.click(screen.getByRole('button', { name: 'sign-out' }))

    await waitFor(() => {
      expect(supabase.signOut).toHaveBeenCalledTimes(1)
    })
  })

  it('언마운트 시 auth 구독을 해제한다', () => {
    const supabase = createMockSupabaseAuthClient()
    vi.mocked(resolveSupabaseClient).mockReturnValue(supabase.client)

    const { unmount } = render(<HookHarness />)
    unmount()

    expect(supabase.unsubscribe).toHaveBeenCalledTimes(1)
  })
})
