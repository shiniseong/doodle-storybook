import { describe, expect, it } from 'vitest'

const shouldRunLiveCheck = import.meta.env.VITE_SUPABASE_LIVE_CHECK === '1'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const supabaseTableName = import.meta.env.VITE_SUPABASE_LIVE_CHECK_TABLE

const describeLive = shouldRunLiveCheck ? describe : describe.skip

describeLive('Supabase live API check (optional)', () => {
  it('auth settings endpoint에 접근할 수 있다', async () => {
    expect(supabaseUrl).toBeTruthy()
    expect(supabasePublishableKey).toBeTruthy()

    if (!supabaseUrl || !supabasePublishableKey) {
      return
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: supabasePublishableKey,
      },
    })

    expect(response.status).toBeGreaterThan(0)
    expect(response.status).toBeLessThan(500)
  })

  const itWithTable = supabaseTableName ? it : it.skip
  itWithTable('선택된 테이블에 read 요청을 보낼 수 있다', async () => {
    expect(supabaseUrl).toBeTruthy()
    expect(supabasePublishableKey).toBeTruthy()

    if (!supabaseUrl || !supabasePublishableKey || !supabaseTableName) {
      return
    }

    const response = await fetch(
      `${supabaseUrl}/rest/v1/${encodeURIComponent(supabaseTableName)}?select=*&limit=1`,
      {
        method: 'GET',
        headers: {
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${supabasePublishableKey}`,
        },
      },
    )

    expect(response.status).toBeGreaterThan(0)
    expect(response.status).toBeLessThan(500)
  })
})
