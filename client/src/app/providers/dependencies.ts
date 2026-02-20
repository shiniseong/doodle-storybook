import {
  CreateStorybookUseCase,
  type CreateStorybookUseCasePort,
} from '@features/storybook-creation/application/create-storybook.use-case'
import { HttpStorybookCommandPort } from '@features/storybook-creation/infrastructure/http/storybook-creation.ports.http'
import {
  InMemoryStorybookQuotaPort,
} from '@features/storybook-creation/infrastructure/in-memory/storybook-creation.ports.in-memory'

export interface AppDependencies {
  readonly currentUserId: string
  readonly createStorybookUseCase: CreateStorybookUseCasePort
}

export const createAppDependencies = (): AppDependencies => {
  const quotaPort = new InMemoryStorybookQuotaPort(true)
  const commandPort = new HttpStorybookCommandPort()

  return {
    currentUserId: 'demo-user',
    createStorybookUseCase: new CreateStorybookUseCase(quotaPort, commandPort),
  }
}
