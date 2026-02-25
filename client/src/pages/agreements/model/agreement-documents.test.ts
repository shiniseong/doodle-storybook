import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadAgreementDocument } from '@pages/agreements/model/agreement-documents'

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.toString()
  }

  return input.url
}

describe('loadAgreementDocument', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ja 언어는 일본어 문서를 우선 로딩한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = resolveRequestUrl(input)

      if (url.endsWith('/legal/2026-02-24/ja/terms-of-service.md')) {
        return new Response('ja document', { status: 200 })
      }

      return new Response('', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const document = await loadAgreementDocument('termsOfService', 'ja-JP', '2026-02-24')

    expect(document).toBe('ja document')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(resolveRequestUrl(fetchMock.mock.calls[0][0])).toContain('/ja/terms-of-service.md')
  })

  it('zh 문서가 없으면 en 문서로 fallback 한다', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = resolveRequestUrl(input)

      if (url.endsWith('/legal/2026-02-24/zh/adult-payer-notice.md')) {
        return new Response('', { status: 404 })
      }

      if (url.endsWith('/legal/2026-02-24/en/adult-payer-notice.md')) {
        return new Response('en fallback', { status: 200 })
      }

      return new Response('', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const document = await loadAgreementDocument('adultPayer', 'zh-CN', '2026-02-24')

    expect(document).toBe('en fallback')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(resolveRequestUrl(fetchMock.mock.calls[0][0])).toContain('/zh/adult-payer-notice.md')
    expect(resolveRequestUrl(fetchMock.mock.calls[1][0])).toContain('/en/adult-payer-notice.md')
  })

  it('유효하지 않은 버전 값이면 즉시 실패한다', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(loadAgreementDocument('noDirectChildDataCollection', 'ko-KR', '2026/02/24')).rejects.toThrow(
      'Invalid required agreements version.',
    )

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
