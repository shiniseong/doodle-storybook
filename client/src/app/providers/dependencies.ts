import {
  CreateStorybookUseCase,
  type CreateStorybookUseCasePort,
} from '@features/storybook-creation/application/create-storybook.use-case'
import { HttpStorybookCommandPort } from '@features/storybook-creation/infrastructure/http/storybook-creation.ports.http'
import {
  GetStorybookDetailUseCase,
  type GetStorybookDetailUseCasePort,
} from '@features/storybook-detail/application/get-storybook-detail.use-case'
import { HttpStorybookDetailQueryPort } from '@features/storybook-detail/infrastructure/http/storybook-detail.ports.http'
import {
  ListStorybooksUseCase,
  type ListStorybooksUseCasePort,
} from '@features/storybook-library/application/list-storybooks.use-case'
import { HttpStorybookLibraryQueryPort } from '@features/storybook-library/infrastructure/http/storybook-library.ports.http'
import {
  InMemoryStorybookQuotaPort,
} from '@features/storybook-creation/infrastructure/in-memory/storybook-creation.ports.in-memory'

export interface AppDependencies {
  readonly currentUserId: string
  readonly createStorybookUseCase: CreateStorybookUseCasePort
  readonly listStorybooksUseCase: ListStorybooksUseCasePort
  readonly getStorybookDetailUseCase: GetStorybookDetailUseCasePort
}

interface CreateAppDependenciesOptions {
  currentUserId?: string
}

export const createAppDependencies = (options: CreateAppDependenciesOptions = {}): AppDependencies => {
  const quotaPort = new InMemoryStorybookQuotaPort(true)
  const commandPort = new HttpStorybookCommandPort()
  const storybookLibraryQueryPort = new HttpStorybookLibraryQueryPort()
  const storybookDetailQueryPort = new HttpStorybookDetailQueryPort()

  return {
    currentUserId: options.currentUserId ?? 'demo-user',
    createStorybookUseCase: new CreateStorybookUseCase(quotaPort, commandPort),
    listStorybooksUseCase: new ListStorybooksUseCase(storybookLibraryQueryPort),
    getStorybookDetailUseCase: new GetStorybookDetailUseCase(storybookDetailQueryPort),
  }
}
