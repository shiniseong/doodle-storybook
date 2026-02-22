import { buildStorybookDetailApiResponse } from './storybooks-response'
import { authenticateRequest } from '../_shared/auth'

interface Env {
  SUPABASE_URL?: string
  VITE_SUPABASE_URL?: string
  SUPABASE_SECRET_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  CLOUDFLARE_R2_PUBLIC_BASE_URL?: string
  R2_PUBLIC_BASE_URL?: string
}

interface SupabasePersistenceConfig {
  baseUrl: string
  serviceRoleKey: string
  schema: string
}

interface SupabaseMutationFailure {
  status: number
  message: string
}

interface SupabaseMutationError {
  ok: false
  failure: SupabaseMutationFailure
}

interface StorybookRowFromSupabase {
  id?: unknown
  title?: unknown
  author_name?: unknown
  description?: unknown
  origin_image_r2_key?: unknown
  cover_image_r2_key?: unknown
  highlight_image_r2_key?: unknown
  end_image_r2_key?: unknown
  created_at?: unknown
}

interface StorybookOriginDetailRowFromSupabase {
  page_index?: unknown
  drawing_image_r2_key?: unknown
  description?: unknown
}

interface StorybookOutputDetailRowFromSupabase {
  page_index?: unknown
  page_type?: unknown
  title?: unknown
  content?: unknown
  image_r2_key?: unknown
  audio_r2_key?: unknown
  is_highlight?: unknown
}

interface StorybookDetailRows {
  storybook: {
    id: string
    title: string | null
    author_name: string | null
    description: string | null
    origin_image_r2_key: string | null
    cover_image_r2_key: string | null
    highlight_image_r2_key: string | null
    end_image_r2_key: string | null
    created_at: string | null
  }
  originDetails: Array<{
    page_index: number
    drawing_image_r2_key: string | null
    description: string | null
  }>
  outputDetails: Array<{
    page_index: number
    page_type: 'cover' | 'story'
    title: string | null
    content: string | null
    image_r2_key: string | null
    audio_r2_key: string | null
    is_highlight: boolean
  }>
}

interface SupabaseMutationSuccess<T> {
  ok: true
  value: T
}

type SupabaseMutationResult<T> = SupabaseMutationSuccess<T> | SupabaseMutationError

const STORYBOOK_DB_SCHEMA = 'doodle_storybook_db'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
} as const

function withCors(headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers)

  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    nextHeaders.set(key, value)
  })

  return nextHeaders
}

function jsonResponse(payload: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: withCors({
      'Content-Type': 'application/json; charset=utf-8',
    }),
  })
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim()
    if (normalized.length === 0) {
      return null
    }

    const parsed = Number(normalized)
    if (Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0) {
      return parsed
    }
  }

  return null
}

function normalizePageType(value: unknown): 'cover' | 'story' {
  return value === 'cover' ? 'cover' : 'story'
}

function resolveSupabasePersistenceConfig(env: Env): SupabasePersistenceConfig | null {
  const rawBaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim()
  const serviceRoleKey = (env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

  if (rawBaseUrl.length === 0 || serviceRoleKey.length === 0) {
    return null
  }

  return {
    baseUrl: rawBaseUrl.replace(/\/+$/, ''),
    serviceRoleKey,
    schema: STORYBOOK_DB_SCHEMA,
  }
}

function createSupabaseHeaders(
  config: SupabasePersistenceConfig,
  includeJsonBody: boolean,
  preferMinimal: boolean = false,
): Headers {
  const headers = new Headers({
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    'Content-Profile': config.schema,
    'Accept-Profile': config.schema,
  })

  if (includeJsonBody) {
    headers.set('Content-Type', 'application/json')
  }

  if (preferMinimal) {
    headers.set('Prefer', 'return=minimal')
  }

  return headers
}

function resolveSupabaseErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') {
    return fallback
  }

  const candidate = payload as {
    message?: unknown
    error?: unknown
    details?: unknown
    hint?: unknown
  }
  const parts = [candidate.message, candidate.error, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .filter((value, index, list) => list.indexOf(value) === index)

  if (parts.length === 0) {
    return fallback
  }

  return parts.join(' | ')
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown
  } catch {
    try {
      const text = await response.text()
      return { raw: text }
    } catch {
      return null
    }
  }
}

function normalizeStorybookRow(raw: unknown): StorybookDetailRows['storybook'] | null {
  if (!raw || typeof raw !== 'object') {
    return null
  }

  const row = raw as StorybookRowFromSupabase
  const id = normalizeString(row.id)
  if (!id) {
    return null
  }

  return {
    id,
    title: normalizeString(row.title),
    author_name: normalizeString(row.author_name),
    description: normalizeString(row.description),
    origin_image_r2_key: normalizeString(row.origin_image_r2_key),
    cover_image_r2_key: normalizeString(row.cover_image_r2_key),
    highlight_image_r2_key: normalizeString(row.highlight_image_r2_key),
    end_image_r2_key: normalizeString(row.end_image_r2_key),
    created_at: normalizeString(row.created_at),
  }
}

function normalizeOriginDetailRows(raw: unknown): StorybookDetailRows['originDetails'] | null {
  if (!Array.isArray(raw)) {
    return null
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const row = item as StorybookOriginDetailRowFromSupabase
      const pageIndex = parseNonNegativeInteger(row.page_index)
      if (pageIndex === null) {
        return null
      }

      return {
        page_index: pageIndex,
        drawing_image_r2_key: normalizeString(row.drawing_image_r2_key),
        description: normalizeString(row.description),
      }
    })
    .filter((item): item is StorybookDetailRows['originDetails'][number] => item !== null)
    .sort((left, right) => left.page_index - right.page_index)
}

function normalizeOutputDetailRows(raw: unknown): StorybookDetailRows['outputDetails'] | null {
  if (!Array.isArray(raw)) {
    return null
  }

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null
      }

      const row = item as StorybookOutputDetailRowFromSupabase
      const pageIndex = parseNonNegativeInteger(row.page_index)
      if (pageIndex === null) {
        return null
      }

      return {
        page_index: pageIndex,
        page_type: normalizePageType(row.page_type),
        title: normalizeString(row.title),
        content: normalizeString(row.content),
        image_r2_key: normalizeString(row.image_r2_key),
        audio_r2_key: normalizeString(row.audio_r2_key),
        is_highlight: row.is_highlight === true,
      }
    })
    .filter((item): item is StorybookDetailRows['outputDetails'][number] => item !== null)
    .sort((left, right) => left.page_index - right.page_index)
}

async function fetchStorybookRow(
  config: SupabasePersistenceConfig,
  userId: string,
  storybookId: string,
): Promise<SupabaseMutationResult<StorybookDetailRows['storybook'] | null>> {
  const query = new URLSearchParams({
    select:
      'id,title,author_name,description,origin_image_r2_key,cover_image_r2_key,highlight_image_r2_key,end_image_r2_key,created_at',
    user_id: `eq.${userId}`,
    id: `eq.${storybookId}`,
    status: 'eq.completed',
    limit: '1',
  })

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/storybooks?${query.toString()}`, {
      method: 'GET',
      headers: createSupabaseHeaders(config, false),
    })
  } catch {
    return {
      ok: false,
      failure: {
        status: 502,
        message: 'Failed to reach Supabase REST API for storybook detail.',
      },
    }
  }

  const payload = await readResponseBody(response)
  if (!response.ok) {
    return {
      ok: false,
      failure: {
        status: response.status,
        message: resolveSupabaseErrorMessage(payload, 'Failed to fetch storybook detail from Supabase.'),
      },
    }
  }

  if (!Array.isArray(payload)) {
    return {
      ok: false,
      failure: {
        status: 502,
        message: 'Invalid storybook detail response from Supabase.',
      },
    }
  }

  const row = normalizeStorybookRow(payload[0])
  return {
    ok: true,
    value: row,
  }
}

async function fetchStorybookOriginDetailRows(
  config: SupabasePersistenceConfig,
  storybookId: string,
): Promise<SupabaseMutationResult<StorybookDetailRows['originDetails']>> {
  const query = new URLSearchParams({
    select: 'page_index,drawing_image_r2_key,description',
    storybook_id: `eq.${storybookId}`,
    order: 'page_index.asc',
  })

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/storybook_origin_details?${query.toString()}`, {
      method: 'GET',
      headers: createSupabaseHeaders(config, false),
    })
  } catch {
    return {
      ok: false,
      failure: {
        status: 502,
        message: 'Failed to reach Supabase REST API for storybook origin details.',
      },
    }
  }

  const payload = await readResponseBody(response)
  if (!response.ok) {
    return {
      ok: false,
      failure: {
        status: response.status,
        message: resolveSupabaseErrorMessage(payload, 'Failed to fetch storybook origin details from Supabase.'),
      },
    }
  }

  const rows = normalizeOriginDetailRows(payload)
  if (!rows) {
    return {
      ok: false,
      failure: {
        status: 502,
        message: 'Invalid storybook origin details response from Supabase.',
      },
    }
  }

  return {
    ok: true,
    value: rows,
  }
}

async function fetchStorybookOutputDetailRows(
  config: SupabasePersistenceConfig,
  storybookId: string,
): Promise<SupabaseMutationResult<StorybookDetailRows['outputDetails']>> {
  const query = new URLSearchParams({
    select: 'page_index,page_type,title,content,image_r2_key,audio_r2_key,is_highlight',
    storybook_id: `eq.${storybookId}`,
    order: 'page_index.asc',
  })

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/storybook_output_details?${query.toString()}`, {
      method: 'GET',
      headers: createSupabaseHeaders(config, false),
    })
  } catch {
    return {
      ok: false,
      failure: {
        status: 502,
        message: 'Failed to reach Supabase REST API for storybook output details.',
      },
    }
  }

  const payload = await readResponseBody(response)
  if (!response.ok) {
    return {
      ok: false,
      failure: {
        status: response.status,
        message: resolveSupabaseErrorMessage(payload, 'Failed to fetch storybook output details from Supabase.'),
      },
    }
  }

  const rows = normalizeOutputDetailRows(payload)
  if (!rows) {
    return {
      ok: false,
      failure: {
        status: 502,
        message: 'Invalid storybook output details response from Supabase.',
      },
    }
  }

  return {
    ok: true,
    value: rows,
  }
}

async function deleteRowsByFilterFromSupabase(
  config: SupabasePersistenceConfig,
  table: 'storybooks' | 'storybook_origin_details' | 'storybook_output_details',
  filterQuery: string,
): Promise<SupabaseMutationResult<null>> {
  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/${table}?${filterQuery}`, {
      method: 'DELETE',
      headers: createSupabaseHeaders(config, false, true),
    })
  } catch {
    return {
      ok: false,
      failure: {
        status: 502,
        message: `Failed to reach Supabase REST API for deleting "${table}".`,
      },
    }
  }

  if (response.ok) {
    return {
      ok: true,
      value: null,
    }
  }

  const payload = await readResponseBody(response)
  return {
    ok: false,
    failure: {
      status: response.status,
      message: resolveSupabaseErrorMessage(payload, `Failed to delete rows from "${table}".`),
    },
  }
}

async function deleteStorybookByIdFromSupabase(
  config: SupabasePersistenceConfig,
  userId: string,
  storybookId: string,
): Promise<SupabaseMutationResult<null>> {
  const outputDelete = await deleteRowsByFilterFromSupabase(
    config,
    'storybook_output_details',
    `storybook_id=eq.${encodeURIComponent(storybookId)}`,
  )
  if (!outputDelete.ok) {
    return outputDelete
  }

  const originDelete = await deleteRowsByFilterFromSupabase(
    config,
    'storybook_origin_details',
    `storybook_id=eq.${encodeURIComponent(storybookId)}`,
  )
  if (!originDelete.ok) {
    return originDelete
  }

  return deleteRowsByFilterFromSupabase(
    config,
    'storybooks',
    `id=eq.${encodeURIComponent(storybookId)}&user_id=eq.${encodeURIComponent(userId)}`,
  )
}

function resolveStorybookIdFromParams(params: unknown): string {
  if (!params || typeof params !== 'object') {
    return ''
  }

  const candidate = params as Record<string, unknown>
  const paramValue = candidate.storybookId

  if (typeof paramValue === 'string') {
    return paramValue.trim()
  }

  if (Array.isArray(paramValue)) {
    const first = paramValue[0]
    return typeof first === 'string' ? first.trim() : ''
  }

  return ''
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: withCors(),
  })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const storybookId = resolveStorybookIdFromParams(context.params)

  if (storybookId.length === 0) {
    return jsonResponse(
      {
        error: 'storybookId path parameter is required.',
      },
      400,
    )
  }

  const authResult = await authenticateRequest(context.request, context.env)
  if (!authResult.ok) {
    return jsonResponse(
      {
        error: authResult.failure.message,
      },
      authResult.failure.status,
    )
  }
  const userId = authResult.value.userId

  const supabasePersistenceConfig = resolveSupabasePersistenceConfig(context.env)
  if (!supabasePersistenceConfig) {
    return jsonResponse(
      {
        error: 'SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY must be configured.',
      },
      500,
    )
  }

  const storybookResult = await fetchStorybookRow(supabasePersistenceConfig, userId, storybookId)
  if (!storybookResult.ok) {
    console.error('Failed to fetch storybook detail row from Supabase.', {
      storybookId,
      userId,
      status: storybookResult.failure.status,
      message: storybookResult.failure.message,
    })

    return jsonResponse(
      {
        error: 'Failed to fetch storybook detail.',
        detail: storybookResult.failure.message,
      },
      502,
    )
  }

  if (!storybookResult.value) {
    return jsonResponse(
      {
        error: 'Storybook not found.',
      },
      404,
    )
  }

  const [originResult, outputResult] = await Promise.all([
    fetchStorybookOriginDetailRows(supabasePersistenceConfig, storybookId),
    fetchStorybookOutputDetailRows(supabasePersistenceConfig, storybookId),
  ])

  if (!originResult.ok) {
    console.error('Failed to fetch storybook origin details from Supabase.', {
      storybookId,
      userId,
      status: originResult.failure.status,
      message: originResult.failure.message,
    })

    return jsonResponse(
      {
        error: 'Failed to fetch storybook detail.',
        detail: originResult.failure.message,
      },
      502,
    )
  }

  if (!outputResult.ok) {
    console.error('Failed to fetch storybook output details from Supabase.', {
      storybookId,
      userId,
      status: outputResult.failure.status,
      message: outputResult.failure.message,
    })

    return jsonResponse(
      {
        error: 'Failed to fetch storybook detail.',
        detail: outputResult.failure.message,
      },
      502,
    )
  }

  const detailResponse = buildStorybookDetailApiResponse({
    storybook: storybookResult.value,
    originDetails: originResult.value,
    outputDetails: outputResult.value,
    env: context.env,
  })

  if (!detailResponse) {
    return jsonResponse(
      {
        error: 'Failed to compose storybook detail response.',
      },
      502,
    )
  }

  return jsonResponse(detailResponse)
}

export const onRequestDelete: PagesFunction<Env> = async (context) => {
  const storybookId = resolveStorybookIdFromParams(context.params)

  if (storybookId.length === 0) {
    return jsonResponse(
      {
        error: 'storybookId path parameter is required.',
      },
      400,
    )
  }

  const authResult = await authenticateRequest(context.request, context.env)
  if (!authResult.ok) {
    return jsonResponse(
      {
        error: authResult.failure.message,
      },
      authResult.failure.status,
    )
  }
  const userId = authResult.value.userId

  const supabasePersistenceConfig = resolveSupabasePersistenceConfig(context.env)
  if (!supabasePersistenceConfig) {
    return jsonResponse(
      {
        error: 'SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY must be configured.',
      },
      500,
    )
  }

  const storybookResult = await fetchStorybookRow(supabasePersistenceConfig, userId, storybookId)
  if (!storybookResult.ok) {
    console.error('Failed to verify storybook ownership before delete.', {
      storybookId,
      userId,
      status: storybookResult.failure.status,
      message: storybookResult.failure.message,
    })

    return jsonResponse(
      {
        error: 'Failed to delete storybook.',
        detail: storybookResult.failure.message,
      },
      502,
    )
  }

  if (!storybookResult.value) {
    return jsonResponse(
      {
        error: 'Storybook not found.',
      },
      404,
    )
  }

  const deleteResult = await deleteStorybookByIdFromSupabase(supabasePersistenceConfig, userId, storybookId)
  if (!deleteResult.ok) {
    console.error('Failed to delete storybook from Supabase.', {
      storybookId,
      userId,
      status: deleteResult.failure.status,
      message: deleteResult.failure.message,
    })

    return jsonResponse(
      {
        error: 'Failed to delete storybook.',
        detail: deleteResult.failure.message,
      },
      502,
    )
  }

  return new Response(null, {
    status: 204,
    headers: withCors(),
  })
}
