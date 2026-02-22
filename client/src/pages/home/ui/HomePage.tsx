import {
  type StorybookWorkspaceAuth,
  StorybookWorkspace,
  type StorybookWorkspaceDependencies,
} from '@widgets/storybook-workspace/ui/StorybookWorkspace'

interface HomePageProps {
  dependencies: StorybookWorkspaceDependencies
  auth: StorybookWorkspaceAuth
  onRequestAuthentication?: () => void
  onNavigateToLibrary?: () => void
}

export function HomePage({ dependencies, auth, onRequestAuthentication, onNavigateToLibrary }: HomePageProps) {
  return (
    <StorybookWorkspace
      dependencies={dependencies}
      auth={auth}
      onRequestAuthentication={onRequestAuthentication}
      onNavigateToLibrary={onNavigateToLibrary}
    />
  )
}
