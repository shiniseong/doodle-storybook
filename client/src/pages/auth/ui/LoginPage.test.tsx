import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LoginPage } from '@pages/auth/ui/LoginPage'

describe('LoginPage', () => {
  it('소셜 로그인 버튼을 렌더링하고 클릭 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const onSignInWithGoogle = vi.fn()
    const onSignInWithApple = vi.fn()
    const onSignInWithKakao = vi.fn()
    const onSignUpWithEmail = vi.fn(async () => ({ ok: true, requiresEmailVerification: true }))

    render(
      <LoginPage
        isConfigured
        isLoading={false}
        isSigningIn={false}
        onSignInWithGoogle={onSignInWithGoogle}
        onSignInWithApple={onSignInWithApple}
        onSignInWithKakao={onSignInWithKakao}
        onSignUpWithEmail={onSignUpWithEmail}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Google로 시작하기' }))
    await user.click(screen.getByRole('button', { name: 'Apple로 시작하기' }))
    await user.click(screen.getByRole('button', { name: '카카오로 시작하기' }))

    expect(onSignInWithGoogle).toHaveBeenCalledTimes(1)
    expect(onSignInWithApple).toHaveBeenCalledTimes(1)
    expect(onSignInWithKakao).toHaveBeenCalledTimes(1)
  })

  it('이메일 회원가입 폼을 제출하면 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const onSignUpWithEmail = vi.fn(async () => ({
      ok: true,
      requiresEmailVerification: true,
    }))

    render(
      <LoginPage
        isConfigured
        isLoading={false}
        isSigningIn={false}
        onSignInWithGoogle={vi.fn()}
        onSignInWithApple={vi.fn()}
        onSignInWithKakao={vi.fn()}
        onSignUpWithEmail={onSignUpWithEmail}
      />,
    )

    await user.type(screen.getByLabelText('이메일'), 'new-user@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'passw0rd')
    await user.click(screen.getByRole('button', { name: '이메일로 회원가입' }))

    expect(onSignUpWithEmail).toHaveBeenCalledTimes(1)
    expect(onSignUpWithEmail).toHaveBeenCalledWith({
      email: 'new-user@example.com',
      password: 'passw0rd',
    })
    expect(screen.getByText('인증 메일을 보냈어요. 이메일을 확인해 주세요.')).toBeInTheDocument()
  })

  it('설정되지 않았거나 로딩/로그인 중이면 버튼을 비활성화한다', () => {
    render(
      <LoginPage
        isConfigured={false}
        isLoading={false}
        isSigningIn={false}
        onSignInWithGoogle={vi.fn()}
        onSignInWithApple={vi.fn()}
        onSignInWithKakao={vi.fn()}
        onSignUpWithEmail={vi.fn(async () => ({ ok: false, requiresEmailVerification: true }))}
      />,
    )

    expect(screen.getByText('Supabase 인증 환경설정이 필요해요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Google로 시작하기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Apple로 시작하기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '카카오로 시작하기' })).toBeDisabled()
  })
})
