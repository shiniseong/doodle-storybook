import { useMemo } from 'react'

import { createAppDependencies } from '@app/providers/dependencies'
import { LoginPage } from '@pages/auth/ui/LoginPage'
import { HomePage } from '@pages/home/ui/HomePage'
import { useSupabaseGoogleAuth } from '@shared/lib/supabase/use-supabase-google-auth'

export default function App() {
  const auth = useSupabaseGoogleAuth()
  const dependencies = useMemo(
    () =>
      createAppDependencies({
        currentUserId: auth.userId ?? 'demo-user',
      }),
    [auth.userId],
  )

  if (!auth.userId) {
    return (
      <LoginPage
        isConfigured={auth.isConfigured}
        isLoading={auth.isLoading}
        isSigningIn={auth.isSigningIn}
        onSignInWithGoogle={auth.signInWithGoogle}
        onSignInWithApple={auth.signInWithApple}
        onSignInWithKakao={auth.signInWithKakao}
        onSignUpWithEmail={auth.signUpWithEmail}
      />
    )
  }

  return <HomePage dependencies={dependencies} auth={auth} />
}
