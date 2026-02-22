export type BillingSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid'
export type BillingPlanCode = 'free' | 'standard' | 'pro'
export type BillingPaidPlanCode = Exclude<BillingPlanCode, 'free'>

export interface BillingSubscription {
  status: BillingSubscriptionStatus
  planCode: BillingPaidPlanCode | null
  trialStartAt: string | null
  trialEndAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  providerCustomerId: string | null
  providerSubscriptionId: string | null
}

export interface BillingQuota {
  freeStoryQuotaTotal: number
  freeStoryQuotaUsed: number
  remainingFreeStories: number
  dailyQuotaLimit: number | null
  dailyQuotaUsed: number
  remainingDailyStories: number | null
  dailyQuotaDateKst: string | null
}

export interface BillingPlanDefinition {
  code: BillingPlanCode
  name: string
  priceUsdMonthly: number
  totalFreeStories?: number
  dailyQuota?: number
  trialDays?: number
}

export interface BillingCurrentPlan {
  code: BillingPlanCode
  name: string
}

export interface SubscriptionAccessSnapshot {
  subscription: BillingSubscription | null
  quota: BillingQuota
  currentPlan: BillingCurrentPlan
  plans: BillingPlanDefinition[]
  canCreate: boolean
}

export type TrialStartActionResult =
  | {
      action: 'checkout'
      checkoutUrl: string
    }
  | {
      action: 'portal'
      portalUrl: string
    }
  | {
      action: 'noop'
      reason: string
      message?: string
    }

export interface SubscriptionPortalResult {
  portalUrl: string
}

export interface SubscriptionAccessPort {
  getSnapshot(): Promise<SubscriptionAccessSnapshot>
  startTrial(planCode: BillingPaidPlanCode): Promise<TrialStartActionResult>
  openPortal(): Promise<SubscriptionPortalResult>
}

export interface SubscriptionAccessUseCasePort {
  getSnapshot(): Promise<SubscriptionAccessSnapshot>
  startTrial(planCode: BillingPaidPlanCode): Promise<TrialStartActionResult>
  openPortal(): Promise<SubscriptionPortalResult>
}

export class SubscriptionAccessUseCase implements SubscriptionAccessUseCasePort {
  private readonly port: SubscriptionAccessPort

  constructor(port: SubscriptionAccessPort) {
    this.port = port
  }

  getSnapshot(): Promise<SubscriptionAccessSnapshot> {
    return this.port.getSnapshot()
  }

  startTrial(planCode: BillingPaidPlanCode): Promise<TrialStartActionResult> {
    return this.port.startTrial(planCode)
  }

  openPortal(): Promise<SubscriptionPortalResult> {
    return this.port.openPortal()
  }
}
