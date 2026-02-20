import { useEffect, useRef, useState } from 'react'
import { Chrome, Mail, MessageCircle, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  type SignInWithEmailResult,
  type SignUpWithEmailResult,
} from '@shared/lib/supabase/use-supabase-google-auth'
import { LanguageSwitcher } from '@shared/ui/language-switcher/LanguageSwitcher'

import './LoginPage.css'

interface LoginPageProps {
  isConfigured: boolean
  isLoading: boolean
  isSigningIn: boolean
  onSignInWithGoogle: () => void | Promise<void>
  onSignInWithKakao: () => void | Promise<void>
  onSignInWithEmail: (input: { email: string; password: string }) => Promise<SignInWithEmailResult>
  onSignUpWithEmail: (input: { email: string; password: string; authorName: string }) => Promise<SignUpWithEmailResult>
}

export function LoginPage({
  isConfigured,
  isLoading,
  isSigningIn,
  onSignInWithGoogle,
  onSignInWithKakao,
  onSignInWithEmail,
  onSignUpWithEmail,
}: LoginPageProps) {
  const { t } = useTranslation()
  const emailInputRef = useRef<HTMLInputElement | null>(null)
  const signUpEmailInputRef = useRef<HTMLInputElement | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [signUpEmail, setSignUpEmail] = useState('')
  const [signUpPassword, setSignUpPassword] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [isSignUpDialogOpen, setIsSignUpDialogOpen] = useState(false)
  const [emailAuthFeedback, setEmailAuthFeedback] = useState('')
  const [isEmailAuthError, setIsEmailAuthError] = useState(false)
  const isDisabled = !isConfigured || isLoading || isSigningIn
  const isEmailSignInDisabled = isDisabled || email.trim().length === 0 || password.length < 6
  const isEmailSignUpDisabled = isDisabled || signUpEmail.trim().length === 0 || signUpPassword.length < 6 || authorName.trim().length === 0
  const statusMessage = isLoading
    ? t('authPage.loadingSession')
    : isSigningIn
      ? t('authPage.signingIn')
      : !isConfigured
        ? t('authPage.notConfigured')
        : ''

  useEffect(() => {
    if (!isSignUpDialogOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    signUpEmailInputRef.current?.focus()

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }

      event.preventDefault()
      setIsSignUpDialogOpen(false)
    }

    window.addEventListener('keydown', handleWindowKeyDown)

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isSignUpDialogOpen])

  const handleEmailSignInSubmit = async () => {
    if (isEmailSignInDisabled) {
      return
    }

    const result = await onSignInWithEmail({
      email: email.trim(),
      password,
    })

    if (result.ok) {
      setIsEmailAuthError(false)
      setEmailAuthFeedback(t('authPage.emailSigninSuccess'))
      return
    }

    setIsEmailAuthError(true)
    setEmailAuthFeedback(
      result.errorMessage
        ? t('authPage.emailSigninFailedWithReason', { reason: result.errorMessage })
        : t('authPage.emailSigninFailed'),
    )
  }

  const handleEmailSignUpSubmit = async () => {
    if (isEmailSignUpDisabled) {
      return
    }

    const normalizedSignUpEmail = signUpEmail.trim()
    const result = await onSignUpWithEmail({
      email: normalizedSignUpEmail,
      password: signUpPassword,
      authorName: authorName.trim(),
    })

    if (result.ok) {
      setIsEmailAuthError(false)
      setEmailAuthFeedback(
        result.requiresEmailVerification
          ? t('authPage.emailSignupVerificationSent')
          : t('authPage.emailSignupSuccess'),
      )
      setEmail(normalizedSignUpEmail)
      setPassword(signUpPassword)
      setIsSignUpDialogOpen(false)
      emailInputRef.current?.focus()
      return
    }

    setIsEmailAuthError(true)
    setEmailAuthFeedback(
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
            className="auth-provider-button auth-provider-button--kakao"
            disabled={isDisabled}
            onClick={() => {
              void onSignInWithKakao()
            }}
          >
            <MessageCircle size={18} strokeWidth={2.1} aria-hidden="true" />
            <span>{t('authPage.startWithKakao')}</span>
          </button>
          <button
            type="button"
            className="auth-provider-button auth-provider-button--email-start"
            disabled={isDisabled}
            onClick={() => {
              setIsEmailAuthError(false)
              setEmailAuthFeedback('')
              setIsSignUpDialogOpen(true)
            }}
          >
            <Mail size={18} strokeWidth={2.1} aria-hidden="true" />
            <span>{t('authPage.startWithEmail')}</span>
          </button>
        </div>
        <div className="auth-page__divider" aria-hidden="true">
          <span>{t('authPage.or')}</span>
        </div>
        <div className="auth-page__email-form">
          <label className="auth-page__field">
            <span>{t('authPage.emailLabel')}</span>
            <input
              ref={emailInputRef}
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
              autoComplete="current-password"
              placeholder={t('authPage.passwordPlaceholder')}
              onChange={(event) => {
                setPassword(event.target.value)
              }}
            />
          </label>
          <p className="auth-page__field-hint">{t('authPage.passwordHint')}</p>
          <button
            type="button"
            className="auth-provider-button auth-provider-button--email-signin"
            disabled={isEmailSignInDisabled}
            onClick={() => {
              void handleEmailSignInSubmit()
            }}
          >
            {isSigningIn ? t('authPage.emailSigningIn') : t('authPage.emailSignIn')}
          </button>
          <p className={`auth-page__email-feedback${isEmailAuthError ? ' auth-page__email-feedback--error' : ''}`} aria-live="polite">
            {emailAuthFeedback}
          </p>
        </div>
        <p className="auth-page__status" aria-live="polite">
          {statusMessage}
        </p>
      </main>
      {isSignUpDialogOpen ? (
        <div
          className="auth-signup-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auth-signup-dialog-title"
          aria-describedby="auth-signup-dialog-description"
        >
          <button
            type="button"
            className="auth-signup-dialog__backdrop"
            aria-label={t('authPage.emailSignupDialogClose')}
            onClick={() => {
              setIsSignUpDialogOpen(false)
            }}
          />
          <article className="auth-signup-dialog__sheet">
            <button
              type="button"
              className="auth-signup-dialog__close"
              aria-label={t('authPage.emailSignupDialogClose')}
              onClick={() => {
                setIsSignUpDialogOpen(false)
              }}
            >
              ×
            </button>
            <h2 id="auth-signup-dialog-title">{t('authPage.emailSignupDialogTitle')}</h2>
            <p id="auth-signup-dialog-description">{t('authPage.emailSignupDialogDescription')}</p>
            <label className="auth-page__field">
              <span>{t('authPage.emailLabel')}</span>
              <input
                ref={signUpEmailInputRef}
                type="email"
                value={signUpEmail}
                autoComplete="email"
                placeholder={t('authPage.emailPlaceholder')}
                onChange={(event) => {
                  setSignUpEmail(event.target.value)
                }}
              />
            </label>
            <label className="auth-page__field">
              <span>{t('authPage.passwordLabel')}</span>
              <input
                type="password"
                value={signUpPassword}
                autoComplete="new-password"
                placeholder={t('authPage.passwordPlaceholder')}
                onChange={(event) => {
                  setSignUpPassword(event.target.value)
                }}
              />
            </label>
            <p className="auth-page__field-hint">{t('authPage.passwordHint')}</p>
            <label className="auth-page__field">
              <span>{t('authPage.authorNameLabel')}</span>
              <div className="auth-page__field-with-icon">
                <UserRound size={16} strokeWidth={2.1} aria-hidden="true" />
                <input
                  type="text"
                  value={authorName}
                  autoComplete="nickname"
                  placeholder={t('authPage.authorNamePlaceholder')}
                  onChange={(event) => {
                    setAuthorName(event.target.value)
                  }}
                />
              </div>
            </label>
            <div className="auth-signup-dialog__actions">
              <button
                type="button"
                className="auth-signup-dialog__action auth-signup-dialog__action--secondary"
                onClick={() => {
                  setIsSignUpDialogOpen(false)
                }}
              >
                {t('authPage.emailSignupDialogCancel')}
              </button>
              <button
                type="button"
                className="auth-provider-button auth-provider-button--email"
                disabled={isEmailSignUpDisabled}
                onClick={() => {
                  void handleEmailSignUpSubmit()
                }}
              >
                {isSigningIn ? t('authPage.emailSigningUp') : t('authPage.emailSignUp')}
              </button>
            </div>
            <p className={`auth-page__email-feedback${isEmailAuthError ? ' auth-page__email-feedback--error' : ''}`} aria-live="polite">
              {emailAuthFeedback}
            </p>
          </article>
        </div>
      ) : null}
    </div>
  )
}
