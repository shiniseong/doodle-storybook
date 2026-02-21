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
    expect(screen.getByLabelText('지은이')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: '원본 그림체 보존' })).toHaveAttribute('aria-checked', 'false')
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
      authorName: '',
      description: '작은 고양이가 등불을 들고 있어요',
      isPreserveOriginalDrawingStyle: false,
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
      authorName: '',
      description: '달빛 정원에서 고양이가 춤춰요',
      isPreserveOriginalDrawingStyle: false,
    })
  })

  it('지은이 입력값도 trim 되어 제출된다', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => undefined)

    render(<StorybookDescriptionForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('동화 제목'), '은하수 산책')
    await user.type(screen.getByLabelText('지은이'), '  달빛 작가  ')
    await user.type(screen.getByLabelText('그림 설명'), '고양이가 별길을 걸어요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: '은하수 산책',
      authorName: '달빛 작가',
      description: '고양이가 별길을 걸어요',
      isPreserveOriginalDrawingStyle: false,
    })
  })

  it('원본 그림체 보존 스위치를 켜면 true로 제출한다', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => undefined)

    render(<StorybookDescriptionForm onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('동화 제목'), '선 느낌 유지')
    await user.type(screen.getByLabelText('그림 설명'), '손그림 느낌을 유지하며 정리해 주세요')
    await user.click(screen.getByRole('switch', { name: '원본 그림체 보존' }))
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(onSubmit).toHaveBeenCalledWith({
      title: '선 느낌 유지',
      authorName: '',
      description: '손그림 느낌을 유지하며 정리해 주세요',
      isPreserveOriginalDrawingStyle: true,
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

  it('초기값을 복원하고 입력 변경을 draft 콜백으로 전달한다', async () => {
    const user = userEvent.setup()
    const onDraftChange = vi.fn()

    render(
      <StorybookDescriptionForm
        initialTitle="복원된 제목"
        initialAuthorName="복원된 지은이"
        initialDescription="복원된 설명"
        onDraftChange={onDraftChange}
        onSubmit={() => Promise.resolve()}
      />,
    )

    const titleInput = screen.getByLabelText('동화 제목')
    const authorInput = screen.getByLabelText('지은이')
    const descriptionInput = screen.getByLabelText('그림 설명')

    expect(titleInput).toHaveValue('복원된 제목')
    expect(authorInput).toHaveValue('복원된 지은이')
    expect(descriptionInput).toHaveValue('복원된 설명')

    await user.type(authorInput, '!')

    expect(onDraftChange).toHaveBeenCalled()
    expect(onDraftChange).toHaveBeenLastCalledWith({
      title: '복원된 제목',
      authorName: '복원된 지은이!',
      description: '복원된 설명',
      isPreserveOriginalDrawingStyle: false,
    })
  })
})
