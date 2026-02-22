import { useEffect } from 'react'

let bodyScrollLockCount = 0
let bodyOverflowBeforeScrollLock: string | null = null

export function acquireBodyScrollLock(): void {
  if (typeof document === 'undefined') {
    return
  }

  if (bodyScrollLockCount === 0) {
    bodyOverflowBeforeScrollLock = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }

  bodyScrollLockCount += 1
}

export function releaseBodyScrollLock(): void {
  if (typeof document === 'undefined' || bodyScrollLockCount === 0) {
    return
  }

  bodyScrollLockCount -= 1
  if (bodyScrollLockCount > 0) {
    return
  }

  document.body.style.overflow = bodyOverflowBeforeScrollLock ?? ''
  bodyOverflowBeforeScrollLock = null
}

export function useBodyScrollLock(): void {
  useEffect(() => {
    acquireBodyScrollLock()

    return () => {
      releaseBodyScrollLock()
    }
  }, [])
}
