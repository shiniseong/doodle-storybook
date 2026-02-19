import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { StorybookDescriptionForm } from '@features/storybook-creation/ui/StorybookDescriptionForm'

describe('StorybookDescriptionForm', () => {
  it('초기에는 비어 있고 제출 버튼이 비활성화된다', () => {
    render(
      <StorybookDescriptionForm
        onSubmit={() => {
          return Promise.resolve()
        }}
      />,
    )

    expect(screen.getByText('0 / 500')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '동화 생성하기' })).toBeDisabled()
  })

  it('입력 시 카운터를 갱신하고 제출 가능 상태로 바뀐다', async () => {
    const user = userEvent.setup()

    render(
      <StorybookDescriptionForm
        onSubmit={() => {
          return Promise.resolve()
        }}
      />,
    )

    const textarea = screen.getByLabelText('그림 설명')
    await user.type(textarea, '달님이 구름 위를 산책해요')

    expect(screen.getByText('14 / 500')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '동화 생성하기' })).toBeEnabled()
  })

  it('제출 시 trim 된 설명과 선택 언어를 전달한다', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => undefined)

    render(<StorybookDescriptionForm onSubmit={onSubmit} />)

    const textarea = screen.getByLabelText('그림 설명')

    await user.type(textarea, '  작은 고양이가 등불을 들고 있어요 ')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(onSubmit).toHaveBeenCalledWith({
      description: '작은 고양이가 등불을 들고 있어요',
    })
  })

  it('생성 중 상태에서는 버튼 라벨과 비활성화 상태가 반영된다', () => {
    render(
      <StorybookDescriptionForm
        isSubmitting
        onSubmit={() => {
          return Promise.resolve()
        }}
      />,
    )

    expect(screen.getByRole('button', { name: '생성 중...' })).toBeDisabled()
  })
})
