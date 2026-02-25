import { authenticateRequest } from '../_shared/auth'
import {
  acceptRequiredAgreements,
  getAccountAgreementStatus,
  REQUIRED_AGREEMENTS_REJECT_CODE,
} from '../_shared/account-profile'
import {
  resolveRequiredAgreementsVersion,
  type RequiredAgreementsEnv,
} from '../_shared/agreements-policy'
import { resolveSupabaseConfig, type SupabaseEnv } from '../_shared/supabase'

type Env = SupabaseEnv & RequiredAgreementsEnv

interface AcceptRequiredAgreementsRequestBody {
  termsOfService?: unknown
  adultPayer?: unknown
  noDirectChildDataCollection?: unknown
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

function isRequiredAgreementPayload(value: unknown): value is Required<AcceptRequiredAgreementsRequestBody> {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as AcceptRequiredAgreementsRequestBody
  return (
    candidate.termsOfService === true &&
    candidate.adultPayer === true &&
    candidate.noDirectChildDataCollection === true
  )
}

export const onRequestOptions: PagesFunction<Env> = async () => {
  return new Response(null, {
    status: 204,
    headers: withCors(),
  })
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const authResult = await authenticateRequest(context.request, context.env)
  if (!authResult.ok) {
    return jsonResponse(
      {
        error: authResult.failure.message,
      },
      authResult.failure.status,
    )
  }

  const supabaseConfig = resolveSupabaseConfig(context.env)
  if (!supabaseConfig) {
    return jsonResponse(
      {
        error: 'SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY must be configured.',
      },
      500,
    )
  }

  const requiredAgreementsVersion = resolveRequiredAgreementsVersion(context.env)
  const statusResult = await getAccountAgreementStatus(
    supabaseConfig,
    authResult.value.userId,
    requiredAgreementsVersion,
  )
  if (!statusResult.ok) {
    return jsonResponse(
      {
        error: 'Failed to fetch account agreement status.',
        detail: statusResult.failure.message,
      },
      502,
    )
  }

  return jsonResponse(statusResult.value)
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const authResult = await authenticateRequest(context.request, context.env)
  if (!authResult.ok) {
    return jsonResponse(
      {
        error: authResult.failure.message,
      },
      authResult.failure.status,
    )
  }

  let requestBody: unknown
  try {
    requestBody = await context.request.json()
  } catch {
    return jsonResponse(
      {
        error: 'Invalid JSON body.',
      },
      400,
    )
  }

  if (!isRequiredAgreementPayload(requestBody)) {
    return jsonResponse(
      {
        code: REQUIRED_AGREEMENTS_REJECT_CODE,
        error: 'All required agreements must be accepted.',
      },
      400,
    )
  }

  const supabaseConfig = resolveSupabaseConfig(context.env)
  if (!supabaseConfig) {
    return jsonResponse(
      {
        error: 'SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY must be configured.',
      },
      500,
    )
  }

  const requiredAgreementsVersion = resolveRequiredAgreementsVersion(context.env)
  const acceptResult = await acceptRequiredAgreements(
    supabaseConfig,
    authResult.value.userId,
    requiredAgreementsVersion,
  )
  if (!acceptResult.ok) {
    return jsonResponse(
      {
        error: 'Failed to persist required agreements.',
        detail: acceptResult.failure.message,
      },
      502,
    )
  }

  return jsonResponse(acceptResult.value)
}
