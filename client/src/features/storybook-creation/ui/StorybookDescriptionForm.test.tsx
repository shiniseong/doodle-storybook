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

    expect(screen.getByLabelText('동화 제목')).toBeInTheDocument()
    expect(screen.getByText('0 / 500')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '동화 생성하기' })).toBeDisabled()
  })

  it('제목과 설명을 모두 입력해야 제출 가능 상태로 바뀐다', async () => {
    const user = userEvent.setup()

    render(
      <StorybookDescriptionForm
        onSubmit={() => {
          return Promise.resolve()
        }}
      />,
    )

    const textarea = screen.getByLabelText('그림 설명')
    const titleInput = screen.getByLabelText('동화 제목')
    await user.type(textarea, '달님이 구름 위를 산책해요')

    expect(screen.getByText('14 / 500')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '동화 생성하기' })).toBeDisabled()

    await user.type(titleInput, '달님 산책')
    expect(screen.getByRole('button', { name: '동화 생성하기' })).toBeEnabled()
  })

  it('제출 시 trim 된 제목과 설명을 전달한다', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => undefined)

    render(<StorybookDescriptionForm onSubmit={onSubmit} />)

    const titleInput = screen.getByLabelText('동화 제목')
    const textarea = screen.getByLabelText('그림 설명')

    await user.type(titleInput, '  달빛 등불  ')
    await user.type(textarea, '  작은 고양이가 등불을 들고 있어요 ')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: '달빛 등불',
      description: '작은 고양이가 등불을 들고 있어요',
    })
  })

  it('제목은 최대 30자로 제한되고 함께 제출된다', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => undefined)
    const overLimitTitle = '12345678901234567890123456789012'

    render(<StorybookDescriptionForm onSubmit={onSubmit} />)

    const titleInput = screen.getByLabelText('동화 제목')
    const textarea = screen.getByLabelText('그림 설명')

    await user.type(titleInput, overLimitTitle)
    await user.type(textarea, '달빛 정원에서 고양이가 춤춰요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(titleInput).toHaveValue('123456789012345678901234567890')
    expect(onSubmit).toHaveBeenCalledWith({
      title: '123456789012345678901234567890',
      description: '달빛 정원에서 고양이가 춤춰요',
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
