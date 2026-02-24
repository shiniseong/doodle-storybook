import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@app/App'
import { createAppDependencies } from '@app/providers/dependencies'
import {
  STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY,
  clearStorybookWorkspaceDraft,
} from '@features/storybook-creation/model/storybook-compose-draft.storage'
import { useSupabaseGoogleAuth, type SupabaseGoogleAuthResult } from '@shared/lib/supabase/use-supabase-google-auth'

vi.mock('@shared/lib/supabase/use-supabase-google-auth', () => ({
  useSupabaseGoogleAuth: vi.fn(),
}))

vi.mock('@app/providers/dependencies', () => ({
  createAppDependencies: vi.fn(),
}))

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

function createMockAuth(overrides: Partial<SupabaseGoogleAuthResult> = {}): SupabaseGoogleAuthResult {
  return {
    isConfigured: true,
    isLoading: false,
    isSigningIn: false,
    userId: 'user-1',
    userEmail: 'user-1@example.com',
    accessToken: 'test-access-token',
    signInWithEmail: vi.fn(async () => ({ ok: true })),
    signUpWithEmail: vi.fn(async () => ({ ok: true, requiresEmailVerification: true })),
    signInWithProvider: vi.fn(async () => {}),
    signInWithGoogle: vi.fn(async () => {}),
    signInWithKakao: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    ...overrides,
  }
}

function parseStoredWorkspaceDraft() {
  const raw = window.sessionStorage.getItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY)
  if (!raw) {
    return null
  }

  return JSON.parse(raw) as {
    title: string
    authorName: string
    description: string
    canvasDataUrl: string | null
  }
}

async function fillDraftAndDraw(user: ReturnType<typeof userEvent.setup>, title: string, authorName: string, description: string) {
  await user.type(screen.getByLabelText('동화 제목'), title)
  await user.type(screen.getByLabelText('지은이'), authorName)
  await user.type(screen.getByLabelText('그림 설명'), description)

  const canvas = document.querySelector<HTMLCanvasElement>('.canvas-stage__surface')
  expect(canvas).not.toBeNull()

  if (!canvas) {
    return
  }

  fireEvent.pointerDown(canvas, {
    button: 0,
    pointerId: 1,
    clientX: 80,
    clientY: 80,
  })
  fireEvent.pointerMove(canvas, {
    pointerId: 1,
    clientX: 180,
    clientY: 140,
  })
  fireEvent.pointerUp(canvas, {
    pointerId: 1,
    clientX: 180,
    clientY: 140,
  })
}

async function enterWorkspaceFromLanding(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '바로 사용해보기' }))
}

function renderAppAt(pathname = '/') {
  window.history.replaceState({}, '', pathname)
  return render(
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App />
    </BrowserRouter>,
  )
}

describe('App auth flow persistence', () => {
  beforeEach(() => {
    if (typeof HTMLCanvasElement.prototype.setPointerCapture !== 'function') {
      Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
        value: () => {},
        configurable: true,
      })
    }
    if (typeof HTMLCanvasElement.prototype.releasePointerCapture !== 'function') {
      Object.defineProperty(HTMLCanvasElement.prototype, 'releasePointerCapture', {
        value: () => {},
        configurable: true,
      })
    }
    if (typeof HTMLCanvasElement.prototype.hasPointerCapture !== 'function') {
      Object.defineProperty(HTMLCanvasElement.prototype, 'hasPointerCapture', {
        value: () => false,
        configurable: true,
      })
    }

    clearStorybookWorkspaceDraft()
    vi.mocked(createAppDependencies).mockImplementation((options?: { currentUserId?: string }) => ({
      currentUserId: options?.currentUserId ?? 'demo-user',
      createStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: {
            storybookId: 'storybook-auth-flow',
            storybook: {
              storybookId: 'storybook-auth-flow',
              title: 'storybook-auth-flow',
              authorName: null,
              description: '',
              originImageUrl: null,
              createdAt: null,
            },
            details: {
              origin: [],
              output: [],
            },
            ebook: {
              title: 'storybook-auth-flow',
              authorName: null,
              coverImageUrl: null,
              highlightImageUrl: null,
              finalImageUrl: null,
              pages: [],
              narrations: [],
            },
          },
        })),
      },
      listStorybooksUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: { items: [] },
        })),
      },
      getStorybookDetailUseCase: {
        execute: vi.fn(async () => ({
          ok: false as const,
          error: {
            code: 'UNEXPECTED' as const,
            message: 'not used in this test',
          },
        })),
      },
      deleteStorybookUseCase: {
        execute: vi.fn(async () => ({
          ok: true as const,
          value: undefined,
        })),
      },
    }))
  })

  it('생성 다이얼로그 경유 로그인 후에도 작업중 draft(제목/내용/그림)를 유지한다', async () => {
    const user = userEvent.setup()
    let authState = createMockAuth({
      userId: null,
      userEmail: null,
    })
    vi.mocked(useSupabaseGoogleAuth).mockImplementation(() => authState)

    const canvasWidth = 920
    const canvasHeight = 460
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))
    const toDataURLSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,draft-auth-gate')

    const { rerender } = renderAppAt('/')
    await enterWorkspaceFromLanding(user)

    await fillDraftAndDraw(user, '다이얼로그 진입 제목', '다이얼로그 작가', '다이얼로그 진입 설명')
    await user.click(screen.getByRole('button', { name: '동화 생성하기' }))
    await user.click(screen.getByRole('button', { name: '로그인/가입 페이지로 이동' }))

    expect(await screen.findByRole('heading', { name: '로그인하고 그림책 만들기' })).toBeInTheDocument()

    await waitFor(() => {
      const stored = parseStoredWorkspaceDraft()
      expect(stored).not.toBeNull()
      expect(stored?.title).toBe('다이얼로그 진입 제목')
      expect(stored?.authorName).toBe('다이얼로그 작가')
      expect(stored?.description).toBe('다이얼로그 진입 설명')
      expect(stored?.canvasDataUrl).toBe('data:image/png;base64,draft-auth-gate')
    })

    authState = createMockAuth({
      userId: 'user-logged-in',
      userEmail: 'user-logged-in@example.com',
    })
    rerender(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>,
    )

    expect(await screen.findByLabelText('동화 제목')).toHaveValue('다이얼로그 진입 제목')
    expect(screen.getByLabelText('지은이')).toHaveValue('다이얼로그 작가')
    expect(screen.getByLabelText('그림 설명')).toHaveValue('다이얼로그 진입 설명')

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
    toDataURLSpy.mockRestore()
  }, 10000)

  it('우측 상단 로그인 버튼 경유 로그인 후에도 작업중 draft(제목/내용/그림)를 유지한다', async () => {
    const user = userEvent.setup()
    let authState = createMockAuth({
      userId: null,
      userEmail: null,
    })
    vi.mocked(useSupabaseGoogleAuth).mockImplementation(() => authState)

    const canvasWidth = 920
    const canvasHeight = 460
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))
    const toDataURLSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,draft-header-login')

    const { rerender } = renderAppAt('/')
    await enterWorkspaceFromLanding(user)

    await fillDraftAndDraw(user, '헤더 진입 제목', '헤더 진입 작가', '헤더 진입 설명')
    await user.click(screen.getByRole('button', { name: '로그인' }))

    expect(await screen.findByRole('heading', { name: '로그인하고 그림책 만들기' })).toBeInTheDocument()

    await waitFor(() => {
      const stored = parseStoredWorkspaceDraft()
      expect(stored).not.toBeNull()
      expect(stored?.title).toBe('헤더 진입 제목')
      expect(stored?.authorName).toBe('헤더 진입 작가')
      expect(stored?.description).toBe('헤더 진입 설명')
      expect(stored?.canvasDataUrl).toBe('data:image/png;base64,draft-header-login')
    })

    authState = createMockAuth({
      userId: 'user-logged-in-2',
      userEmail: 'user-logged-in-2@example.com',
    })
    rerender(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>,
    )

    expect(await screen.findByLabelText('동화 제목')).toHaveValue('헤더 진입 제목')
    expect(screen.getByLabelText('지은이')).toHaveValue('헤더 진입 작가')
    expect(screen.getByLabelText('그림 설명')).toHaveValue('헤더 진입 설명')

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
    toDataURLSpy.mockRestore()
  })

  it('로그아웃 이후에는 작업중 draft(제목/내용/그림)를 초기화한다', async () => {
    const user = userEvent.setup()
    const signOut = vi.fn(async () => {})
    let authState = createMockAuth({
      userId: 'user-before-logout',
      userEmail: 'before-logout@example.com',
      signOut,
    })
    vi.mocked(useSupabaseGoogleAuth).mockImplementation(() => authState)

    const canvasWidth = 920
    const canvasHeight = 460
    const mockContext = createMockCanvasContext(canvasWidth, canvasHeight)
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(mockContext as unknown as CanvasRenderingContext2D)
    const getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(() => createFixedDomRect(canvasWidth, canvasHeight))
    const toDataURLSpy = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/png;base64,draft-before-signout')

    const { rerender } = renderAppAt('/')
    await enterWorkspaceFromLanding(user)
    await fillDraftAndDraw(user, '로그아웃 전 제목', '로그아웃 전 작가', '로그아웃 전 설명')

    await waitFor(() => {
      const stored = parseStoredWorkspaceDraft()
      expect(stored).not.toBeNull()
      expect(stored?.title).toBe('로그아웃 전 제목')
      expect(stored?.authorName).toBe('로그아웃 전 작가')
      expect(stored?.description).toBe('로그아웃 전 설명')
      expect(stored?.canvasDataUrl).toBe('data:image/png;base64,draft-before-signout')
    })

    await user.click(screen.getByRole('button', { name: /before-logout/i }))
    await user.click(await screen.findByRole('menuitem', { name: '로그아웃' }))
    expect(signOut).toHaveBeenCalledTimes(1)

    authState = createMockAuth({
      userId: null,
      userEmail: null,
      signOut,
    })
    rerender(
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>,
    )

    await waitFor(() => {
      expect(screen.getByLabelText('동화 제목')).toHaveValue('')
      expect(screen.getByLabelText('지은이')).toHaveValue('')
      expect(screen.getByLabelText('그림 설명')).toHaveValue('')
      expect(parseStoredWorkspaceDraft()).toBeNull()
    })

    getContextSpy.mockRestore()
    getBoundingClientRectSpy.mockRestore()
    toDataURLSpy.mockRestore()
  })
})
