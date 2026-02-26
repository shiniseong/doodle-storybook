import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppFooter } from '@shared/ui/app-footer/AppFooter'

function createTextResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

describe('AppFooter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('푸터 이용약관 클릭 시 문서를 모달로 열고 마크다운 렌더링한다', async () => {
    const user = userEvent.setup()

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.endsWith('/legal/2026-02-24/ko/terms-of-service.md')) {
        return createTextResponse('# 푸터 약관 제목\n\n본문 **강조** 문장')
      }
      return createTextResponse('', 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '이용약관' }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '푸터 약관 제목' })).toBeInTheDocument()
    expect(screen.queryByText('# 푸터 약관 제목')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '닫기' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('현재 언어 문서가 없으면 영어 문서로 fallback 한다', async () => {
    const user = userEvent.setup()

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      if (url.endsWith('/legal/2026-02-24/ko/terms-of-service.md')) {
        return createTextResponse('', 404)
      }
      if (url.endsWith('/legal/2026-02-24/en/terms-of-service.md')) {
        return createTextResponse('# English Terms')
      }
      return createTextResponse('', 404)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AppFooter />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: '이용약관' }))
    expect(await screen.findByRole('heading', { name: 'English Terms' })).toBeInTheDocument()

    const calledUrls = fetchMock.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
    )
    expect(calledUrls[0]).toContain('/legal/2026-02-24/ko/terms-of-service.md')
    expect(calledUrls[1]).toContain('/legal/2026-02-24/en/terms-of-service.md')
  })
})
