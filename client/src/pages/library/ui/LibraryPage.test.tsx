import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LibraryPage } from '@pages/library/ui/LibraryPage'

describe('LibraryPage', () => {
  it('내 동화 목록을 렌더링한다', async () => {
    const execute = vi.fn(async () => ({
      ok: true as const,
      value: {
        items: [
          {
            storybookId: 'storybook-1',
            title: '달빛 숲',
            authorName: '도담',
            originImageUrl: 'https://cdn.example.com/storybook-1-origin',
            createdAt: '2026-02-22T04:00:00.000Z',
          },
        ],
      },
    }))

    render(
      <LibraryPage
        dependencies={{
          listStorybooksUseCase: {
            execute,
          },
          deleteStorybookUseCase: {
            execute: vi.fn(async () => ({ ok: true as const, value: undefined })),
          },
        }}
        userId="user-1"
      />,
    )

    expect(document.querySelectorAll('.library-card--skeleton').length).toBeGreaterThan(0)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '달빛 숲' })).toBeInTheDocument()
    })
    expect(screen.getByText('도담')).toBeInTheDocument()
    expect(execute).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 60,
    })
  })

  it('카드 전체 클릭으로 상세 이동 콜백을 호출한다', async () => {
    const user = userEvent.setup()
    const execute = vi.fn(async () => ({
      ok: true as const,
      value: {
        items: [
          {
            storybookId: 'storybook-99',
            title: '별빛 기차',
            authorName: null,
            originImageUrl: null,
            createdAt: null,
          },
        ],
      },
    }))
    const onOpenStorybookDetail = vi.fn()

    render(
      <LibraryPage
        dependencies={{
          listStorybooksUseCase: {
            execute,
          },
          deleteStorybookUseCase: {
            execute: vi.fn(async () => ({ ok: true as const, value: undefined })),
          },
        }}
        userId="user-1"
        onOpenStorybookDetail={onOpenStorybookDetail}
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '별빛 기차' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '별빛 기차' }))
    expect(onOpenStorybookDetail).toHaveBeenCalledWith('storybook-99')
  })

  it('에러 상태에서 다시 불러오기 버튼을 누르면 재시도한다', async () => {
    const user = userEvent.setup()
    const execute = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false as const,
        error: {
          code: 'UNEXPECTED' as const,
          message: '목록 조회 실패',
        },
      })
      .mockResolvedValueOnce({
        ok: true as const,
        value: {
          items: [],
        },
      })

    render(
      <LibraryPage
        dependencies={{
          listStorybooksUseCase: {
            execute,
          },
          deleteStorybookUseCase: {
            execute: vi.fn(async () => ({ ok: true as const, value: undefined })),
          },
        }}
        userId="user-1"
      />,
    )

    await waitFor(() => {
      expect(screen.getByText('목록 조회 실패')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '다시 불러오기' }))

    await waitFor(() => {
      expect(screen.getByText('아직 만든 동화가 없어요. 첫 동화를 만들어 보세요.')).toBeInTheDocument()
    })
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('카드 삭제 버튼 클릭 시 삭제 유스케이스를 호출하고 목록에서 제거한다', async () => {
    const user = userEvent.setup()
    const listExecute = vi.fn(async () => ({
      ok: true as const,
      value: {
        items: [
          {
            storybookId: 'storybook-delete-1',
            title: '삭제 대상',
            authorName: '도담',
            originImageUrl: null,
            createdAt: null,
          },
        ],
      },
    }))
    const deleteExecute = vi.fn(async () => ({
      ok: true as const,
      value: undefined,
    }))

    render(
      <LibraryPage
        dependencies={{
          listStorybooksUseCase: {
            execute: listExecute,
          },
          deleteStorybookUseCase: {
            execute: deleteExecute,
          },
        }}
        userId="user-1"
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '삭제 대상' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '삭제하기: 삭제 대상' }))
    const dialog = screen.getByRole('dialog', { name: '삭제 대상' })

    expect(within(dialog).getByText('한번 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: '삭제하기' }))

    expect(deleteExecute).toHaveBeenCalledWith({
      userId: 'user-1',
      storybookId: 'storybook-delete-1',
    })

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: '삭제 대상' })).not.toBeInTheDocument()
    })
  })

  it('삭제 확인에서 취소하면 삭제를 수행하지 않는다', async () => {
    const user = userEvent.setup()
    const listExecute = vi.fn(async () => ({
      ok: true as const,
      value: {
        items: [
          {
            storybookId: 'storybook-delete-cancel',
            title: '삭제 취소 대상',
            authorName: '도담',
            originImageUrl: null,
            createdAt: null,
          },
        ],
      },
    }))
    const deleteExecute = vi.fn(async () => ({
      ok: true as const,
      value: undefined,
    }))

    render(
      <LibraryPage
        dependencies={{
          listStorybooksUseCase: {
            execute: listExecute,
          },
          deleteStorybookUseCase: {
            execute: deleteExecute,
          },
        }}
        userId="user-1"
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '삭제 취소 대상' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '삭제하기: 삭제 취소 대상' }))
    const dialog = screen.getByRole('dialog', { name: '삭제 취소 대상' })
    await user.click(within(dialog).getByRole('button', { name: '취소' }))

    expect(deleteExecute).not.toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: '삭제 취소 대상' })).toBeInTheDocument()
  })
})
