import { useMemo } from 'react'

import { createAppDependencies } from '@app/providers/dependencies'
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

  return <HomePage dependencies={dependencies} auth={auth} />
}
