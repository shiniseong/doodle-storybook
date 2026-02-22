import { render, screen, waitFor } from '@testing-library/react'
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
        }}
        userId="user-1"
      />,
    )

    expect(screen.getByText('내 동화를 불러오는 중이에요...')).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '달빛 숲' })).toBeInTheDocument()
    })
    expect(screen.getByText('도담')).toBeInTheDocument()
    expect(execute).toHaveBeenCalledWith({
      userId: 'user-1',
      limit: 60,
    })
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
})
