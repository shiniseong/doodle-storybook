import {
  CreateStorybookUseCase,
  type CreateStorybookUseCasePort,
} from '@features/storybook-creation/application/create-storybook.use-case'
import {
  InMemoryStorybookCommandPort,
  InMemoryStorybookQuotaPort,
} from '@features/storybook-creation/infrastructure/in-memory/storybook-creation.ports.in-memory'

export interface AppDependencies {
  readonly currentUserId: string
  readonly createStorybookUseCase: CreateStorybookUseCasePort
}

export const createAppDependencies = (): AppDependencies => {
  const quotaPort = new InMemoryStorybookQuotaPort(true)
  const commandPort = new InMemoryStorybookCommandPort()

  return {
    currentUserId: 'demo-user',
    createStorybookUseCase: new CreateStorybookUseCase(quotaPort, commandPort),
  }
}
