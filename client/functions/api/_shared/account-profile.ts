import {
  createSupabaseHeaders,
  readResponseBody,
  resolveSupabaseErrorMessage,
  type SupabaseConfig,
  type SupabaseError,
  type SupabaseResult,
} from './supabase'
import { DEFAULT_REQUIRED_AGREEMENTS_VERSION } from './agreements-policy'

export const REQUIRED_AGREEMENTS_VERSION = DEFAULT_REQUIRED_AGREEMENTS_VERSION
export const REQUIRED_AGREEMENTS_REJECT_CODE = 'REQUIRED_AGREEMENTS_NOT_ACCEPTED'

interface AccountProfileRow {
  agreed_terms_of_service: unknown
  agreed_adult_payer: unknown
  agreed_no_direct_child_data_collection: unknown
  required_agreements_version: unknown
  required_agreements_accepted_at: unknown
}

export interface AccountAgreementsStatus {
  requiredVersion: string
  hasAcceptedRequiredAgreements: boolean
  agreements: {
    termsOfService: boolean
    adultPayer: boolean
    noDirectChildDataCollection: boolean
  }
  acceptedAt: string | null
}

interface AccountAgreementDecision {
  accepted: boolean
  status: AccountAgreementsStatus
}

function asSupabaseFailure(status: number, message: string): SupabaseError {
  return {
    ok: false,
    failure: {
      status,
      message,
    },
  }
}

function normalizeBoolean(value: unknown): boolean {
  return value === true
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeStatus(
  row: AccountProfileRow | null,
  requiredAgreementsVersion: string,
): AccountAgreementsStatus {
  const termsOfService = normalizeBoolean(row?.agreed_terms_of_service)
  const adultPayer = normalizeBoolean(row?.agreed_adult_payer)
  const noDirectChildDataCollection = normalizeBoolean(row?.agreed_no_direct_child_data_collection)
  const acceptedAt = normalizeString(row?.required_agreements_accepted_at)
  const requiredVersion = normalizeString(row?.required_agreements_version) ?? requiredAgreementsVersion

  const hasAcceptedRequiredAgreements =
    termsOfService &&
    adultPayer &&
    noDirectChildDataCollection &&
    requiredVersion === requiredAgreementsVersion &&
    acceptedAt !== null

  return {
    requiredVersion: requiredAgreementsVersion,
    hasAcceptedRequiredAgreements,
    agreements: {
      termsOfService,
      adultPayer,
      noDirectChildDataCollection,
    },
    acceptedAt,
  }
}

async function fetchAccountProfileRow(
  config: SupabaseConfig,
  userId: string,
): Promise<SupabaseResult<AccountProfileRow | null>> {
  const query = new URLSearchParams({
    select:
      'agreed_terms_of_service,agreed_adult_payer,agreed_no_direct_child_data_collection,required_agreements_version,required_agreements_accepted_at',
    user_id: `eq.${userId}`,
    limit: '1',
  })

  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/rest/v1/account_profiles?${query.toString()}`, {
      method: 'GET',
      headers: createSupabaseHeaders(config),
    })
  } catch {
    return asSupabaseFailure(502, 'Failed to reach Supabase REST API for account_profiles.')
  }

  const payload = await readResponseBody(response)
  if (!response.ok) {
    return asSupabaseFailure(
      response.status,
      resolveSupabaseErrorMessage(payload, 'Failed to fetch account profile from Supabase.'),
    )
  }

  if (!Array.isArray(payload) || payload.length === 0) {
    return {
      ok: true,
      value: null,
    }
  }

  const first = payload[0]
  if (!first || typeof first !== 'object') {
    return asSupabaseFailure(502, 'Invalid account profile response from Supabase.')
  }

  return {
    ok: true,
    value: first as AccountProfileRow,
  }
}

export async function getAccountAgreementStatus(
  config: SupabaseConfig,
  userId: string,
  requiredAgreementsVersion: string = REQUIRED_AGREEMENTS_VERSION,
): Promise<SupabaseResult<AccountAgreementsStatus>> {
  const rowResult = await fetchAccountProfileRow(config, userId)
  if (!rowResult.ok) {
    return rowResult
  }

  return {
    ok: true,
    value: normalizeStatus(rowResult.value, requiredAgreementsVersion),
  }
}

export async function acceptRequiredAgreements(
  config: SupabaseConfig,
  userId: string,
  requiredAgreementsVersion: string = REQUIRED_AGREEMENTS_VERSION,
): Promise<SupabaseResult<AccountAgreementsStatus>> {
  let response: Response

  try {
    response = await fetch(`${config.baseUrl}/rest/v1/account_profiles?on_conflict=user_id`, {
      method: 'POST',
      headers: createSupabaseHeaders(config, {
        includeJsonBody: true,
        preferMinimal: true,
        mergeDuplicates: true,
      }),
      body: JSON.stringify({
        user_id: userId,
        agreed_terms_of_service: true,
        agreed_adult_payer: true,
        agreed_no_direct_child_data_collection: true,
        required_agreements_version: requiredAgreementsVersion,
        required_agreements_accepted_at: new Date().toISOString(),
      }),
    })
  } catch {
    return asSupabaseFailure(502, 'Failed to upsert account profile agreements in Supabase.')
  }

  if (!response.ok) {
    const payload = await readResponseBody(response)
    return asSupabaseFailure(
      response.status,
      resolveSupabaseErrorMessage(payload, 'Failed to upsert account profile agreements in Supabase.'),
    )
  }

  return getAccountAgreementStatus(config, userId, requiredAgreementsVersion)
}

export async function ensureRequiredAgreementsAccepted(
  config: SupabaseConfig,
  userId: string,
  requiredAgreementsVersion: string = REQUIRED_AGREEMENTS_VERSION,
): Promise<SupabaseResult<AccountAgreementDecision>> {
  const statusResult = await getAccountAgreementStatus(config, userId, requiredAgreementsVersion)
  if (!statusResult.ok) {
    return statusResult
  }

  return {
    ok: true,
    value: {
      accepted: statusResult.value.hasAcceptedRequiredAgreements,
      status: statusResult.value,
    },
  }
}
