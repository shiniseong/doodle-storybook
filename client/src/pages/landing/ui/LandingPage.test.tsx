import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LandingPage } from '@pages/landing/ui/LandingPage'

describe('LandingPage', () => {
  it('기본 렌더에서 핵심 섹션과 특장점 문구를 노출한다', () => {
    render(<LandingPage onStart={vi.fn()} />)

    expect(screen.getByText('뚝딱 그림책')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '핵심 특장점' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '투명한 가격, 숨은 비용 없음' })).toBeInTheDocument()

    expect(document.querySelectorAll('.landing-page__magic-border')).toHaveLength(3)
    expect(document.querySelectorAll('.landing-page__feature')).toHaveLength(3)
    expect(document.querySelectorAll('.landing-page__feature-card')).toHaveLength(3)

    expect(screen.getByText('아이의 꿈을 동화로')).toBeInTheDocument()
    expect(screen.getByText('아이 눈높이 AI 프롬프팅')).toBeInTheDocument()
    expect(screen.getByText('그림이 문장이 되는 연습')).toBeInTheDocument()
  })

  it('상단 CTA 클릭 시 onStart를 호출한다', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()

    render(<LandingPage onStart={onStart} />)

    await user.click(screen.getByRole('button', { name: '바로 사용해보기' }))

    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
