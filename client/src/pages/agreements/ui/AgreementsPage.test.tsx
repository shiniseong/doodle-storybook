import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AgreementsPage } from '@pages/agreements/ui/AgreementsPage'
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

describe('AgreementsPage', () => {
  it('3개 체크를 모두 하지 않으면 제출이 비활성화된다', async () => {
    const user = userEvent.setup()
    const useCase = createUseCaseStub()

    render(<AgreementsPage useCase={useCase} />)

    const submitButton = await screen.findByRole('button', { name: '동의하고 계속하기' })
    expect(submitButton).toBeDisabled()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(3)

    await user.click(checkboxes[0])
    await user.click(checkboxes[1])
    expect(submitButton).toBeDisabled()

    await user.click(checkboxes[2])
    expect(submitButton).not.toBeDisabled()
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

    render(<AgreementsPage useCase={useCase} onCompleted={onCompleted} />)

    await waitFor(() => {
      expect(onCompleted).toHaveBeenCalledTimes(1)
    })
  })

  it('필수 3개 체크 후 제출하면 완료 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const onCompleted = vi.fn()
    const useCase = createUseCaseStub()

    render(<AgreementsPage useCase={useCase} onCompleted={onCompleted} />)

    const checkboxes = await screen.findAllByRole('checkbox')
    await user.click(checkboxes[0])
    await user.click(checkboxes[1])
    await user.click(checkboxes[2])

    await user.click(screen.getByRole('button', { name: '동의하고 계속하기' }))

    await waitFor(() => {
      expect(useCase.acceptAllRequiredAgreements).toHaveBeenCalledTimes(1)
      expect(onCompleted).toHaveBeenCalledTimes(1)
    })
  })
})
