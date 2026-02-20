import {
  type StorybookWorkspaceAuth,
  StorybookWorkspace,
  type StorybookWorkspaceDependencies,
} from '@widgets/storybook-workspace/ui/StorybookWorkspace'

interface HomePageProps {
  dependencies: StorybookWorkspaceDependencies
  auth: StorybookWorkspaceAuth
  onRequestAuthentication?: () => void
}

export function HomePage({ dependencies, auth, onRequestAuthentication }: HomePageProps) {
  return <StorybookWorkspace dependencies={dependencies} auth={auth} onRequestAuthentication={onRequestAuthentication} />
}
