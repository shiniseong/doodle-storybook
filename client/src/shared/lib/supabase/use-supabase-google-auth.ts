import { type User } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { resolveSupabaseClient } from '@shared/lib/supabase/client'

type SupportedSupabaseOAuthProvider = 'google' | 'kakao'

interface SignInWithEmailInput {
  readonly email: string
  readonly password: string
}

interface SignUpWithEmailInput {
  readonly email: string
  readonly password: string
  readonly authorName: string
}

export interface SignInWithEmailResult {
  readonly ok: boolean
  readonly errorMessage?: string
}

export interface SignUpWithEmailResult {
  readonly ok: boolean
  readonly requiresEmailVerification: boolean
  readonly errorMessage?: string
}

export interface SupabaseGoogleAuthResult {
  readonly isConfigured: boolean
  readonly isLoading: boolean
  readonly isSigningIn: boolean
  readonly userId: string | null
  readonly userEmail: string | null
  readonly signInWithEmail: (input: SignInWithEmailInput) => Promise<SignInWithEmailResult>
  readonly signUpWithEmail: (input: SignUpWithEmailInput) => Promise<SignUpWithEmailResult>
  readonly signInWithProvider: (provider: SupportedSupabaseOAuthProvider) => Promise<void>
  readonly signInWithGoogle: () => Promise<void>
  readonly signInWithKakao: () => Promise<void>
  readonly signOut: () => Promise<void>
}

function resolveUserEmail(user: User | null): string | null {
  if (!user) {
    return null
  }

  if (typeof user.email === 'string' && user.email.length > 0) {
    return user.email
  }

  return null
}

export function useSupabaseGoogleAuth(): SupabaseGoogleAuthResult {
  const supabaseClient = useMemo(() => resolveSupabaseClient(), [])
  const isConfigured = supabaseClient !== null
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(isConfigured)
  const [isSigningIn, setIsSigningIn] = useState(false)

  useEffect(() => {
    if (!supabaseClient) {
      return
    }

    let isSubscribed = true

    void supabaseClient.auth.getUser().then(({ data }) => {
      if (!isSubscribed) {
        return
      }

      setUser(data.user ?? null)
      setIsLoading(false)
    })

    const authSubscription = supabaseClient.auth.onAuthStateChange((_event, nextSession) => {
      setUser(nextSession?.user ?? null)
      setIsLoading(false)
      setIsSigningIn(false)
    })

    return () => {
      isSubscribed = false
      authSubscription.data.subscription.unsubscribe()
    }
  }, [supabaseClient])

  const signInWithProvider = useCallback(async (provider: SupportedSupabaseOAuthProvider) => {
    if (!supabaseClient || isSigningIn) {
      return
    }

    const redirectTo = typeof window === 'undefined' ? undefined : window.location.origin
    setIsSigningIn(true)

    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider,
      ...(redirectTo ? { options: { redirectTo } } : {}),
    })

    if (error) {
      setIsSigningIn(false)
    }
  }, [isSigningIn, supabaseClient])

  const signInWithGoogle = useCallback(async () => {
    await signInWithProvider('google')
  }, [signInWithProvider])

  const signInWithKakao = useCallback(async () => {
    await signInWithProvider('kakao')
  }, [signInWithProvider])

  const signInWithEmail = useCallback(
    async ({ email, password }: SignInWithEmailInput): Promise<SignInWithEmailResult> => {
      if (!supabaseClient || isSigningIn) {
        return {
          ok: false,
        }
      }

      const normalizedEmail = email.trim()
      if (normalizedEmail.length === 0 || password.length === 0) {
        return {
          ok: false,
        }
      }

      setIsSigningIn(true)

      const { error } = await supabaseClient.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      setIsSigningIn(false)

      if (error) {
        return {
          ok: false,
          errorMessage: error.message,
        }
      }

      return {
        ok: true,
      }
    },
    [isSigningIn, supabaseClient],
  )

  const signUpWithEmail = useCallback(
    async ({ email, password, authorName }: SignUpWithEmailInput): Promise<SignUpWithEmailResult> => {
      if (!supabaseClient || isSigningIn) {
        return {
          ok: false,
          requiresEmailVerification: true,
        }
      }

      const normalizedEmail = email.trim()
      const normalizedAuthorName = authorName.trim()
      if (normalizedEmail.length === 0 || password.length === 0 || normalizedAuthorName.length === 0) {
        return {
          ok: false,
          requiresEmailVerification: true,
        }
      }

      const emailRedirectTo = typeof window === 'undefined' ? undefined : window.location.origin
      setIsSigningIn(true)

      const { data, error } = await supabaseClient.auth.signUp({
        email: normalizedEmail,
        password,
        ...(emailRedirectTo
          ? {
              options: {
                emailRedirectTo,
                data: {
                  author_name: normalizedAuthorName,
                },
              },
            }
          : {}),
      })

      setIsSigningIn(false)

      if (error) {
        return {
          ok: false,
          requiresEmailVerification: true,
          errorMessage: error.message,
        }
      }

      return {
        ok: true,
        requiresEmailVerification: data.session === null,
      }
    },
    [isSigningIn, supabaseClient],
  )

  const signOut = useCallback(async () => {
    if (!supabaseClient) {
      return
    }

    await supabaseClient.auth.signOut()
  }, [supabaseClient])

  return {
    isConfigured,
    isLoading,
    isSigningIn,
    userId: user?.id ?? null,
    userEmail: resolveUserEmail(user),
    signInWithEmail,
    signUpWithEmail,
    signInWithProvider,
    signInWithGoogle,
    signInWithKakao,
    signOut,
  }
}
