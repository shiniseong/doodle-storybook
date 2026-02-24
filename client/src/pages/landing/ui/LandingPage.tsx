import { ArrowRight, BookOpenText, Brain, Sparkles, WandSparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import './LandingPage.css'

interface LandingPageProps {
  onStart: () => void
}

const STAR_POINTS = [
  { top: '7%', left: '8%', size: '0.28rem', delay: '0s' },
  { top: '14%', left: '82%', size: '0.22rem', delay: '1.3s' },
  { top: '24%', left: '17%', size: '0.34rem', delay: '2.4s' },
  { top: '38%', left: '74%', size: '0.18rem', delay: '0.7s' },
  { top: '53%', left: '10%', size: '0.24rem', delay: '1.8s' },
  { top: '62%', left: '88%', size: '0.26rem', delay: '2.9s' },
  { top: '78%', left: '20%', size: '0.16rem', delay: '1.1s' },
  { top: '86%', left: '67%', size: '0.3rem', delay: '2.1s' },
] as const

const FEATURE_CONFIG = [
  {
    key: 'dream',
    imageSrc: '/assets/landing/feature-dream.png',
    icon: WandSparkles,
  },
  {
    key: 'prompting',
    imageSrc: '/assets/landing/feature-prompting.png',
    icon: Brain,
  },
  {
    key: 'language',
    imageSrc: '/assets/landing/feature-language.png',
    icon: BookOpenText,
  },
] as const

export function LandingPage({ onStart }: LandingPageProps) {
  const { t } = useTranslation()

  return (
    <section className="landing-page" aria-labelledby="landing-title">
      <div className="landing-page__backdrop" aria-hidden="true" />
      <span className="landing-page__aurora landing-page__aurora--one" aria-hidden="true" />
      <span className="landing-page__aurora landing-page__aurora--two" aria-hidden="true" />
      <div className="landing-page__starfield" aria-hidden="true">
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

      <main className="landing-page__main">
        <section className="landing-page__hero">
          <p className="landing-page__brand">{t('common.appName')}</p>
          <p className="landing-page__eyebrow">
            <Sparkles size={16} strokeWidth={2.4} aria-hidden="true" />
            <span>{t('landing.heroBadge')}</span>
          </p>
          <h1 id="landing-title">{t('landing.title')}</h1>
          <p className="landing-page__description">{t('landing.description')}</p>

          <button
            type="button"
            className="landing-page__cta"
            onClick={onStart}
            aria-label={t('landing.finalCtaButtonAria')}
          >
            <span>{t('landing.cta')}</span>
            <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>

          <div className="landing-page__hero-image-shell">
            <img className="landing-page__hero-image" src="/assets/landing/hero.png" alt={t('landing.heroImageAlt')} />
          </div>

          <div className="landing-page__stack">
            {FEATURE_CONFIG.map((feature, index) => (
              <article key={feature.key} className="landing-page__stack-card">
                <span className="landing-page__stack-index">{String(index + 1).padStart(2, '0')}</span>
                <h2 className="landing-page__stack-title">{t(`landing.features.${feature.key}.title`)}</h2>
                <p className="landing-page__stack-description">{t(`landing.features.${feature.key}.description`)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-page__feature-section" aria-labelledby="landing-feature-title">
          <p className="landing-page__section-label">{t('landing.featureSectionLabel')}</p>
          <h2 id="landing-feature-title" className="landing-page__section-title">
            {t('landing.featureSectionTitle')}
          </h2>

          <div className="landing-page__feature-list">
            {FEATURE_CONFIG.map((feature, index) => {
              const Icon = feature.icon

              return (
                <article
                  key={`${feature.key}-detail`}
                  className={`landing-page__feature${index % 2 === 1 ? ' landing-page__feature--reverse' : ''}`}
                >
                  <div className="landing-page__feature-copy">
                    <p className="landing-page__feature-tag">
                      <Icon size={16} strokeWidth={2.4} aria-hidden="true" />
                      <span>{t(`landing.features.${feature.key}.tag`)}</span>
                    </p>
                    <h3 className="landing-page__feature-title">{t(`landing.features.${feature.key}.title`)}</h3>
                    <p className="landing-page__feature-description">{t(`landing.features.${feature.key}.description`)}</p>
                    <ul className="landing-page__feature-bullets">
                      <li>{t(`landing.features.${feature.key}.bullet1`)}</li>
                      <li>{t(`landing.features.${feature.key}.bullet2`)}</li>
                      <li>{t(`landing.features.${feature.key}.bullet3`)}</li>
                    </ul>
                  </div>
                  <figure className="landing-page__feature-image-shell">
                    <img src={feature.imageSrc} alt={t(`landing.features.${feature.key}.imageAlt`)} loading="lazy" />
                  </figure>
                </article>
              )
            })}
          </div>
        </section>

        <section className="landing-page__final-cta" aria-label={t('landing.finalCtaTitle')}>
          <h2>{t('landing.finalCtaTitle')}</h2>
          <p>{t('landing.finalCtaDescription')}</p>
          <button type="button" className="landing-page__cta" onClick={onStart}>
            <span>{t('landing.cta')}</span>
            <ArrowRight size={18} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </section>
      </main>
    </section>
  )
}
