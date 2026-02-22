import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { StorybookDetailPage } from '@pages/storybook-detail/ui/StorybookDetailPage'

describe('StorybookDetailPage', () => {
  it('읽기 전용 이미지/텍스트 블록을 렌더링한다', async () => {
    const execute = vi.fn(async () => ({
      ok: true as const,
      value: {
        storybookId: 'storybook-1',
        storybook: {
          storybookId: 'storybook-1',
          title: '달빛 숲 모험',
          authorName: '도담',
          description: '토끼가 숲속에서 반짝이는 별을 만나요.',
          originImageUrl: 'https://cdn.example.com/origin.png',
          createdAt: '2026-02-22T04:00:00.000Z',
        },
        details: {
          origin: [
            {
              pageIndex: 0,
              drawingImageUrl: 'https://cdn.example.com/origin.png',
              description: '원본 설명',
            },
          ],
          output: [
            {
              pageIndex: 0,
              pageType: 'cover' as const,
              title: 'cover',
              content: 'cover-content',
              imageUrl: 'https://cdn.example.com/cover.png',
              audioUrl: null,
              isHighlight: false,
            },
          ],
        },
        ebook: {
          title: '달빛 숲 모험',
          authorName: '도담',
          coverImageUrl: 'https://cdn.example.com/cover.png',
          highlightImageUrl: null,
          finalImageUrl: null,
          pages: [
            {
              page: 1,
              content: '한밤중 숲속에서 토끼가 길을 떠나요.',
              isHighlight: false,
            },
          ],
          narrations: [],
        },
      },
    }))

    render(
      <StorybookDetailPage
        dependencies={{
          getStorybookDetailUseCase: {
            execute,
          },
        }}
        userId="user-1"
        storybookId="storybook-1"
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '달빛 숲 모험' })).toBeInTheDocument()
    })

    expect(screen.getByRole('heading', { name: '아이가 그린 그림' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '스토리 디렉터' })).toBeInTheDocument()
    expect(screen.getByText('토끼가 숲속에서 반짝이는 별을 만나요.')).toBeInTheDocument()

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(document.querySelector('canvas')).toBeNull()
  })

  it('동화 열람하기 버튼 클릭 시 eBook 다이얼로그를 연다', async () => {
    const user = userEvent.setup()
    const execute = vi.fn(async () => ({
      ok: true as const,
      value: {
        storybookId: 'storybook-2',
        storybook: {
          storybookId: 'storybook-2',
          title: '숲속 여행',
          authorName: null,
          description: '아이 그림 설명',
          originImageUrl: null,
          createdAt: '2026-02-22T04:00:00.000Z',
        },
        details: {
          origin: [
            {
              pageIndex: 0,
              drawingImageUrl: null,
              description: '아이 그림 설명',
            },
          ],
          output: [
            {
              pageIndex: 0,
              pageType: 'cover' as const,
              title: 'cover',
              content: 'cover-content',
              imageUrl: null,
              audioUrl: null,
              isHighlight: false,
            },
          ],
        },
        ebook: {
          title: '숲속 여행',
          authorName: null,
          coverImageUrl: null,
          highlightImageUrl: null,
          finalImageUrl: null,
          pages: [
            {
              page: 1,
              content: '첫 장면',
              isHighlight: false,
            },
          ],
          narrations: [],
        },
      },
    }))

    render(
      <StorybookDetailPage
        dependencies={{
          getStorybookDetailUseCase: {
            execute,
          },
        }}
        userId="user-1"
        storybookId="storybook-2"
      />,
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: '숲속 여행' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '동화 열람하기' }))

    expect(await screen.findByRole('dialog', { name: '생성된 동화책: 숲속 여행' })).toBeInTheDocument()
  })
})
