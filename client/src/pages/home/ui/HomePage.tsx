import {
  type StorybookWorkspaceAuth,
  StorybookWorkspace,
  type StorybookWorkspaceDependencies,
} from '@widgets/storybook-workspace/ui/StorybookWorkspace'

interface HomePageProps {
  dependencies: StorybookWorkspaceDependencies
  auth: StorybookWorkspaceAuth
}

export function HomePage({ dependencies, auth }: HomePageProps) {
  return <StorybookWorkspace dependencies={dependencies} auth={auth} />
}
