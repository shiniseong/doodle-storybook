import { type StoryLanguage } from '@entities/storybook/model/storybook'
import { type StorybookCommandPort } from '@features/storybook-creation/application/create-storybook.use-case'

interface CreateStorybookApiResponse {
  storybookId: string
}

interface CreateStorybookApiRequest {
  userId: string
  title?: string
  description: string
  language: StoryLanguage
  imageDataUrl?: string
}

interface HttpStorybookCommandPortOptions {
  baseUrl?: string
  endpointPath?: string
}

function resolveCanvasImageDataUrl(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }

  const canvas = document.querySelector<HTMLCanvasElement>('.canvas-stage__surface')

  if (!canvas || canvas.width === 0 || canvas.height === 0) {
    return undefined
  }

  try {
    return canvas.toDataURL('image/png')
  } catch {
    return undefined
  }
}

function resolveApiBaseUrl(explicitBaseUrl?: string): string {
  if (explicitBaseUrl) {
    return explicitBaseUrl
  }

  const fromEnv = import.meta.env.VITE_API_BASE_URL as string | undefined
  return fromEnv ?? ''
}

export class HttpStorybookCommandPort implements StorybookCommandPort {
  private readonly baseUrl: string
  private readonly endpointPath: string

  constructor(options: HttpStorybookCommandPortOptions = {}) {
    this.baseUrl = resolveApiBaseUrl(options.baseUrl)
    this.endpointPath = options.endpointPath ?? '/api/storybooks'
  }

  async createStorybook(draft: {
    userId: string
    title?: string
    description: string
    language: StoryLanguage
  }): Promise<{ storybookId: string }> {
    const endpointUrl = `${this.baseUrl}${this.endpointPath}`
    const imageDataUrl = resolveCanvasImageDataUrl()
    const payload: CreateStorybookApiRequest = {
      userId: draft.userId,
      title: draft.title,
      description: draft.description,
      language: draft.language,
      ...(imageDataUrl ? { imageDataUrl } : {}),
    }

    const response = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Failed to create storybook: ${response.status}`)
    }

    const data = (await response.json()) as Partial<CreateStorybookApiResponse>

    if (!data.storybookId || typeof data.storybookId !== 'string') {
      throw new Error('Invalid API response: storybookId is missing.')
    }

    return {
      storybookId: data.storybookId,
    }
  }
}
