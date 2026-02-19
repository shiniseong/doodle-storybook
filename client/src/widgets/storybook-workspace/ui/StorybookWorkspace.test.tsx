import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  StorybookWorkspace,
  type StorybookWorkspaceDependencies,
} from '@widgets/storybook-workspace/ui/StorybookWorkspace'

describe('StorybookWorkspace', () => {
  it('동화 생성 성공 시 피드백 메시지를 출력한다', async () => {
    const user = userEvent.setup()
    const execute = vi.fn(async () => ({
      ok: true as const,
      value: { storybookId: 'storybook-101' },
    }))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute,
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.type(screen.getByLabelText('그림 설명'), '달빛 아래에서 캠핑을 해요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(execute).toHaveBeenCalledWith({
      userId: 'user-1',
      description: '달빛 아래에서 캠핑을 해요',
      language: 'ko',
    })
    expect(screen.getByText('동화 생성 요청 완료: storybook-101')).toBeInTheDocument()
  })
})
