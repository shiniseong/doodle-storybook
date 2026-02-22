import { Polar, type Checkout } from '@polar-sh/sdk'

export interface PolarEnv {
  POLAR_ACCESS_TOKEN?: string
  POLAR_SERVER?: string
  POLAR_PRODUCT_ID?: string
  POLAR_PLAN_CODE?: string
  POLAR_CHECKOUT_SUCCESS_URL?: string
  POLAR_CHECKOUT_RETURN_URL?: string
  POLAR_PORTAL_RETURN_URL?: string
}

interface ResolvedPolarProductConfig {
  productId: string
  planCode: string
}

interface CheckoutUrls {
  successUrl: string
  returnUrl: string
}

function resolvePolarServer(raw: string | undefined): 'production' | 'sandbox' {
  return raw?.trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'production'
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

export function resolvePolarProductConfig(env: PolarEnv): ResolvedPolarProductConfig | null {
  const productId = (env.POLAR_PRODUCT_ID || '').trim()
  if (productId.length === 0) {
    return null
  }

  return {
    productId,
    planCode: (env.POLAR_PLAN_CODE || '').trim() || 'monthly_unlimited_6900_krw',
  }
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
  planCode: string
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
