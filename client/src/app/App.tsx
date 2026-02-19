import { useMemo } from 'react'

import { createAppDependencies } from '@app/providers/dependencies'
import { HomePage } from '@pages/home/ui/HomePage'

export default function App() {
  const dependencies = useMemo(() => createAppDependencies(), [])

  return <HomePage dependencies={dependencies} />
}
