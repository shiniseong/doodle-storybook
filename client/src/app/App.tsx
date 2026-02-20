import { useMemo, useState } from 'react'

import { createAppDependencies } from '@app/providers/dependencies'
import { LoginPage } from '@pages/auth/ui/LoginPage'
import { HomePage } from '@pages/home/ui/HomePage'
import { useSupabaseGoogleAuth } from '@shared/lib/supabase/use-supabase-google-auth'

export default function App() {
  const auth = useSupabaseGoogleAuth()
  const [isAuthPageVisible, setIsAuthPageVisible] = useState(false)
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
        setIsAuthPageVisible(false)
        await auth.signOut()
      },
    }),
    [auth],
  )

  if (isAuthPageVisible && !auth.userId) {
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
          setIsAuthPageVisible(true)
        }}
    />
  )
}
