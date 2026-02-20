import { useState } from 'react'
import { Apple, Chrome, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { type SignUpWithEmailResult } from '@shared/lib/supabase/use-supabase-google-auth'
import { LanguageSwitcher } from '@shared/ui/language-switcher/LanguageSwitcher'

import './LoginPage.css'

interface LoginPageProps {
  isConfigured: boolean
  isLoading: boolean
  isSigningIn: boolean
  onSignInWithGoogle: () => void | Promise<void>
  onSignInWithApple: () => void | Promise<void>
  onSignInWithKakao: () => void | Promise<void>
  onSignUpWithEmail: (input: { email: string; password: string }) => Promise<SignUpWithEmailResult>
}

export function LoginPage({
  isConfigured,
  isLoading,
  isSigningIn,
  onSignInWithGoogle,
  onSignInWithApple,
  onSignInWithKakao,
  onSignUpWithEmail,
}: LoginPageProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailSignUpFeedback, setEmailSignUpFeedback] = useState('')
  const [isEmailSignUpError, setIsEmailSignUpError] = useState(false)
  const isDisabled = !isConfigured || isLoading || isSigningIn
  const isEmailSignUpDisabled = isDisabled || email.trim().length === 0 || password.length < 6
  const statusMessage = isLoading
    ? t('authPage.loadingSession')
    : isSigningIn
      ? t('authPage.signingIn')
      : !isConfigured
        ? t('authPage.notConfigured')
        : ''

  const handleEmailSignUpSubmit = async () => {
    if (isEmailSignUpDisabled) {
      return
    }

    const result = await onSignUpWithEmail({
      email: email.trim(),
      password,
    })

    if (result.ok) {
      setIsEmailSignUpError(false)
      setEmailSignUpFeedback(
        result.requiresEmailVerification
          ? t('authPage.emailSignupVerificationSent')
          : t('authPage.emailSignupSuccess'),
      )
      return
    }

    setIsEmailSignUpError(true)
    setEmailSignUpFeedback(
      result.errorMessage
        ? t('authPage.emailSignupFailedWithReason', { reason: result.errorMessage })
        : t('authPage.emailSignupFailed'),
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-page__backdrop" aria-hidden="true" />
      <main className="auth-page__card" aria-labelledby="auth-page-title">
        <div className="auth-page__header">
          <LanguageSwitcher />
        </div>
        <h1 id="auth-page-title">{t('authPage.title')}</h1>
        <p className="auth-page__description">{t('authPage.description')}</p>
        <div className="auth-page__actions">
          <button
            type="button"
            className="auth-provider-button auth-provider-button--google"
            disabled={isDisabled}
            onClick={() => {
              void onSignInWithGoogle()
            }}
          >
            <Chrome size={18} strokeWidth={2.1} aria-hidden="true" />
            <span>{t('authPage.startWithGoogle')}</span>
          </button>
          <button
            type="button"
            className="auth-provider-button auth-provider-button--apple"
            disabled={isDisabled}
            onClick={() => {
              void onSignInWithApple()
            }}
          >
            <Apple size={18} strokeWidth={2.1} aria-hidden="true" />
            <span>{t('authPage.startWithApple')}</span>
          </button>
          <button
            type="button"
            className="auth-provider-button auth-provider-button--kakao"
            disabled={isDisabled}
            onClick={() => {
              void onSignInWithKakao()
            }}
          >
            <MessageCircle size={18} strokeWidth={2.1} aria-hidden="true" />
            <span>{t('authPage.startWithKakao')}</span>
          </button>
        </div>
        <div className="auth-page__divider" aria-hidden="true">
          <span>{t('authPage.or')}</span>
        </div>
        <form
          className="auth-page__email-signup-form"
          onSubmit={(event) => {
            event.preventDefault()
            void handleEmailSignUpSubmit()
          }}
        >
          <label className="auth-page__field">
            <span>{t('authPage.emailLabel')}</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              placeholder={t('authPage.emailPlaceholder')}
              onChange={(event) => {
                setEmail(event.target.value)
              }}
            />
          </label>
          <label className="auth-page__field">
            <span>{t('authPage.passwordLabel')}</span>
            <input
              type="password"
              value={password}
              autoComplete="new-password"
              placeholder={t('authPage.passwordPlaceholder')}
              onChange={(event) => {
                setPassword(event.target.value)
              }}
            />
          </label>
          <p className="auth-page__field-hint">{t('authPage.passwordHint')}</p>
          <button
            type="submit"
            className="auth-provider-button auth-provider-button--email"
            disabled={isEmailSignUpDisabled}
          >
            {isSigningIn ? t('authPage.emailSigningUp') : t('authPage.emailSignUp')}
          </button>
          <p className={`auth-page__email-feedback${isEmailSignUpError ? ' auth-page__email-feedback--error' : ''}`} aria-live="polite">
            {emailSignUpFeedback}
          </p>
        </form>
        <p className="auth-page__status" aria-live="polite">
          {statusMessage}
        </p>
      </main>
    </div>
  )
}
