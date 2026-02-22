export type BillingSubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'unpaid'

export interface BillingSubscription {
  status: BillingSubscriptionStatus
  planCode: string | null
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
}

export interface SubscriptionAccessSnapshot {
  subscription: BillingSubscription | null
  quota: BillingQuota
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
  startTrial(): Promise<TrialStartActionResult>
  openPortal(): Promise<SubscriptionPortalResult>
}

export interface SubscriptionAccessUseCasePort {
  getSnapshot(): Promise<SubscriptionAccessSnapshot>
  startTrial(): Promise<TrialStartActionResult>
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

  startTrial(): Promise<TrialStartActionResult> {
    return this.port.startTrial()
  }

  openPortal(): Promise<SubscriptionPortalResult> {
    return this.port.openPortal()
  }
}
