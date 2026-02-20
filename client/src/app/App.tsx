import { useMemo, useState } from 'react'

import { createAppDependencies } from '@app/providers/dependencies'
import { LoginPage } from '@pages/auth/ui/LoginPage'
import { HomePage } from '@pages/home/ui/HomePage'
import { LandingPage } from '@pages/landing/ui/LandingPage'
import { useSupabaseGoogleAuth } from '@shared/lib/supabase/use-supabase-google-auth'

type AppView = 'landing' | 'workspace' | 'auth'

export default function App() {
  const auth = useSupabaseGoogleAuth()
  const [view, setView] = useState<AppView>('landing')
  const dependencies = useMemo(
    () =>
      createAppDependencies({
        currentUserId: auth.userId ?? 'demo-user',
      }),
    [auth.userId],
  )
  const workspaceAuth = useMemo(
    () => ({
      ...auth,
      signOut: async () => {
        setView('workspace')
        await auth.signOut()
      },
    }),
    [auth],
  )

  if (view === 'landing') {
    return (
      <LandingPage
        onStart={() => {
          setView('workspace')
        }}
      />
    )
  }

  if (view === 'auth' && !auth.userId) {
    return (
      <LoginPage
        isConfigured={auth.isConfigured}
        isLoading={auth.isLoading}
        isSigningIn={auth.isSigningIn}
        onSignInWithGoogle={auth.signInWithGoogle}
        onSignInWithApple={auth.signInWithApple}
        onSignInWithKakao={auth.signInWithKakao}
        onSignInWithEmail={auth.signInWithEmail}
        onSignUpWithEmail={auth.signUpWithEmail}
      />
    )
  }

  return (
    <HomePage
      dependencies={dependencies}
      auth={workspaceAuth}
      onRequestAuthentication={() => {
        setView('auth')
      }}
    />
  )
}
