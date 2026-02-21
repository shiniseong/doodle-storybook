const STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY = 'doodle-storybook.workspace-draft.v1'

export interface StorybookWorkspaceDraft {
  readonly title: string
  readonly authorName: string
  readonly description: string
  readonly canvasDataUrl: string | null
}

export const EMPTY_STORYBOOK_WORKSPACE_DRAFT: StorybookWorkspaceDraft = {
  title: '',
  authorName: '',
  description: '',
  canvasDataUrl: null,
}

function resolveSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  const storageCandidate = window.sessionStorage as unknown
  if (
    typeof storageCandidate === 'object' &&
    storageCandidate !== null &&
    'getItem' in storageCandidate &&
    typeof storageCandidate.getItem === 'function' &&
    'setItem' in storageCandidate &&
    typeof storageCandidate.setItem === 'function'
  ) {
    return storageCandidate as Storage
  }

  return null
}

function normalizeDraftField(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  return value
}

function normalizeCanvasDataUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null
  }

  return value
}

function isEmptyDraft(draft: StorybookWorkspaceDraft): boolean {
  return (
    draft.title.length === 0 &&
    draft.authorName.length === 0 &&
    draft.description.length === 0 &&
    draft.canvasDataUrl === null
  )
}

export function loadStorybookWorkspaceDraft(): StorybookWorkspaceDraft {
  const storage = resolveSessionStorage()
  if (!storage) {
    return EMPTY_STORYBOOK_WORKSPACE_DRAFT
  }

  try {
    const raw = storage.getItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY)
    if (!raw) {
      return EMPTY_STORYBOOK_WORKSPACE_DRAFT
    }

    const parsed = JSON.parse(raw) as Partial<StorybookWorkspaceDraft> | null
    if (!parsed || typeof parsed !== 'object') {
      return EMPTY_STORYBOOK_WORKSPACE_DRAFT
    }

    return {
      title: normalizeDraftField(parsed.title),
      authorName: normalizeDraftField(parsed.authorName),
      description: normalizeDraftField(parsed.description),
      canvasDataUrl: normalizeCanvasDataUrl(parsed.canvasDataUrl),
    }
  } catch {
    return EMPTY_STORYBOOK_WORKSPACE_DRAFT
  }
}

export function saveStorybookWorkspaceDraft(draft: StorybookWorkspaceDraft): void {
  const storage = resolveSessionStorage()
  if (!storage) {
    return
  }

  try {
    if (isEmptyDraft(draft)) {
      storage.removeItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY)
      return
    }

    storage.setItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Ignore storage quota and serialization failures.
  }
}

export function clearStorybookWorkspaceDraft(): void {
  const storage = resolveSessionStorage()
  if (!storage) {
    return
  }

  try {
    storage.removeItem(STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY)
  } catch {
    // Ignore storage failures.
  }
}

export { STORYBOOK_WORKSPACE_DRAFT_STORAGE_KEY }
