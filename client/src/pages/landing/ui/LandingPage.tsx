import { useEffect, useRef, useState } from 'react'
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
  fairyReactX: number
  fairyReactY: number
}

interface FairyPhysicsState {
  x: number
  y: number
  velocityX: number
  velocityY: number
}

const HERO_MAX_TILT_DEG = 4
const INTERACTION_EASE = 0.17
const INTERACTION_EPSILON = 0.015
const POINTER_STATE_KEYS = ['heroTiltX', 'heroTiltY', 'pointerX', 'pointerY', 'parallaxX', 'parallaxY'] as const
const ORB_PARALLAX_MAX_PX = 24
const FAIRY_DRAG_MAX_DISTANCE_PX = 124
const FAIRY_SPRING_STIFFNESS = 0.12
const FAIRY_DAMPING = 0.86
const FAIRY_RELEASE_BOOST = 0.24
const FAIRY_RELEASE_SPEED_MAX = 38
const FAIRY_REACTION_EPSILON = 0.05
const FAIRY_MAX_OFFSET_X = 118
const FAIRY_MAX_OFFSET_Y = 90

const INITIAL_POINTER_STATE: PointerState = {
  heroTiltX: 0,
  heroTiltY: 0,
  pointerX: 50,
  pointerY: 50,
  parallaxX: 0,
  parallaxY: 0,
  fairyReactX: 0,
  fairyReactY: 0,
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

function clampFairyDragOffset(offsetX: number, offsetY: number): { x: number; y: number; distance: number } {
  const distance = Math.hypot(offsetX, offsetY)
  if (distance <= FAIRY_DRAG_MAX_DISTANCE_PX) {
    return {
      x: offsetX,
      y: offsetY,
      distance,
    }
  }

  const scale = FAIRY_DRAG_MAX_DISTANCE_PX / Math.max(distance, 0.0001)
  return {
    x: offsetX * scale,
    y: offsetY * scale,
    distance: FAIRY_DRAG_MAX_DISTANCE_PX,
  }
}

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
  container.style.setProperty('--landing-fairy-react-x', `${pointerState.fairyReactX.toFixed(2)}px`)
  container.style.setProperty('--landing-fairy-react-y', `${pointerState.fairyReactY.toFixed(2)}px`)
}

export function LandingPage({ onStart }: LandingPageProps) {
  const { t } = useTranslation()
  const sectionRef = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLElement | null>(null)
  const fairyRef = useRef<HTMLSpanElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const currentPointerStateRef = useRef<PointerState>(INITIAL_POINTER_STATE)
  const targetPointerStateRef = useRef<PointerState>(INITIAL_POINTER_STATE)
  const [isFairyDragging, setIsFairyDragging] = useState(false)
  const fairyPhysicsRef = useRef<FairyPhysicsState>({
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
  })
  const isFairyDraggingRef = useRef(false)
  const activeFairyPointerIdRef = useRef<number | null>(null)
  const fairyDragStartPointerRef = useRef({ x: 0, y: 0 })
  const fairyDragStartOffsetRef = useRef({ x: 0, y: 0 })

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

      const fairyPhysics = fairyPhysicsRef.current
      if (!isFairyDraggingRef.current) {
        const fairyAccelerationX = -fairyPhysics.x * FAIRY_SPRING_STIFFNESS
        const fairyAccelerationY = -fairyPhysics.y * FAIRY_SPRING_STIFFNESS
        fairyPhysics.velocityX = (fairyPhysics.velocityX + fairyAccelerationX) * FAIRY_DAMPING
        fairyPhysics.velocityY = (fairyPhysics.velocityY + fairyAccelerationY) * FAIRY_DAMPING
        fairyPhysics.x = clamp(fairyPhysics.x + fairyPhysics.velocityX, -FAIRY_MAX_OFFSET_X, FAIRY_MAX_OFFSET_X)
        fairyPhysics.y = clamp(fairyPhysics.y + fairyPhysics.velocityY, -FAIRY_MAX_OFFSET_Y, FAIRY_MAX_OFFSET_Y)

        if (Math.abs(fairyPhysics.x) <= FAIRY_REACTION_EPSILON && Math.abs(fairyPhysics.velocityX) <= FAIRY_REACTION_EPSILON) {
          fairyPhysics.x = 0
          fairyPhysics.velocityX = 0
        }

        if (Math.abs(fairyPhysics.y) <= FAIRY_REACTION_EPSILON && Math.abs(fairyPhysics.velocityY) <= FAIRY_REACTION_EPSILON) {
          fairyPhysics.y = 0
          fairyPhysics.velocityY = 0
        }
      }

      nextPointerState.fairyReactX = fairyPhysics.x
      nextPointerState.fairyReactY = fairyPhysics.y

      const isFairyAnimating =
        Math.abs(fairyPhysics.velocityX) > FAIRY_REACTION_EPSILON ||
        Math.abs(fairyPhysics.velocityY) > FAIRY_REACTION_EPSILON
      if (isFairyAnimating) {
        hasPendingDelta = true
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

  const applyFairyDragPosition = (pointerClientX: number, pointerClientY: number) => {
    const dragDeltaX = pointerClientX - fairyDragStartPointerRef.current.x
    const dragDeltaY = pointerClientY - fairyDragStartPointerRef.current.y
    const unclampedOffsetX = fairyDragStartOffsetRef.current.x + dragDeltaX
    const unclampedOffsetY = fairyDragStartOffsetRef.current.y + dragDeltaY
    const clampedOffset = clampFairyDragOffset(unclampedOffsetX, unclampedOffsetY)
    const fairyPhysics = fairyPhysicsRef.current

    fairyPhysics.x = clamp(clampedOffset.x, -FAIRY_MAX_OFFSET_X, FAIRY_MAX_OFFSET_X)
    fairyPhysics.y = clamp(clampedOffset.y, -FAIRY_MAX_OFFSET_Y, FAIRY_MAX_OFFSET_Y)
    fairyPhysics.velocityX = 0
    fairyPhysics.velocityY = 0
    requestInteractionAnimationFrame()
  }

  const stopFairyDragging = (pointerId: number, withReleaseBoost: boolean) => {
    if (activeFairyPointerIdRef.current !== pointerId) {
      return
    }

    const fairyElement = fairyRef.current
    if (
      fairyElement &&
      typeof fairyElement.hasPointerCapture === 'function' &&
      fairyElement.hasPointerCapture(pointerId) &&
      typeof fairyElement.releasePointerCapture === 'function'
    ) {
      fairyElement.releasePointerCapture(pointerId)
    }

    isFairyDraggingRef.current = false
    activeFairyPointerIdRef.current = null
    setIsFairyDragging(false)

    if (!withReleaseBoost) {
      requestInteractionAnimationFrame()
      return
    }

    const fairyPhysics = fairyPhysicsRef.current
    const pullDistance = Math.hypot(fairyPhysics.x, fairyPhysics.y)
    if (pullDistance <= 1) {
      requestInteractionAnimationFrame()
      return
    }

    const pullRatio = clamp(pullDistance / FAIRY_DRAG_MAX_DISTANCE_PX, 0, 1)
    const releaseSpeed = clamp(
      pullDistance * FAIRY_RELEASE_BOOST * (1 + pullRatio * 0.65),
      0,
      FAIRY_RELEASE_SPEED_MAX,
    )

    const towardCenterX = -fairyPhysics.x / pullDistance
    const towardCenterY = -fairyPhysics.y / pullDistance
    fairyPhysics.velocityX += towardCenterX * releaseSpeed
    fairyPhysics.velocityY += towardCenterY * releaseSpeed
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
        <div className="landing-page__hero-wrap">
          <span
            ref={fairyRef}
            className={`landing-page__fairy${isFairyDragging ? ' landing-page__fairy--dragging' : ''}`}
            aria-hidden="true"
            onPointerDown={(event) => {
              if (event.pointerType === 'mouse' && event.button !== 0) {
                return
              }

              if (isFairyDraggingRef.current) {
                return
              }

              event.preventDefault()
              event.stopPropagation()

              isFairyDraggingRef.current = true
              activeFairyPointerIdRef.current = event.pointerId
              setIsFairyDragging(true)
              fairyDragStartPointerRef.current = {
                x: event.clientX,
                y: event.clientY,
              }
              fairyDragStartOffsetRef.current = {
                x: fairyPhysicsRef.current.x,
                y: fairyPhysicsRef.current.y,
              }
              event.currentTarget.setPointerCapture(event.pointerId)
              applyFairyDragPosition(event.clientX, event.clientY)
            }}
            onPointerMove={(event) => {
              if (!isFairyDraggingRef.current || activeFairyPointerIdRef.current !== event.pointerId) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              applyFairyDragPosition(event.clientX, event.clientY)
            }}
            onPointerUp={(event) => {
              if (!isFairyDraggingRef.current || activeFairyPointerIdRef.current !== event.pointerId) {
                return
              }

              event.preventDefault()
              event.stopPropagation()
              applyFairyDragPosition(event.clientX, event.clientY)
              stopFairyDragging(event.pointerId, true)
            }}
            onPointerCancel={(event) => {
              stopFairyDragging(event.pointerId, false)
            }}
            onLostPointerCapture={(event) => {
              stopFairyDragging(event.pointerId, false)
            }}
          >
            <img src="/assets/drawing-fairy-detail-logo.png" alt="" />
          </span>
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
                fairyReactX: currentTargetState.fairyReactX,
                fairyReactY: currentTargetState.fairyReactY,
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
                fairyReactX: currentTargetState.fairyReactX,
                fairyReactY: currentTargetState.fairyReactY,
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
        </div>
      </main>
    </section>
  )
}
