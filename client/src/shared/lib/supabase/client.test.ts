import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

const VITE_SUPABASE_URL = 'https://vite-project.supabase.co'
const VITE_SUPABASE_KEY = 'sb_publishable_vite_key'
const NEXT_PUBLIC_SUPABASE_URL = 'https://next-project.supabase.co'
const NEXT_PUBLIC_SUPABASE_KEY = 'sb_publishable_next_key'

function createMockClient(label: string): SupabaseClient {
  return { __label: label } as unknown as SupabaseClient
}

function getCreateClientMock(): ReturnType<typeof vi.fn> {
  return createClient as unknown as ReturnType<typeof vi.fn>
}

async function loadClientModule() {
  return import('@shared/lib/supabase/client')
}

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  getCreateClientMock().mockReset()
})

describe('supabase client module', () => {
  it('환경변수가 없으면 client를 만들지 않는다', async () => {
    const module = await loadClientModule()

    expect(module.resolveSupabaseCredentials()).toBeNull()
    expect(module.resolveSupabaseClient()).toBeNull()
    expect(module.supabase).toBeNull()
    expect(createClient).not.toHaveBeenCalled()
  })

  it('VITE 환경변수가 있으면 publishable key로 client를 초기화한다', async () => {
    const mockClient = createMockClient('vite')
    vi.stubEnv('VITE_SUPABASE_URL', VITE_SUPABASE_URL)
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY', VITE_SUPABASE_KEY)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', NEXT_PUBLIC_SUPABASE_URL)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', NEXT_PUBLIC_SUPABASE_KEY)
    getCreateClientMock().mockReturnValue(mockClient)

    const module = await loadClientModule()
    const firstResolved = module.resolveSupabaseClient()
    const secondResolved = module.resolveSupabaseClient()

    expect(module.resolveSupabaseCredentials()).toEqual({
      url: VITE_SUPABASE_URL,
      publishableKey: VITE_SUPABASE_KEY,
    })
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(createClient).toHaveBeenCalledWith(
      VITE_SUPABASE_URL,
      VITE_SUPABASE_KEY,
      expect.objectContaining({
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
        },
      }),
    )
    expect(module.supabase).toBe(mockClient)
    expect(firstResolved).toBe(mockClient)
    expect(secondResolved).toBe(mockClient)
  })

  it('VITE 값이 없으면 NEXT_PUBLIC 값을 fallback으로 사용한다', async () => {
    const mockClient = createMockClient('next')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', NEXT_PUBLIC_SUPABASE_URL)
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', NEXT_PUBLIC_SUPABASE_KEY)
    getCreateClientMock().mockReturnValue(mockClient)

    const module = await loadClientModule()

    expect(module.resolveSupabaseCredentials()).toEqual({
      url: NEXT_PUBLIC_SUPABASE_URL,
      publishableKey: NEXT_PUBLIC_SUPABASE_KEY,
    })
    expect(module.resolveSupabaseClient()).toBe(mockClient)
  })

  it('legacy anon key도 fallback으로 허용한다', async () => {
    const mockClient = createMockClient('legacy-anon')
    vi.stubEnv('VITE_SUPABASE_URL', VITE_SUPABASE_URL)
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_legacy_anon_key')
    getCreateClientMock().mockReturnValue(mockClient)

    const module = await loadClientModule()

    expect(module.resolveSupabaseCredentials()).toEqual({
      url: VITE_SUPABASE_URL,
      publishableKey: 'sb_legacy_anon_key',
    })
    expect(module.resolveSupabaseClient()).toBe(mockClient)
  })
})
