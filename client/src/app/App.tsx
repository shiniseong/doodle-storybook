import { useMemo } from 'react'
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'

import { createAppDependencies } from '@app/providers/dependencies'
import { LoginPage } from '@pages/auth/ui/LoginPage'
import { HomePage } from '@pages/home/ui/HomePage'
import { LandingPage } from '@pages/landing/ui/LandingPage'
import { LibraryPage } from '@pages/library/ui/LibraryPage'
import { StorybookDetailPage } from '@pages/storybook-detail/ui/StorybookDetailPage'
import { useSupabaseGoogleAuth } from '@shared/lib/supabase/use-supabase-google-auth'
import { ThemeProvider } from '@shared/lib/theme/theme-context'

interface StorybookDetailRouteProps {
  dependencies: ReturnType<typeof createAppDependencies>
  userId: string
  onBack: () => void
}

function StorybookDetailRoute({ dependencies, userId, onBack }: StorybookDetailRouteProps) {
  const params = useParams<{ storybookId: string }>()
  const storybookId = params.storybookId?.trim() ?? ''

  if (storybookId.length === 0) {
    return <Navigate to="/library" replace />
  }

  return (
    <StorybookDetailPage
      dependencies={dependencies}
      userId={userId}
      storybookId={storybookId}
      onBack={onBack}
    />
  )
}

export default function App() {
  const auth = useSupabaseGoogleAuth()
  const navigate = useNavigate()
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
        navigate('/create', { replace: true })
        await auth.signOut()
      },
    }),
    [auth, navigate],
  )

  return (
    <ThemeProvider>
      <Routes>
        <Route
          path="/"
          element={
            <LandingPage
              onStart={() => {
                navigate('/create')
              }}
            />
          }
        />
        <Route
          path="/create"
          element={
            <HomePage
              dependencies={dependencies}
              auth={workspaceAuth}
              onRequestAuthentication={() => {
                navigate('/auth')
              }}
              onNavigateToLibrary={() => {
                navigate('/library')
              }}
            />
          }
        />
        <Route
          path="/library"
          element={
            auth.userId ? (
              <LibraryPage
                dependencies={dependencies}
                userId={auth.userId}
                onBackToCreate={() => {
                  navigate('/create')
                }}
                onOpenStorybookDetail={(storybookId) => {
                  navigate(`/storybooks/${storybookId}`)
                }}
              />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route
          path="/storybooks/:storybookId"
          element={
            auth.userId ? (
              <StorybookDetailRoute
                dependencies={dependencies}
                userId={auth.userId}
                onBack={() => {
                  navigate('/library')
                }}
              />
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route
          path="/auth"
          element={
            auth.userId ? (
              <Navigate to="/create" replace />
            ) : (
              <LoginPage
                isConfigured={auth.isConfigured}
                isLoading={auth.isLoading}
                isSigningIn={auth.isSigningIn}
                onSignInWithGoogle={auth.signInWithGoogle}
                onSignInWithKakao={auth.signInWithKakao}
                onSignInWithEmail={auth.signInWithEmail}
                onSignUpWithEmail={auth.signUpWithEmail}
              />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  )
}
