import {
  StorybookWorkspace,
  type StorybookWorkspaceDependencies,
} from '@widgets/storybook-workspace/ui/StorybookWorkspace'

interface HomePageProps {
  dependencies: StorybookWorkspaceDependencies
}

export function HomePage({ dependencies }: HomePageProps) {
  return <StorybookWorkspace dependencies={dependencies} />
}
