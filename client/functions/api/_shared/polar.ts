import { Polar, type Checkout } from '@polar-sh/sdk'

export type PolarPaidPlanCode = 'standard' | 'pro'

export interface PolarEnv {
  POLAR_ACCESS_TOKEN?: string
  POLAR_SERVER?: string
  POLAR_PRODUCT_ID?: string
  POLAR_PRODUCT_ID_STANDARD?: string
  POLAR_PRODUCT_ID_PRO?: string
  POLAR_PLAN_CODE?: string
  POLAR_PLAN_CODE_STANDARD?: string
  POLAR_PLAN_CODE_PRO?: string
  POLAR_CHECKOUT_SUCCESS_URL?: string
  POLAR_CHECKOUT_RETURN_URL?: string
  POLAR_PORTAL_RETURN_URL?: string
}

interface CheckoutUrls {
  successUrl: string
  returnUrl: string
}

export interface PolarCheckoutPlanConfig {
  planCode: PolarPaidPlanCode
  productId: string
}

function normalizeString(value: string | undefined): string | null {
  const normalized = (value || '').trim()
  return normalized.length > 0 ? normalized : null
}

function resolvePolarServer(raw: string | undefined): 'production' | 'sandbox' {
  return raw?.trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'production'
}

function normalizeLegacyPlanCode(raw: string | null): PolarPaidPlanCode | null {
  if (!raw) {
    return null
  }

  const normalized = raw.trim().toLowerCase()
  if (normalized === 'pro') {
    return 'pro'
  }

  if (normalized === 'standard' || normalized === 'monthly_unlimited_6900_krw') {
    return 'standard'
  }

  return null
}

function resolveStandardProductId(env: PolarEnv): string | null {
  return normalizeString(env.POLAR_PRODUCT_ID_STANDARD) || normalizeString(env.POLAR_PRODUCT_ID)
}

function resolveProProductId(env: PolarEnv): string | null {
  return normalizeString(env.POLAR_PRODUCT_ID_PRO)
}

function resolveConfiguredPlanAlias(value: string | undefined, fallback: PolarPaidPlanCode): PolarPaidPlanCode {
  const normalized = normalizeLegacyPlanCode(normalizeString(value))
  return normalized ?? fallback
}

export function resolveCheckoutUrls(request: Request, env: PolarEnv): CheckoutUrls {
  const requestOrigin = new URL(request.url).origin

  const successUrl = (env.POLAR_CHECKOUT_SUCCESS_URL || '').trim() || `${requestOrigin}/create?checkout=success`
  const returnUrl = (env.POLAR_CHECKOUT_RETURN_URL || '').trim() || `${requestOrigin}/create?checkout=canceled`

  return {
    successUrl,
    returnUrl,
  }
}

export function resolvePortalReturnUrl(request: Request, env: PolarEnv): string {
  const requestOrigin = new URL(request.url).origin
  return (env.POLAR_PORTAL_RETURN_URL || '').trim() || `${requestOrigin}/create`
}

export function resolvePolarClient(env: PolarEnv): Polar | null {
  const accessToken = (env.POLAR_ACCESS_TOKEN || '').trim()
  if (accessToken.length === 0) {
    return null
  }

  return new Polar({
    accessToken,
    server: resolvePolarServer(env.POLAR_SERVER),
  })
}

export function resolveCheckoutPlanConfig(
  env: PolarEnv,
  requestedPlanCode: PolarPaidPlanCode,
): PolarCheckoutPlanConfig | null {
  if (requestedPlanCode === 'pro') {
    const productId = resolveProProductId(env)
    if (!productId) {
      return null
    }

    return {
      planCode: resolveConfiguredPlanAlias(env.POLAR_PLAN_CODE_PRO, 'pro'),
      productId,
    }
  }

  const productId = resolveStandardProductId(env)
  if (!productId) {
    return null
  }

  return {
    planCode: resolveConfiguredPlanAlias(env.POLAR_PLAN_CODE_STANDARD, 'standard'),
    productId,
  }
}

export function resolveCanonicalPaidPlanCode(rawPlanCode: string | null | undefined, env: PolarEnv): PolarPaidPlanCode | null {
  const normalized = normalizeString(rawPlanCode ?? undefined)
  if (!normalized) {
    return null
  }

  const canonical = normalizeLegacyPlanCode(normalized)
  if (canonical) {
    return canonical
  }

  const standardAlias = normalizeString(env.POLAR_PLAN_CODE_STANDARD)
  if (standardAlias && standardAlias.toLowerCase() === normalized.toLowerCase()) {
    return 'standard'
  }

  const proAlias = normalizeString(env.POLAR_PLAN_CODE_PRO)
  if (proAlias && proAlias.toLowerCase() === normalized.toLowerCase()) {
    return 'pro'
  }

  return null
}

export function resolvePlanCodeFromPolarProductId(productId: string | null | undefined, env: PolarEnv): PolarPaidPlanCode | null {
  const normalizedProductId = normalizeString(productId ?? undefined)
  if (!normalizedProductId) {
    return null
  }

  const proProductId = resolveProProductId(env)
  if (proProductId && proProductId === normalizedProductId) {
    return 'pro'
  }

  const standardProductId = resolveStandardProductId(env)
  if (standardProductId && standardProductId === normalizedProductId) {
    return 'standard'
  }

  return null
}

export function resolveLegacyFallbackPlanCode(env: PolarEnv): PolarPaidPlanCode {
  const fromLegacy = resolveCanonicalPaidPlanCode(normalizeString(env.POLAR_PLAN_CODE), env)
  if (fromLegacy) {
    return fromLegacy
  }

  return 'standard'
}

function resolveCheckoutUrl(checkout: Checkout): string | null {
  if (typeof checkout.url === 'string' && checkout.url.trim().length > 0) {
    return checkout.url.trim()
  }

  return null
}

export async function createPolarCheckoutUrl(input: {
  client: Polar
  productId: string
  externalCustomerId: string
  successUrl: string
  returnUrl: string
  planCode: PolarPaidPlanCode
}): Promise<string | null> {
  const checkout = await input.client.checkouts.create({
    products: [input.productId],
    externalCustomerId: input.externalCustomerId,
    allowTrial: true,
    trialInterval: 'day',
    trialIntervalCount: 1,
    successUrl: input.successUrl,
    returnUrl: input.returnUrl,
    metadata: {
      planCode: input.planCode,
      source: 'doodle-storybook',
    },
  })

  return resolveCheckoutUrl(checkout)
}

export async function createPolarCustomerPortalUrl(input: {
  client: Polar
  externalCustomerId: string
  returnUrl: string
}): Promise<string | null> {
  const session = await input.client.customerSessions.create({
    externalCustomerId: input.externalCustomerId,
    returnUrl: input.returnUrl,
  })

  if (typeof session.customerPortalUrl === 'string' && session.customerPortalUrl.trim().length > 0) {
    return session.customerPortalUrl.trim()
  }

  return null
}
