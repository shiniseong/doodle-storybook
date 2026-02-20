import { type User } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { resolveSupabaseClient } from '@shared/lib/supabase/client'

interface SupabaseGoogleAuthResult {
  readonly isConfigured: boolean
  readonly isLoading: boolean
  readonly isSigningIn: boolean
  readonly userId: string | null
  readonly userEmail: string | null
  readonly signInWithGoogle: () => Promise<void>
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

  const signInWithGoogle = useCallback(async () => {
    if (!supabaseClient || isSigningIn) {
      return
    }

    const redirectTo = typeof window === 'undefined' ? undefined : window.location.origin
    setIsSigningIn(true)

    const { error } = await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      ...(redirectTo ? { options: { redirectTo } } : {}),
    })

    if (error) {
      setIsSigningIn(false)
    }
  }, [isSigningIn, supabaseClient])

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
    signInWithGoogle,
    signOut,
  }
}
