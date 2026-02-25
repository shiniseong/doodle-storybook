import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AgreementsPage } from '@pages/agreements/ui/AgreementsPage'
import type { RequiredAgreementKey } from '@pages/agreements/model/agreement-documents'
import type { AccountAgreementsUseCasePort } from '@features/account-agreements/application/account-agreements.use-case'

function createUseCaseStub(overrides?: Partial<AccountAgreementsUseCasePort>): AccountAgreementsUseCasePort {
  return {
    getStatus: vi.fn(async () => ({
      requiredVersion: '2026-02-24',
      hasAcceptedRequiredAgreements: false,
      agreements: {
        termsOfService: false,
        adultPayer: false,
        noDirectChildDataCollection: false,
      },
      acceptedAt: null,
    })),
    acceptAllRequiredAgreements: vi.fn(async () => ({
      requiredVersion: '2026-02-24',
      hasAcceptedRequiredAgreements: true,
      agreements: {
        termsOfService: true,
        adultPayer: true,
        noDirectChildDataCollection: true,
      },
      acceptedAt: '2026-02-24T10:00:00.000Z',
    })),
    ...overrides,
  }
}

function createDocumentLoaderStub() {
  return vi.fn(async (key: RequiredAgreementKey) => `# ${key}\n\nagreement body`)
}

async function reviewNextAgreementDocument(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: '약관 보기' })[0])
  await screen.findByRole('dialog')
  await user.click(screen.getByRole('button', { name: '열람 완료 후 동의 체크하기' }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
}

describe('AgreementsPage', () => {
  it('약관 문서를 열람하기 전에는 체크할 수 없다', async () => {
    const user = userEvent.setup()
    const useCase = createUseCaseStub()
    const documentLoader = createDocumentLoaderStub()

    render(<AgreementsPage useCase={useCase} documentLoader={documentLoader} />)

    const submitButton = await screen.findByRole('button', { name: '동의하고 계속하기' })
    expect(submitButton).toBeDisabled()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(3)
    expect(checkboxes[0]).toBeDisabled()
    expect(checkboxes[1]).toBeDisabled()
    expect(checkboxes[2]).toBeDisabled()

    await reviewNextAgreementDocument(user)

    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).toBeDisabled()
    expect(submitButton).toBeDisabled()
    expect(documentLoader).toHaveBeenCalledTimes(1)
  })

  it('3개 약관을 모두 열람하고 체크해야 제출이 활성화된다', async () => {
    const user = userEvent.setup()
    const useCase = createUseCaseStub()
    const documentLoader = createDocumentLoaderStub()

    render(<AgreementsPage useCase={useCase} documentLoader={documentLoader} />)

    const submitButton = await screen.findByRole('button', { name: '동의하고 계속하기' })
    await reviewNextAgreementDocument(user)
    await reviewNextAgreementDocument(user)
    await reviewNextAgreementDocument(user)

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).toBeChecked()
    expect(checkboxes[2]).toBeChecked()
    expect(submitButton).not.toBeDisabled()
    expect(documentLoader).toHaveBeenCalledTimes(3)
  })

  it('약관 문서는 마크다운으로 렌더링된다', async () => {
    const user = userEvent.setup()
    const useCase = createUseCaseStub()
    const documentLoader = createDocumentLoaderStub()

    render(<AgreementsPage useCase={useCase} documentLoader={documentLoader} />)

    await user.click((await screen.findAllByRole('button', { name: '약관 보기' }))[0])
    expect(await screen.findByRole('heading', { name: 'termsOfService' })).toBeInTheDocument()
    expect(screen.queryByText('# termsOfService')).not.toBeInTheDocument()
  })

  it('이미 동의된 상태면 즉시 완료 콜백을 호출한다', async () => {
    const onCompleted = vi.fn()
    const useCase = createUseCaseStub({
      getStatus: vi.fn(async () => ({
        requiredVersion: '2026-02-24',
        hasAcceptedRequiredAgreements: true,
        agreements: {
          termsOfService: true,
          adultPayer: true,
          noDirectChildDataCollection: true,
        },
        acceptedAt: '2026-02-24T10:00:00.000Z',
      })),
    })
    const documentLoader = createDocumentLoaderStub()

    render(<AgreementsPage useCase={useCase} onCompleted={onCompleted} documentLoader={documentLoader} />)

    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledTimes(1)
    })
  })

  it('서버에 과거 동의값이 있어도 현재 버전 미동의 상태면 체크를 다시 요구한다', async () => {
    const useCase = createUseCaseStub({
      getStatus: vi.fn(async () => ({
        requiredVersion: '2026-03-01',
        hasAcceptedRequiredAgreements: false,
        agreements: {
          termsOfService: true,
          adultPayer: true,
          noDirectChildDataCollection: true,
        },
        acceptedAt: '2026-02-24T10:00:00.000Z',
      })),
    })
    const documentLoader = createDocumentLoaderStub()

    render(<AgreementsPage useCase={useCase} documentLoader={documentLoader} />)

    const checkboxes = await screen.findAllByRole('checkbox')
    expect(checkboxes[0]).not.toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
    expect(checkboxes[2]).not.toBeChecked()
    expect(checkboxes[0]).toBeDisabled()
    expect(checkboxes[1]).toBeDisabled()
    expect(checkboxes[2]).toBeDisabled()
  })

  it('필수 3개 체크 후 제출하면 완료 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const onCompleted = vi.fn()
    const useCase = createUseCaseStub()
    const documentLoader = createDocumentLoaderStub()

    render(<AgreementsPage useCase={useCase} onCompleted={onCompleted} documentLoader={documentLoader} />)

    await reviewNextAgreementDocument(user)
    await reviewNextAgreementDocument(user)
    await reviewNextAgreementDocument(user)

    expect(screen.getByRole('button', { name: '동의하고 계속하기' })).not.toBeDisabled()

    await user.click(screen.getByRole('button', { name: '동의하고 계속하기' }))

    await waitFor(() => {
      expect(useCase.acceptAllRequiredAgreements).toHaveBeenCalledTimes(1)
      expect(onCompleted).toHaveBeenCalledTimes(1)
    })
  })
})
