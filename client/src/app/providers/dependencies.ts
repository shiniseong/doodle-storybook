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
  DeleteStorybookUseCase,
  type DeleteStorybookUseCasePort,
} from '@features/storybook-deletion/application/delete-storybook.use-case'
import { HttpStorybookDeletionCommandPort } from '@features/storybook-deletion/infrastructure/http/storybook-deletion.ports.http'
import {
  ListStorybooksUseCase,
  type ListStorybooksUseCasePort,
} from '@features/storybook-library/application/list-storybooks.use-case'
import { HttpStorybookLibraryQueryPort } from '@features/storybook-library/infrastructure/http/storybook-library.ports.http'
import {
  SubscriptionAccessUseCase,
  type SubscriptionAccessUseCasePort,
} from '@features/subscription-access/application/subscription-access.use-case'
import { HttpSubscriptionAccessPort } from '@features/subscription-access/infrastructure/http/subscription-access.ports.http'
import {
  InMemoryStorybookQuotaPort,
} from '@features/storybook-creation/infrastructure/in-memory/storybook-creation.ports.in-memory'

export interface AppDependencies {
  readonly currentUserId: string
  readonly createStorybookUseCase: CreateStorybookUseCasePort
  readonly listStorybooksUseCase: ListStorybooksUseCasePort
  readonly getStorybookDetailUseCase: GetStorybookDetailUseCasePort
  readonly deleteStorybookUseCase: DeleteStorybookUseCasePort
  readonly subscriptionAccessUseCase?: SubscriptionAccessUseCasePort
}

interface CreateAppDependenciesOptions {
  currentUserId?: string
  accessToken?: string | null
}

export const createAppDependencies = (options: CreateAppDependenciesOptions = {}): AppDependencies => {
  const quotaPort = new InMemoryStorybookQuotaPort(true)
  const commandPort = new HttpStorybookCommandPort({
    accessToken: options.accessToken ?? null,
  })
  const storybookDeletionCommandPort = new HttpStorybookDeletionCommandPort({
    accessToken: options.accessToken ?? null,
  })
  const storybookLibraryQueryPort = new HttpStorybookLibraryQueryPort({
    accessToken: options.accessToken ?? null,
  })
  const storybookDetailQueryPort = new HttpStorybookDetailQueryPort({
    accessToken: options.accessToken ?? null,
  })
  const subscriptionAccessPort = new HttpSubscriptionAccessPort({
    accessToken: options.accessToken ?? null,
  })

  return {
    currentUserId: options.currentUserId ?? 'demo-user',
    createStorybookUseCase: new CreateStorybookUseCase(quotaPort, commandPort),
    listStorybooksUseCase: new ListStorybooksUseCase(storybookLibraryQueryPort),
    getStorybookDetailUseCase: new GetStorybookDetailUseCase(storybookDetailQueryPort),
    deleteStorybookUseCase: new DeleteStorybookUseCase(storybookDeletionCommandPort),
    subscriptionAccessUseCase: new SubscriptionAccessUseCase(subscriptionAccessPort),
  }
}
