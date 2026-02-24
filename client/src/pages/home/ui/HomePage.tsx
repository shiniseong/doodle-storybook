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
  onRequireAgreements?: () => void
}

export function HomePage({
  dependencies,
  auth,
  onRequestAuthentication,
  onNavigateToLibrary,
  onRequireAgreements,
}: HomePageProps) {
  return (
    <StorybookWorkspace
      dependencies={dependencies}
      auth={auth}
      onRequestAuthentication={onRequestAuthentication}
      onNavigateToLibrary={onNavigateToLibrary}
      onRequireAgreements={onRequireAgreements}
    />
  )
}
