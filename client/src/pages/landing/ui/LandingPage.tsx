import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import './LandingPage.css'

interface LandingPageProps {
  onStart: () => void
}

interface PointerState {
  heroTiltX: number
  heroTiltY: number
  pointerX: number
  pointerY: number
  parallaxX: number
  parallaxY: number
}

const HERO_MAX_TILT_DEG = 4
const INTERACTION_EASE = 0.17
const INTERACTION_EPSILON = 0.015
const POINTER_STATE_KEYS = ['heroTiltX', 'heroTiltY', 'pointerX', 'pointerY', 'parallaxX', 'parallaxY'] as const
const ORB_PARALLAX_MAX_PX = 24

const INITIAL_POINTER_STATE: PointerState = {
  heroTiltX: 0,
  heroTiltY: 0,
  pointerX: 50,
  pointerY: 50,
  parallaxX: 0,
  parallaxY: 0,
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const applyLandingInteractionVars = (container: HTMLElement | null, pointerState: PointerState) => {
  if (!container) {
    return
  }

  container.style.setProperty('--landing-hero-tilt-x', `${pointerState.heroTiltX.toFixed(2)}deg`)
  container.style.setProperty('--landing-hero-tilt-y', `${pointerState.heroTiltY.toFixed(2)}deg`)
  container.style.setProperty('--landing-pointer-x', `${pointerState.pointerX.toFixed(2)}%`)
  container.style.setProperty('--landing-pointer-y', `${pointerState.pointerY.toFixed(2)}%`)
  container.style.setProperty('--landing-parallax-x', `${pointerState.parallaxX.toFixed(2)}px`)
  container.style.setProperty('--landing-parallax-y', `${pointerState.parallaxY.toFixed(2)}px`)
}

export function LandingPage({ onStart }: LandingPageProps) {
  const { t } = useTranslation()
  const sectionRef = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const currentPointerStateRef = useRef<PointerState>(INITIAL_POINTER_STATE)
  const targetPointerStateRef = useRef<PointerState>(INITIAL_POINTER_STATE)

  const requestInteractionAnimationFrame = () => {
    if (animationFrameRef.current !== null) {
      return
    }

    const runFrame = () => {
      const currentPointerState = currentPointerStateRef.current
      const targetPointerState = targetPointerStateRef.current
      const nextPointerState = { ...currentPointerState }
      let hasPendingDelta = false

      for (const key of POINTER_STATE_KEYS) {
        const delta = targetPointerState[key] - currentPointerState[key]
        if (Math.abs(delta) > INTERACTION_EPSILON) {
          nextPointerState[key] = currentPointerState[key] + delta * INTERACTION_EASE
          hasPendingDelta = true
          continue
        }

        nextPointerState[key] = targetPointerState[key]
      }

      currentPointerStateRef.current = nextPointerState
      applyLandingInteractionVars(sectionRef.current, nextPointerState)

      if (hasPendingDelta) {
        animationFrameRef.current = window.requestAnimationFrame(runFrame)
        return
      }

      animationFrameRef.current = null
    }

    animationFrameRef.current = window.requestAnimationFrame(runFrame)
  }

  const setPointerTarget = (nextPointerState: PointerState) => {
    targetPointerStateRef.current = nextPointerState
    requestInteractionAnimationFrame()
  }

  useEffect(() => {
    applyLandingInteractionVars(sectionRef.current, INITIAL_POINTER_STATE)

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  return (
    <section ref={sectionRef} className="landing-page" aria-labelledby="landing-title">
      <div className="landing-page__ambient" aria-hidden="true" />
      <div className="landing-page__ambient-grid" aria-hidden="true" />
      <span className="landing-page__orb landing-page__orb--sunrise" aria-hidden="true" />
      <span className="landing-page__orb landing-page__orb--mint" aria-hidden="true" />
      <span className="landing-page__orb landing-page__orb--sky" aria-hidden="true" />

      <main
        ref={stageRef}
        className="landing-page__stage"
        onPointerMove={(event) => {
          if (event.pointerType !== 'mouse') {
            return
          }

          const bounds = event.currentTarget.getBoundingClientRect()
          const relativeX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1)
          const relativeY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1)

          targetPointerStateRef.current = {
            ...targetPointerStateRef.current,
            parallaxX: (relativeX - 0.5) * ORB_PARALLAX_MAX_PX,
            parallaxY: (relativeY - 0.5) * ORB_PARALLAX_MAX_PX,
          }
          requestInteractionAnimationFrame()
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'mouse') {
            return
          }

          targetPointerStateRef.current = {
            ...targetPointerStateRef.current,
            parallaxX: 0,
            parallaxY: 0,
          }
          requestInteractionAnimationFrame()
        }}
      >
        <article
          className="landing-page__hero"
          onPointerMove={(event) => {
            if (event.pointerType !== 'mouse') {
              return
            }

            const bounds = event.currentTarget.getBoundingClientRect()
            const relativeX = clamp((event.clientX - bounds.left) / bounds.width, 0, 1)
            const relativeY = clamp((event.clientY - bounds.top) / bounds.height, 0, 1)

            const currentTargetState = targetPointerStateRef.current
            setPointerTarget({
              heroTiltX: (0.5 - relativeY) * HERO_MAX_TILT_DEG,
              heroTiltY: (relativeX - 0.5) * HERO_MAX_TILT_DEG,
              pointerX: relativeX * 100,
              pointerY: relativeY * 100,
              parallaxX: currentTargetState.parallaxX,
              parallaxY: currentTargetState.parallaxY,
            })
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== 'mouse') {
              return
            }

            const currentTargetState = targetPointerStateRef.current
            setPointerTarget({
              ...INITIAL_POINTER_STATE,
              parallaxX: currentTargetState.parallaxX,
              parallaxY: currentTargetState.parallaxY,
            })
          }}
        >
          <p className="landing-page__brand">{t('common.appName')}</p>
          <p className="landing-page__eyebrow">
            <Sparkles size={16} strokeWidth={2.2} aria-hidden="true" />
            <span>{t('landing.eyebrow')}</span>
          </p>
          <h1 id="landing-title">{t('landing.title')}</h1>
          <p className="landing-page__description">{t('landing.description')}</p>
          <div className="landing-page__stack" aria-hidden="true">
            <article className="landing-page__stack-card landing-page__stack-card--draw">
              <span className="landing-page__stack-index">01</span>
              <p>{t('landing.stepDraw')}</p>
            </article>
            <article className="landing-page__stack-card landing-page__stack-card--write">
              <span className="landing-page__stack-index">02</span>
              <p>{t('landing.stepWrite')}</p>
            </article>
            <article className="landing-page__stack-card landing-page__stack-card--open">
              <span className="landing-page__stack-index">03</span>
              <p>{t('landing.stepOpen')}</p>
            </article>
          </div>
          <button type="button" className="landing-page__cta" onClick={onStart}>
            {t('landing.cta')}
          </button>
        </article>
      </main>
    </section>
  )
}
