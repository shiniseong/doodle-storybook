import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useStorybookCreationStore } from '@features/storybook-creation/model/storybook-creation.store'
import {
  StorybookWorkspace,
  type StorybookWorkspaceDependencies,
} from '@widgets/storybook-workspace/ui/StorybookWorkspace'

function createMockCanvasContext(width: number, height: number): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    })),
    putImageData: vi.fn(),
    strokeStyle: '#184867',
    fillStyle: '#184867',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    lineWidth: 3,
    lineCap: 'round',
    lineJoin: 'round',
  } as unknown as CanvasRenderingContext2D
}

function createFixedDomRect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect
}

describe('StorybookWorkspace', () => {
  beforeEach(() => {
    useStorybookCreationStore.getState().reset()
  })

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

    expect(screen.getByText('2편 남음')).toBeInTheDocument()

    await user.type(screen.getByLabelText('동화 제목'), '달빛 캠핑')
    await user.type(screen.getByLabelText('그림 설명'), '달빛 아래에서 캠핑을 해요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(execute).toHaveBeenCalledWith({
      userId: 'user-1',
      title: '달빛 캠핑',
      description: '달빛 아래에서 캠핑을 해요',
      language: 'ko',
    })
    expect(screen.getByText('동화 생성 요청 완료 · #storybook-101')).toBeInTheDocument()
    expect(screen.getByText('1편 남음')).toBeInTheDocument()
  })

  it('생성 진행 중에는 하단 CTA 버튼을 비활성화한다', async () => {
    const user = userEvent.setup()
    let resolveRequest!: (value: { ok: true; value: { storybookId: string } }) => void
    const pending = new Promise<{ ok: true; value: { storybookId: string } }>((resolve) => {
      resolveRequest = resolve
    })

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(() => pending),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.type(screen.getByLabelText('동화 제목'), '숲속 친구')
    await user.type(screen.getByLabelText('그림 설명'), '숲속에서 친구를 만나요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    const pendingButton = screen.getByRole('button', { name: '동화 생성 처리 중...' })
    expect(pendingButton).toBeDisabled()
    expect(screen.getByTestId('story-loading-mini-game')).toBeInTheDocument()

    resolveRequest({ ok: true, value: { storybookId: 'storybook-200' } })

    await waitFor(() => {
      expect(screen.queryByTestId('story-loading-mini-game')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '1일 무료 사용 시작' })).toBeEnabled()
    })
  })

  it('생성 실패 시 다국어 오류 피드백을 보여준다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: false as const,
          error: {
            code: 'QUOTA_EXCEEDED' as const,
            message: '무료 생성 한도를 초과했습니다. 구독 후 이용해 주세요.',
          },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.type(screen.getByLabelText('동화 제목'), '마법 지팡이')
    await user.type(screen.getByLabelText('그림 설명'), '숲속에서 마법 지팡이를 찾았어요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(
      screen.getByText('무료 제작 횟수를 모두 사용했어요. 구독 후 계속 만들 수 있어요.'),
    ).toBeInTheDocument()
  })

  it('그리드 토글 버튼으로 캔버스 격자 표시를 전환한다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-320' },
        })),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const surface = container.querySelector('.canvas-stage__surface')

    expect(surface).not.toBeNull()
    expect(surface).not.toHaveClass('canvas-stage__surface--plain')

    const toggleButton = screen.getByRole('button', { name: '그리드 끄기' })
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true')
    expect(toggleButton).toHaveAttribute('title', '그리드 끄기')

    await user.click(toggleButton)

    expect(toggleButton).toHaveAttribute('aria-label', '그리드 켜기')
    expect(toggleButton).toHaveAttribute('title', '그리드 켜기')
    expect(toggleButton).toHaveAttribute('aria-pressed', 'false')
    expect(surface).toHaveClass('canvas-stage__surface--plain')

    await user.click(toggleButton)

    expect(toggleButton).toHaveAttribute('aria-label', '그리드 끄기')
    expect(toggleButton).toHaveAttribute('title', '그리드 끄기')
    expect(toggleButton).toHaveAttribute('aria-pressed', 'true')
    expect(surface).not.toHaveClass('canvas-stage__surface--plain')
  })

  it('캔버스 전체 지우기 버튼을 누르면 현재 캔버스를 비운다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-321' },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.click(screen.getByRole('button', { name: '캔버스 전체 지우기' }))

    expect(mockContext.clearRect).toHaveBeenCalledWith(0, 0, canvasWidth, canvasHeight)

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('펜 굵기 패널에서 슬라이더와 증감 버튼으로 굵기를 조절한다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-324' },
        })),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const openButton = screen.getByRole('button', { name: '펜 굵기' })

    await user.click(openButton)

    const slider = screen.getByRole('slider', { name: '펜 굵기' })
    const decreaseButton = screen.getByRole('button', { name: '펜 굵기 줄이기' })
    const increaseButton = screen.getByRole('button', { name: '펜 굵기 늘리기' })
    const valueOutput = container.querySelector('.pen-width-panel__value')

    expect(slider).toHaveValue('3')
    expect(valueOutput).toHaveTextContent('3')

    await user.click(increaseButton)
    expect(slider).toHaveValue('4')
    expect(valueOutput).toHaveTextContent('4')

    await user.click(decreaseButton)
    expect(slider).toHaveValue('3')
    expect(valueOutput).toHaveTextContent('3')

    fireEvent.change(slider, { target: { value: '11' } })
    expect(slider).toHaveValue('11')
    expect(valueOutput).toHaveTextContent('11')
  })

  it('펜 색상 팔레트에서 색상을 고르면 캔버스 펜 색상이 바뀐다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-325-c' },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    const colorToolButton = screen.getByRole('button', { name: '펜 색상' })
    expect(colorToolButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(colorToolButton)
    expect(colorToolButton).toHaveAttribute('aria-expanded', 'true')

    expect(screen.getByRole('button', { name: /#f97316/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#facc15/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#ffffff/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#f2c6a0/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#ec4899/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#84cc16/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#38bdf8/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /#9ca3af/i })).toBeInTheDocument()

    const nextColorButton = screen.getByRole('button', { name: /#dc2626/i })
    expect(nextColorButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(nextColorButton)

    await waitFor(() => {
      expect(mockContext.strokeStyle).toBe('#dc2626')
      expect(mockContext.fillStyle).toBe('#dc2626')
    })

    expect(nextColorButton).toHaveAttribute('aria-pressed', 'true')

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('투명도 패널에서 슬라이더와 증감 버튼으로 투명도를 조절한다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-325-o' },
        })),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const opacityToolButton = screen.getByRole('button', { name: '투명도' })

    expect(opacityToolButton).toHaveAttribute('aria-expanded', 'false')

    await user.click(opacityToolButton)
    expect(opacityToolButton).toHaveAttribute('aria-expanded', 'true')

    const slider = screen.getByRole('slider', { name: '투명도' })
    const decreaseButton = screen.getByRole('button', { name: '투명도 줄이기' })
    const increaseButton = screen.getByRole('button', { name: '투명도 늘리기' })
    const valueOutput = container.querySelector('.pen-opacity-panel .range-control-panel__value')

    expect(slider).toHaveValue('100')
    expect(valueOutput).toHaveTextContent('100%')
    expect(mockContext.globalAlpha).toBe(1)

    await user.click(decreaseButton)
    expect(slider).toHaveValue('99')
    expect(valueOutput).toHaveTextContent('99%')
    expect(mockContext.globalAlpha).toBeCloseTo(0.99)

    await user.click(increaseButton)
    expect(slider).toHaveValue('100')
    expect(valueOutput).toHaveTextContent('100%')
    expect(mockContext.globalAlpha).toBe(1)

    fireEvent.change(slider, { target: { value: '35' } })
    expect(slider).toHaveValue('35')
    expect(valueOutput).toHaveTextContent('35%')
    expect(mockContext.globalAlpha).toBeCloseTo(0.35)

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('지우개 패널에서 슬라이더와 증감 버튼으로 크기를 조절한다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-325-e-size' },
        })),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const eraserToolButton = screen.getByRole('button', { name: '지우개' })

    expect(eraserToolButton).toHaveAttribute('aria-expanded', 'false')
    expect(eraserToolButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(eraserToolButton)
    expect(eraserToolButton).toHaveAttribute('aria-expanded', 'true')
    expect(eraserToolButton).toHaveAttribute('aria-pressed', 'true')

    const slider = screen.getByRole('slider', { name: '지우개' })
    const decreaseButton = screen.getByRole('button', { name: '지우개 크기 줄이기' })
    const increaseButton = screen.getByRole('button', { name: '지우개 크기 늘리기' })
    const valueOutput = container.querySelector('.eraser-size-panel .range-control-panel__value')

    expect(slider).toHaveValue('20')
    expect(valueOutput).toHaveTextContent('20')

    await user.click(increaseButton)
    expect(slider).toHaveValue('21')
    expect(valueOutput).toHaveTextContent('21')

    await user.click(decreaseButton)
    expect(slider).toHaveValue('20')
    expect(valueOutput).toHaveTextContent('20')

    fireEvent.change(slider, { target: { value: '31' } })
    expect(slider).toHaveValue('31')
    expect(valueOutput).toHaveTextContent('31')

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('지우개 모드에서 그리면 destination-out 합성으로 지워진다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-325-e-mode' },
        })),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const eraserToolButton = screen.getByRole('button', { name: '지우개' })
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    await user.click(eraserToolButton)
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(mockContext.globalCompositeOperation).toBe('destination-out')
    expect(mockContext.globalAlpha).toBe(1)
    expect(mockContext.lineWidth).toBeGreaterThan(3)
    expect(mockContext.stroke).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '펜 굵기' }))
    expect(mockContext.globalCompositeOperation).toBe('source-over')

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('지우개 모드에서 커서 클래스와 지우개 크기 미리보기를 표시한다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-325-e-preview' },
        })),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const eraserToolButton = screen.getByRole('button', { name: '지우개' })
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    expect(canvas).not.toHaveClass('canvas-stage__surface--eraser')

    await user.click(eraserToolButton)
    expect(canvas).toHaveClass('canvas-stage__surface--eraser')

    const preview = container.querySelector('.canvas-stage__eraser-preview') as HTMLElement | null
    expect(preview).not.toBeNull()

    if (!preview) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    fireEvent.pointerEnter(canvas, { pointerId: 1, clientX: 40, clientY: 52 })

    expect(preview).toHaveClass('canvas-stage__eraser-preview--visible')
    expect(preview).toHaveStyle({ width: '20px', height: '20px' })

    fireEvent.pointerLeave(canvas, { pointerId: 1 })
    expect(preview).not.toHaveClass('canvas-stage__eraser-preview--visible')

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('드로잉 시작 전에도 실행취소 버튼은 활성화된다', () => {
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-325' },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    expect(screen.getByRole('button', { name: '실행취소' })).toBeEnabled()
  })

  it('캔버스에 그리면 실행취소가 활성화되고 실행취소 시 다시 비활성화된다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const putImageDataSpy = mockContext.putImageData as unknown as { mock: { calls: unknown[][] } }
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-326' },
        })),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const undoButton = screen.getByRole('button', { name: '실행취소' })
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    expect(undoButton).toBeEnabled()

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(mockContext.getImageData).toHaveBeenCalled()
    expect(mockContext.stroke).toHaveBeenCalled()
    expect(undoButton).toBeEnabled()

    const putImageDataCallsAfterDraw = putImageDataSpy.mock.calls.length
    await user.click(undoButton)

    expect(mockContext.putImageData).toHaveBeenCalled()
    expect(putImageDataSpy.mock.calls.length).toBe(putImageDataCallsAfterDraw + 1)

    const putImageDataCallsAfterUndo = putImageDataSpy.mock.calls.length
    await user.click(undoButton)
    expect(putImageDataSpy.mock.calls.length).toBe(putImageDataCallsAfterUndo)
    expect(undoButton).toBeEnabled()

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('캔버스에서 Shift를 누르고 그리면 시작점과 현재점을 직선으로 잇는다', () => {
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const lineToSpy = mockContext.lineTo as unknown as { mock: { calls: Array<[number, number]> } }
    const moveToSpy = mockContext.moveTo as unknown as { mock: { calls: Array<[number, number]> } }
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-326-shift' },
        })),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52, shiftKey: true })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 80, clientY: 64, shiftKey: true })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(moveToSpy.mock.calls.length).toBe(2)
    expect(lineToSpy.mock.calls.length).toBe(2)
    expect(moveToSpy.mock.calls[0]).toEqual([12, 14])
    expect(moveToSpy.mock.calls[1]).toEqual([12, 14])
    expect(lineToSpy.mock.calls[0]).toEqual([46, 52])
    expect(lineToSpy.mock.calls[1]).toEqual([80, 64])

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('캔버스가 활성화되어 있으면 ctrl+z로 실행취소한다', () => {
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const putImageDataSpy = mockContext.putImageData as unknown as { mock: { calls: unknown[][] } }
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-327' },
        })),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const undoButton = screen.getByRole('button', { name: '실행취소' })
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(undoButton).toBeEnabled()
    const putImageDataCallsAfterDraw = putImageDataSpy.mock.calls.length
    fireEvent.keyDown(canvas, { key: 'z', ctrlKey: true })
    expect(putImageDataSpy.mock.calls.length).toBe(putImageDataCallsAfterDraw + 1)
    expect(undoButton).toBeEnabled()

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('텍스트 입력이 활성화되어 있으면 ctrl+z가 캔버스 실행취소를 건드리지 않는다', async () => {
    const user = userEvent.setup()
    const canvasWidth = 880
    const canvasHeight = 440
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const putImageDataSpy = mockContext.putImageData as unknown as { mock: { calls: unknown[][] } }
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))

    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-328' },
        })),
      },
    }

    const { container } = render(<StorybookWorkspace dependencies={dependencies} />)
    const undoButton = screen.getByRole('button', { name: '실행취소' })
    const canvas = container.querySelector('.canvas-stage__surface') as HTMLCanvasElement | null
    const textarea = screen.getByLabelText('그림 설명')

    expect(canvas).not.toBeNull()

    if (!canvas) {
      getContextSpy.mockRestore()
      getBoundingClientRectSpy.mockRestore()
      return
    }

    Object.defineProperty(canvas, 'setPointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'releasePointerCapture', {
      value: vi.fn(),
      configurable: true,
    })
    Object.defineProperty(canvas, 'hasPointerCapture', {
      value: vi.fn(() => true),
      configurable: true,
    })

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 12, clientY: 14 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 46, clientY: 52 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(undoButton).toBeEnabled()
    const putImageDataCallsBeforeTextUndo = putImageDataSpy.mock.calls.length

    await user.click(textarea)
    fireEvent.keyDown(textarea, { key: 'z', ctrlKey: true })

    expect(putImageDataSpy.mock.calls.length).toBe(putImageDataCallsBeforeTextUndo)
    expect(undoButton).toBeEnabled()

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
  })

  it('생성 응답에 pages/images가 있으면 표지 이후 양면 스프레드로 열고 엣지 클릭으로 넘긴다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: {
            storybookId: 'storybook-ebook-1',
            openaiResponseId: 'resp-ebook-1',
            promptVersion: '5',
            pages: [
              { page: 1, content: '첫 장면', isHighlight: false },
              { page: 2, content: '강조 장면', isHighlight: true },
              { page: 3, content: '마지막 장면', isHighlight: false },
            ],
            images: [
              'data:image/png;base64,coverimg',
              'data:image/png;base64,highlightimg',
              'data:image/png;base64,lastimg',
            ],
          },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.type(screen.getByLabelText('동화 제목'), '숲속 모험')
    await user.type(screen.getByLabelText('그림 설명'), '토끼가 숲길을 달려요')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))

    expect(await screen.findByRole('dialog', { name: '생성된 동화책: 숲속 모험' })).toBeInTheDocument()

    const coverImage = screen.getByAltText('숲속 모험 표지') as HTMLImageElement
    expect(coverImage.src).toContain('data:image/png;base64,coverimg')

    await user.click(screen.getByRole('button', { name: '표지 넘기기' }))

    await waitFor(
      () => {
        expect(screen.getByText('- 1 -')).toBeInTheDocument()
        expect(screen.getByText('- 2 -')).toBeInTheDocument()
      },
      { timeout: 1200 },
    )

    expect(screen.queryByText(/Prompt v/i)).not.toBeInTheDocument()

    expect(screen.queryByAltText('1페이지 삽화')).not.toBeInTheDocument()

    const highlightImage = screen.getByAltText('2페이지 삽화') as HTMLImageElement
    expect(highlightImage.src).toContain('data:image/png;base64,highlightimg')

    await user.click(screen.getByRole('button', { name: '다음 장으로 넘기기' }))
    await waitFor(() => {
      expect(screen.getByText('- 3 -')).toBeInTheDocument()
    })

    const lastImage = screen.getByAltText('3페이지 삽화') as HTMLImageElement
    expect(lastImage.src).toContain('data:image/png;base64,lastimg')

    await user.click(screen.getByRole('button', { name: '이전 장으로 넘기기' }))
    await waitFor(() => {
      expect(screen.getByText('- 1 -')).toBeInTheDocument()
      expect(screen.getByText('- 2 -')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '표지로 돌아가기' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '표지 넘기기' })).toBeInTheDocument()
    })
  })

  it('라이브 북 미리보기 섹션을 렌더링하지 않는다', () => {
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-330' },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    expect(screen.queryByRole('heading', { name: '라이브 북 미리보기' })).not.toBeInTheDocument()
  })

  it('지구본 언어 설정으로 전체 UI 문구가 바뀐다', async () => {
    const user = userEvent.setup()
    const dependencies: StorybookWorkspaceDependencies = {
      currentUserId: 'user-1',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { storybookId: 'storybook-300' },
        })),
      },
    }

    render(<StorybookWorkspace dependencies={dependencies} />)

    await user.selectOptions(screen.getByLabelText('언어'), 'en')

    await waitFor(() => {
      expect(screen.getByText('Free stories')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create Storybook' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Start 1-day free trial' })).toBeInTheDocument()
    })
  })
})
