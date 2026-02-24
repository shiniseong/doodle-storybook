import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { LandingPage } from '@pages/landing/ui/LandingPage'

describe('LandingPage', () => {
  it('기본 렌더에서 특장점 3카드와 문구를 노출한다', () => {
    render(<LandingPage onStart={vi.fn()} />)

    const cards = document.querySelectorAll('.landing-page__stack-card')
    expect(cards).toHaveLength(3)

    expect(screen.getByRole('heading', { level: 2, name: '아이의 꿈을 동화로' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '아이 눈높이 AI 프롬프팅' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: '그림이 문장이 되는 연습' })).toBeInTheDocument()

    expect(screen.getAllByText('아이의 상상과 꿈을 오늘 읽는 한 권의 이야기로 완성해요.').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('AI 전환 시대에, 아이에게 가장 친숙한 방식으로 프롬프팅을 시작해요.').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('그림을 언어로 풀어 쓰며 어휘력과 문장력을 함께 키워요.').length).toBeGreaterThanOrEqual(1)
  })

  it('CTA 버튼 클릭 시 onStart를 호출한다', async () => {
    const user = userEvent.setup()
    const onStart = vi.fn()

    render(<LandingPage onStart={onStart} />)

    const ctaButtons = screen.getAllByRole('button', { name: /바로 사용해보기/i })
    await user.click(ctaButtons[0])

    expect(onStart).toHaveBeenCalledTimes(1)
  })
})
