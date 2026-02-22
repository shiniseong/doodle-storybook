import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useBodyScrollLock } from '@shared/lib/dom/body-scroll-lock'
import type {
  BillingPaidPlanCode,
  BillingPlanCode,
  BillingPlanDefinition,
} from '@features/subscription-access/application/subscription-access.use-case'

import './SubscriptionPlansModal.css'

interface SubscriptionPlansModalProps {
  isOpen: boolean
  plans: BillingPlanDefinition[]
  currentPlanCode: BillingPlanCode
  isSubmitting: boolean
  onSelectPlan: (planCode: BillingPaidPlanCode) => void
  onClose: () => void
}

function resolvePlanPriceLabel(plan: BillingPlanDefinition): string {
  if (plan.priceUsdMonthly <= 0) {
    return '$0'
  }

  return `$${plan.priceUsdMonthly.toFixed(2)}`
}

function isPaidPlanCode(value: BillingPlanCode): value is BillingPaidPlanCode {
  return value === 'standard' || value === 'pro'
}

function SubscriptionPlansModalLayer({
  plans,
  currentPlanCode,
  isSubmitting,
  onSelectPlan,
  onClose,
}: Omit<SubscriptionPlansModalProps, 'isOpen'>) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useBodyScrollLock()

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || isSubmitting) {
        return
      }

      event.preventDefault()
      onClose()
    }

    window.addEventListener('keydown', handleWindowKeyDown)

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown)
    }
  }, [isSubmitting, onClose])

  return (
    <div
      className="subscription-plans-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <button
        type="button"
        className="subscription-plans-modal__backdrop"
        onClick={onClose}
        aria-label={t('workspace.pricingModal.close')}
        disabled={isSubmitting}
      />
      <article className="subscription-plans-modal__sheet">
        <button
          ref={closeButtonRef}
          type="button"
          className="subscription-plans-modal__close"
          onClick={onClose}
          aria-label={t('workspace.pricingModal.close')}
          disabled={isSubmitting}
        >
          <X size={16} strokeWidth={2.4} aria-hidden="true" />
        </button>
        <header className="subscription-plans-modal__header">
          <h3 id={titleId}>{t('workspace.pricingModal.title')}</h3>
          <p id={descriptionId}>{t('workspace.pricingModal.description')}</p>
        </header>
        <div className="subscription-plans-modal__grid">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlanCode === plan.code
            const priceLabel = resolvePlanPriceLabel(plan)
            let planAction: ReactNode

            if (!isPaidPlanCode(plan.code)) {
              planAction = <p className="subscription-plan-card__free-label">{t('workspace.pricingModal.freePlan')}</p>
            } else {
              const paidPlanCode: BillingPaidPlanCode = plan.code
              planAction = (
                <button
                  type="button"
                  className="subscription-plan-card__action"
                  disabled={isSubmitting || isCurrentPlan}
                  onClick={() => {
                    onSelectPlan(paidPlanCode)
                  }}
                >
                  {isSubmitting
                    ? t('workspace.pricingModal.processing')
                    : isCurrentPlan
                      ? t('workspace.pricingModal.currentPlan')
                      : t('workspace.pricingModal.subscribe')}
                </button>
              )
            }

            return (
              <section
                key={plan.code}
                className={`subscription-plan-card${isCurrentPlan ? ' subscription-plan-card--current' : ''}`}
                aria-label={`${plan.name} ${priceLabel}`}
              >
                <header className="subscription-plan-card__header">
                  <h4>{plan.name}</h4>
                  <p>{priceLabel}</p>
                </header>
                <p className="subscription-plan-card__meta">
                  {plan.code === 'free'
                    ? t('workspace.pricingModal.freeQuota', {
                        count: plan.totalFreeStories ?? 2,
                      })
                    : t('workspace.pricingModal.dailyQuota', {
                        count: plan.dailyQuota ?? 0,
                      })}
                </p>
                {plan.code === 'free' ? null : (
                  <p className="subscription-plan-card__sub-meta">
                    {t('workspace.pricingModal.trialDays', {
                      count: plan.trialDays ?? 1,
                    })}
                  </p>
                )}
                {planAction}
              </section>
            )
          })}
        </div>
      </article>
    </div>
  )
}

export function SubscriptionPlansModal(props: SubscriptionPlansModalProps) {
  if (!props.isOpen) {
    return null
  }

  return <SubscriptionPlansModalLayer {...props} />
}
