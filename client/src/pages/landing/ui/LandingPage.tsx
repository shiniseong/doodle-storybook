import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import './LandingPage.css'

interface LandingPageProps {
  onStart: () => void
}

const STAR_POINTS = [
  { top: '10%', left: '10%', delay: '0s', size: '0.32rem' },
  { top: '20%', left: '80%', delay: '1s', size: '0.24rem' },
  { top: '40%', left: '15%', delay: '2s', size: '0.38rem' },
  { top: '60%', left: '85%', delay: '1.5s', size: '0.24rem' },
  { top: '70%', left: '20%', delay: '2.5s', size: '0.28rem' },
  { top: '30%', left: '70%', delay: '0.5s', size: '0.36rem' },
] as const

const STEP_CONFIG = [
  { key: 'draw', index: '01' },
  { key: 'write', index: '02' },
  { key: 'open', index: '03' },
] as const

const FEATURE_CONFIG = [
  { key: 'dream', image: '/assets/landing/feature-dream.png' },
  { key: 'prompting', image: '/assets/landing/feature-prompting.png' },
  { key: 'language', image: '/assets/landing/feature-language.png' },
] as const

const PRICING_PLAN_CONFIG = [
  { key: 'free', bullets: 2, featured: false },
  { key: 'monthly', bullets: 4, featured: true },
  { key: 'annual', bullets: 4, featured: false },
] as const

export function LandingPage({ onStart }: LandingPageProps) {
  const { t } = useTranslation()

  return (
    <section className="landing-page" aria-labelledby="landing-title">
      <div className="landing-page__stars" aria-hidden="true">
        {STAR_POINTS.map((star, index) => (
          <span
            key={`landing-star-${index}`}
            className="landing-page__star"
            style={{
              top: star.top,
              left: star.left,
              width: star.size,
              height: star.size,
              animationDelay: star.delay,
            }}
          />
        ))}
      </div>

      <main className="landing-page__content">
        <section className="landing-page__hero-section">
          <div className="landing-page__hero-copy">
            <h1 id="landing-title" className="landing-page__hero-title">
              <span className="landing-page__hero-title-brand">{t('common.appName')}</span>
              <span className="landing-page__hero-title-gradient">{t('landing.eyebrow')}</span>
            </h1>

            <p className="landing-page__hero-description">
              {t('landing.title')}
              <br />
              {t('landing.description')}
            </p>

            <button type="button" className="landing-page__magic-button" onClick={onStart}>
              <span>{t('landing.cta')}</span>
              <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>

            <div className="landing-page__steps-grid">
              {STEP_CONFIG.map((step) => (
                <article key={step.key} className="landing-page__magic-border">
                  <p className="landing-page__step-number">{step.index}</p>
                  <h2 className="landing-page__step-title">{t(`landing.steps.${step.key}.title`)}</h2>
                  <p className="landing-page__step-description">{t(`landing.steps.${step.key}.description`)}</p>
                </article>
              ))}
            </div>
          </div>

          <figure className="landing-page__hero-image-wrap">
            <img src="/assets/landing/hero.png" alt={t('landing.heroImageAlt')} className="landing-page__hero-image" />
          </figure>
        </section>

        <section className="landing-page__features-section" aria-labelledby="landing-features-title">
          <h2 id="landing-features-title" className="landing-page__section-title">
            {t('landing.featureSectionTitle')}
          </h2>

          {FEATURE_CONFIG.map((feature, index) => (
            <article
              key={feature.key}
              className={`landing-page__feature${index % 2 === 1 ? ' landing-page__feature--reverse' : ''}`}
            >
              <div className="landing-page__feature-copy">
                <p className="landing-page__feature-tag">{t(`landing.features.${feature.key}.tag`)}</p>
                <h3 className="landing-page__feature-title">{t(`landing.features.${feature.key}.title`)}</h3>
                <p className="landing-page__feature-description">{t(`landing.features.${feature.key}.description`)}</p>
                <ul className="landing-page__feature-bullets">
                  <li>{t(`landing.features.${feature.key}.bullet1`)}</li>
                  <li>{t(`landing.features.${feature.key}.bullet2`)}</li>
                  <li>{t(`landing.features.${feature.key}.bullet3`)}</li>
                </ul>
              </div>

              <figure className="landing-page__feature-image-wrap">
                <img src={feature.image} alt={t(`landing.features.${feature.key}.imageAlt`)} loading="lazy" />
              </figure>
            </article>
          ))}
        </section>

        <section className="landing-page__pricing-section" aria-labelledby="landing-pricing-title">
          <header className="landing-page__pricing-header">
            <h2 id="landing-pricing-title" className="landing-page__section-title">
              {t('landing.pricing.title')}
            </h2>
            <p>{t('landing.pricing.description')}</p>
          </header>

          <div className="landing-page__pricing-grid">
            {PRICING_PLAN_CONFIG.map((plan) => (
              <article
                key={plan.key}
                className={`landing-page__feature-card${plan.featured ? ' landing-page__feature-card--featured' : ''}`}
              >
                {plan.featured ? (
                  <p className="landing-page__pricing-badge">{t('landing.pricing.plans.monthly.badge')}</p>
                ) : null}

                <h3>{t(`landing.pricing.plans.${plan.key}.name`)}</h3>
                <p className="landing-page__pricing-subtitle">{t(`landing.pricing.plans.${plan.key}.subtitle`)}</p>

                <p className="landing-page__pricing-price">{t(`landing.pricing.plans.${plan.key}.price`)}</p>
                <p className="landing-page__pricing-cycle">{t(`landing.pricing.plans.${plan.key}.cycle`)}</p>

                <ul className="landing-page__pricing-bullets">
                  {Array.from({ length: plan.bullets }).map((_, bulletIndex) => (
                    <li key={`${plan.key}-bullet-${bulletIndex}`}>
                      {t(`landing.pricing.plans.${plan.key}.bullet${bulletIndex + 1}`)}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className={plan.featured ? 'landing-page__magic-button' : 'landing-page__magic-button-outline'}
                  onClick={onStart}
                >
                  {t(`landing.pricing.plans.${plan.key}.button`)}
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-page__final-cta" aria-label={t('landing.finalCtaTitle')}>
          <h2>{t('landing.finalCtaTitle')}</h2>
          <p>{t('landing.finalCtaDescription')}</p>
          <button
            type="button"
            className="landing-page__magic-button"
            onClick={onStart}
            aria-label={t('landing.finalCtaButtonAria')}
          >
            <span>{t('landing.cta')}</span>
            <ArrowRight size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </section>
      </main>
    </section>
  )
}
