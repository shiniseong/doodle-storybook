import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LoginPage } from '@pages/auth/ui/LoginPage'

describe('LoginPage', () => {
  it('소셜 로그인 버튼을 렌더링하고 클릭 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const onSignInWithGoogle = vi.fn()
    const onSignInWithKakao = vi.fn()
    const onSignInWithEmail = vi.fn(async () => ({ ok: true }))
    const onSignUpWithEmail = vi.fn(async () => ({ ok: true, requiresEmailVerification: true }))

    render(
      <LoginPage
        isConfigured
        isLoading={false}
        isSigningIn={false}
        onSignInWithGoogle={onSignInWithGoogle}
        onSignInWithKakao={onSignInWithKakao}
        onSignInWithEmail={onSignInWithEmail}
        onSignUpWithEmail={onSignUpWithEmail}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Google로 시작하기' }))
    await user.click(screen.getByRole('button', { name: '카카오로 시작하기' }))

    expect(onSignInWithGoogle).toHaveBeenCalledTimes(1)
    expect(onSignInWithKakao).toHaveBeenCalledTimes(1)
  })

  it('이메일/비밀번호 입력 후 이메일 로그인 버튼이 동작한다', async () => {
    const user = userEvent.setup()
    const onSignInWithEmail = vi.fn(async () => ({ ok: true }))

    render(
      <LoginPage
        isConfigured
        isLoading={false}
        isSigningIn={false}
        onSignInWithGoogle={vi.fn()}
        onSignInWithKakao={vi.fn()}
        onSignInWithEmail={onSignInWithEmail}
        onSignUpWithEmail={vi.fn(async () => ({ ok: true, requiresEmailVerification: true }))}
      />,
    )

    await user.type(screen.getByLabelText('이메일'), 'login-user@example.com')
    await user.type(screen.getByLabelText('비밀번호'), 'passw0rd')
    await user.click(screen.getByRole('button', { name: '이메일로 로그인' }))

    expect(onSignInWithEmail).toHaveBeenCalledWith({
      email: 'login-user@example.com',
      password: 'passw0rd',
    })
  })

  it('이메일로 시작하기를 누르면 회원가입 모달이 열리고 제출 시 작가명까지 포함해 콜백을 호출한다', async () => {
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
        onSignInWithKakao={vi.fn()}
        onSignInWithEmail={vi.fn(async () => ({ ok: true }))}
        onSignUpWithEmail={onSignUpWithEmail}
      />,
    )

    await user.click(screen.getByRole('button', { name: '이메일로 시작하기' }))
    const dialog = screen.getByRole('dialog', { name: '이메일로 회원가입' })

    await user.type(within(dialog).getByLabelText('이메일'), 'new-user@example.com')
    await user.type(within(dialog).getByLabelText('비밀번호'), 'passw0rd')
    await user.type(within(dialog).getByLabelText('작가명'), '달빛 작가')
    await user.click(within(dialog).getByRole('button', { name: '이메일로 회원가입' }))

    expect(onSignUpWithEmail).toHaveBeenCalledTimes(1)
    expect(onSignUpWithEmail).toHaveBeenCalledWith({
      email: 'new-user@example.com',
      password: 'passw0rd',
      authorName: '달빛 작가',
    })
    expect(screen.getByText('인증 메일을 보냈어요. 이메일을 확인해 주세요.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '이메일로 회원가입' })).not.toBeInTheDocument()
  })

  it('로그인/가입 섹션에는 인라인 회원가입 UI가 없다', () => {
    render(
      <LoginPage
        isConfigured
        isLoading={false}
        isSigningIn={false}
        onSignInWithGoogle={vi.fn()}
        onSignInWithKakao={vi.fn()}
        onSignInWithEmail={vi.fn(async () => ({ ok: true }))}
        onSignUpWithEmail={vi.fn(async () => ({ ok: true, requiresEmailVerification: true }))}
      />,
    )

    expect(screen.queryByLabelText('작가명')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '이메일로 회원가입' })).not.toBeInTheDocument()
  })

  it('설정되지 않았거나 로딩/로그인 중이면 버튼을 비활성화한다', () => {
    render(
      <LoginPage
        isConfigured={false}
        isLoading={false}
        isSigningIn={false}
        onSignInWithGoogle={vi.fn()}
        onSignInWithKakao={vi.fn()}
        onSignInWithEmail={vi.fn(async () => ({ ok: false }))}
        onSignUpWithEmail={vi.fn(async () => ({ ok: false, requiresEmailVerification: true }))}
      />,
    )

    expect(screen.getByText('Supabase 인증 환경설정이 필요해요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Google로 시작하기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '카카오로 시작하기' })).toBeDisabled()
  })
})
