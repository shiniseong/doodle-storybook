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
  fairyReactX: number
  fairyReactY: number
}

interface FairyPhysicsState {
  x: number
  y: number
  velocityX: number
  velocityY: number
}

interface PointerMotionSnapshot {
  clientX: number
  clientY: number
  timestampMs: number
  velocityX: number
  velocityY: number
}

const HERO_MAX_TILT_DEG = 4
const INTERACTION_EASE = 0.17
const INTERACTION_EPSILON = 0.015
const POINTER_STATE_KEYS = ['heroTiltX', 'heroTiltY', 'pointerX', 'pointerY', 'parallaxX', 'parallaxY'] as const
const ORB_PARALLAX_MAX_PX = 24
const FAIRY_GENTLE_SPEED_THRESHOLD = 0.38
const FAIRY_GENTLE_ACCELERATION_THRESHOLD = 0.004
const FAIRY_GENTLE_MAX_OFFSET_X = 13
const FAIRY_GENTLE_MAX_OFFSET_Y = 10
const FAIRY_HIT_SPEED_THRESHOLD = 1.2
const FAIRY_HIT_ACCELERATION_THRESHOLD = 0.016
const FAIRY_HIT_IMPULSE_MIN = 24
const FAIRY_HIT_IMPULSE_MAX = 92
const FAIRY_HIT_PUSH_DISTANCE_MIN = 14
const FAIRY_HIT_PUSH_DISTANCE_MAX = 52
const FAIRY_HIT_CENTER_PASS_RADIUS_RATIO = 0.26
const FAIRY_HIT_COOLDOWN_MS = 280
const FAIRY_HIT_RECOVERY_MS = 820
const FAIRY_SPRING_STIFFNESS = 0.17
const FAIRY_DAMPING = 0.84
const FAIRY_RECOVERY_SPRING_STIFFNESS = 0.034
const FAIRY_RECOVERY_DAMPING = 0.955
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
  const fairyPhysicsRef = useRef<FairyPhysicsState>({
    x: 0,
    y: 0,
    velocityX: 0,
    velocityY: 0,
  })
  const fairyTargetOffsetRef = useRef({ x: 0, y: 0 })
  const pointerMotionRef = useRef<PointerMotionSnapshot | null>(null)
  const fairyHitCooldownUntilMsRef = useRef(0)
  const fairyHitRecoveryUntilMsRef = useRef(0)

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
      const fairyTargetOffset = fairyTargetOffsetRef.current
      const nowMs = performance.now()
      const isRecoveringFromHit = nowMs < fairyHitRecoveryUntilMsRef.current
      const springStiffness = isRecoveringFromHit ? FAIRY_RECOVERY_SPRING_STIFFNESS : FAIRY_SPRING_STIFFNESS
      const damping = isRecoveringFromHit ? FAIRY_RECOVERY_DAMPING : FAIRY_DAMPING
      const fairyTargetX = isRecoveringFromHit ? 0 : fairyTargetOffset.x
      const fairyTargetY = isRecoveringFromHit ? 0 : fairyTargetOffset.y
      const fairyAccelerationX = (fairyTargetX - fairyPhysics.x) * springStiffness
      const fairyAccelerationY = (fairyTargetY - fairyPhysics.y) * springStiffness
      fairyPhysics.velocityX = (fairyPhysics.velocityX + fairyAccelerationX) * damping
      fairyPhysics.velocityY = (fairyPhysics.velocityY + fairyAccelerationY) * damping
      fairyPhysics.x = clamp(fairyPhysics.x + fairyPhysics.velocityX, -FAIRY_MAX_OFFSET_X, FAIRY_MAX_OFFSET_X)
      fairyPhysics.y = clamp(fairyPhysics.y + fairyPhysics.velocityY, -FAIRY_MAX_OFFSET_Y, FAIRY_MAX_OFFSET_Y)

      nextPointerState.fairyReactX = fairyPhysics.x
      nextPointerState.fairyReactY = fairyPhysics.y

      const isFairyAnimating =
        Math.abs(fairyTargetOffset.x - fairyPhysics.x) > FAIRY_REACTION_EPSILON ||
        Math.abs(fairyTargetOffset.y - fairyPhysics.y) > FAIRY_REACTION_EPSILON ||
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

  const updateFairyInteraction = (clientX: number, clientY: number, eventTimestampMs: number) => {
    const fairyElement = fairyRef.current
    if (!fairyElement) {
      return
    }

    const timestampMs = Number.isFinite(eventTimestampMs) ? eventTimestampMs : performance.now()
    const previousMotionSnapshot = pointerMotionRef.current
    pointerMotionRef.current = {
      clientX,
      clientY,
      timestampMs,
      velocityX: previousMotionSnapshot?.velocityX ?? 0,
      velocityY: previousMotionSnapshot?.velocityY ?? 0,
    }

    if (!previousMotionSnapshot) {
      return
    }

    const deltaTimeMs = Math.max(1, timestampMs - previousMotionSnapshot.timestampMs)
    const velocityX = (clientX - previousMotionSnapshot.clientX) / deltaTimeMs
    const velocityY = (clientY - previousMotionSnapshot.clientY) / deltaTimeMs
    const speed = Math.hypot(velocityX, velocityY)
    const accelerationX = (velocityX - previousMotionSnapshot.velocityX) / deltaTimeMs
    const accelerationY = (velocityY - previousMotionSnapshot.velocityY) / deltaTimeMs
    const accelerationMagnitude = Math.hypot(accelerationX, accelerationY)

    pointerMotionRef.current = {
      clientX,
      clientY,
      timestampMs,
      velocityX,
      velocityY,
    }

    const fairyBounds = fairyElement.getBoundingClientRect()
    const fairyCenterX = fairyBounds.left + fairyBounds.width / 2
    const fairyCenterY = fairyBounds.top + fairyBounds.height / 2
    const relativePointerXFromFairy = clientX - fairyCenterX
    const relativePointerYFromFairy = clientY - fairyCenterY
    const distanceFromFairy = Math.hypot(relativePointerXFromFairy, relativePointerYFromFairy)
    const previousRelativeXFromFairy = previousMotionSnapshot.clientX - fairyCenterX
    const previousRelativeYFromFairy = previousMotionSnapshot.clientY - fairyCenterY
    const previousDistanceFromFairy = Math.hypot(previousRelativeXFromFairy, previousRelativeYFromFairy)
    const interactionRadius = Math.max(fairyBounds.width, fairyBounds.height) * 0.82

    const segmentDeltaX = clientX - previousMotionSnapshot.clientX
    const segmentDeltaY = clientY - previousMotionSnapshot.clientY
    const segmentLengthSquared = segmentDeltaX * segmentDeltaX + segmentDeltaY * segmentDeltaY
    const hasValidSegment = segmentLengthSquared > 0.0001
    const rawCenterProjection = hasValidSegment
      ? ((fairyCenterX - previousMotionSnapshot.clientX) * segmentDeltaX +
          (fairyCenterY - previousMotionSnapshot.clientY) * segmentDeltaY) /
        segmentLengthSquared
      : 0
    const clampedCenterProjection = clamp(rawCenterProjection, 0, 1)
    const closestPointX = hasValidSegment
      ? previousMotionSnapshot.clientX + segmentDeltaX * clampedCenterProjection
      : clientX
    const closestPointY = hasValidSegment
      ? previousMotionSnapshot.clientY + segmentDeltaY * clampedCenterProjection
      : clientY
    const closestDistanceFromFairy = Math.hypot(closestPointX - fairyCenterX, closestPointY - fairyCenterY)
    const isPointerInsideNow = distanceFromFairy <= interactionRadius
    const wasPointerInside = previousDistanceFromFairy <= interactionRadius
    const didSweepTouchFairy = hasValidSegment && closestDistanceFromFairy <= interactionRadius
    const isInteractionReachable = isPointerInsideNow || wasPointerInside || didSweepTouchFairy

    if (!isInteractionReachable) {
      fairyTargetOffsetRef.current = { x: 0, y: 0 }
      return
    }

    const isRecoveringFromHit = timestampMs < fairyHitRecoveryUntilMsRef.current

    if (!isRecoveringFromHit && speed <= FAIRY_GENTLE_SPEED_THRESHOLD && accelerationMagnitude <= FAIRY_GENTLE_ACCELERATION_THRESHOLD) {
      fairyTargetOffsetRef.current = {
        x: clamp(relativePointerXFromFairy * 0.22, -FAIRY_GENTLE_MAX_OFFSET_X, FAIRY_GENTLE_MAX_OFFSET_X),
        y: clamp(relativePointerYFromFairy * 0.22, -FAIRY_GENTLE_MAX_OFFSET_Y, FAIRY_GENTLE_MAX_OFFSET_Y),
      }
      return
    }

    fairyTargetOffsetRef.current = { x: 0, y: 0 }

    if (speed < FAIRY_HIT_SPEED_THRESHOLD || accelerationMagnitude < FAIRY_HIT_ACCELERATION_THRESHOLD) {
      return
    }

    if (timestampMs < fairyHitCooldownUntilMsRef.current) {
      return
    }

    const isApproachingCenter =
      hasValidSegment &&
      (fairyCenterX - previousMotionSnapshot.clientX) * segmentDeltaX +
        (fairyCenterY - previousMotionSnapshot.clientY) * segmentDeltaY >
        0

    if (!isApproachingCenter) {
      return
    }

    const didPassCenterOnSweep =
      hasValidSegment &&
      rawCenterProjection >= 0 &&
      rawCenterProjection <= 1 &&
      closestDistanceFromFairy <= interactionRadius * FAIRY_HIT_CENTER_PASS_RADIUS_RATIO

    const depthRatio = clamp(
      1 - (didPassCenterOnSweep ? 0 : closestDistanceFromFairy) / interactionRadius,
      0,
      1,
    )
    const centerPassBonus = didPassCenterOnSweep ? 1.4 : 0
    const impactMultiplier = 1 + depthRatio * 0.9 + centerPassBonus
    const segmentLength = hasValidSegment ? Math.sqrt(segmentLengthSquared) : 0
    const movementMagnitude = Math.max(segmentLength, Math.hypot(velocityX, velocityY))

    if (movementMagnitude <= 0.0001) {
      return
    }

    const impactDirectionX =
      segmentLength > 0.0001 ? segmentDeltaX / segmentLength : velocityX / movementMagnitude
    const impactDirectionY =
      segmentLength > 0.0001 ? segmentDeltaY / segmentLength : velocityY / movementMagnitude

    const rawImpulseStrength = (speed * 14 + accelerationMagnitude * 900) * impactMultiplier
    const impulseStrength = clamp(rawImpulseStrength, FAIRY_HIT_IMPULSE_MIN, FAIRY_HIT_IMPULSE_MAX)
    const rawPushDistance =
      (speed * 8.5 + accelerationMagnitude * 720 + movementMagnitude * 0.32) *
      (0.9 + depthRatio * 1.4 + centerPassBonus * 0.8)
    const pushDistance = clamp(rawPushDistance, FAIRY_HIT_PUSH_DISTANCE_MIN, FAIRY_HIT_PUSH_DISTANCE_MAX)
    const fairyPhysics = fairyPhysicsRef.current
    fairyPhysics.x = clamp(fairyPhysics.x - impactDirectionX * pushDistance, -FAIRY_MAX_OFFSET_X, FAIRY_MAX_OFFSET_X)
    fairyPhysics.y = clamp(fairyPhysics.y - impactDirectionY * pushDistance, -FAIRY_MAX_OFFSET_Y, FAIRY_MAX_OFFSET_Y)
    fairyPhysics.velocityX += -impactDirectionX * impulseStrength
    fairyPhysics.velocityY += -impactDirectionY * impulseStrength
    fairyHitCooldownUntilMsRef.current = timestampMs + FAIRY_HIT_COOLDOWN_MS
    fairyHitRecoveryUntilMsRef.current = timestampMs + FAIRY_HIT_RECOVERY_MS
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
          updateFairyInteraction(event.clientX, event.clientY, event.timeStamp)
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
          pointerMotionRef.current = null
          fairyTargetOffsetRef.current = { x: 0, y: 0 }
          fairyHitRecoveryUntilMsRef.current = 0
          requestInteractionAnimationFrame()
        }}
      >
        <div className="landing-page__hero-wrap">
          <span ref={fairyRef} className="landing-page__fairy" aria-hidden="true">
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
