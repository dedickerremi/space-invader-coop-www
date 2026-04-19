// ============================================================
// MobileInputAdapter — virtual joystick (anchor-based) + auto-fire
//   First finger contact = anchor. Finger left of anchor → moveLeft,
//   right → moveRight, inside dead-zone → stop. Ship moves at backend
//   speed (feels like keyboard, not drag-to-position).
//   Two-finger tap = pause.
// ============================================================

import type { IGameController } from './GameController'

const AUTO_FIRE_INTERVAL_MS = 250
/** CSS-pixel threshold around the anchor where movement is neutral. */
const DIR_DEADZONE_PX = 12

export class MobileInputAdapter {
  private cleanups: (() => void)[] = []
  private autoFireTimer: ReturnType<typeof setInterval> | null = null
  private anchorPx: number | null = null
  private currentDir: -1 | 0 | 1 = 0

  constructor(
    private controller: IGameController,
    private container: HTMLElement,
  ) {
    this.attach()
    this.startAutoFire()
  }

  private setDir(dir: -1 | 0 | 1): void {
    if (dir === this.currentDir) return
    this.currentDir = dir
    if (dir === -1) this.controller.moveLeft()
    else if (dir === 1) this.controller.moveRight()
    else this.controller.stop()
  }

  private attach(): void {
    const onStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        this.anchorPx = null
        this.setDir(0)
        this.controller.pause()
        return
      }
      this.anchorPx = e.touches[0].clientX
      this.setDir(0)
      e.preventDefault()
    }

    const onMove = (e: TouchEvent) => {
      if (this.anchorPx === null || e.touches.length === 0) return
      const dx = e.touches[0].clientX - this.anchorPx
      let dir: -1 | 0 | 1 = 0
      if (dx > DIR_DEADZONE_PX) dir = 1
      else if (dx < -DIR_DEADZONE_PX) dir = -1
      this.setDir(dir)
      e.preventDefault()
    }

    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        this.anchorPx = null
        this.setDir(0)
      }
    }

    this.container.addEventListener('touchstart', onStart, { passive: false })
    this.container.addEventListener('touchmove', onMove, { passive: false })
    this.container.addEventListener('touchend', onEnd, { passive: false })
    this.container.addEventListener('touchcancel', onEnd, { passive: false })
    this.cleanups.push(() => {
      this.container.removeEventListener('touchstart', onStart)
      this.container.removeEventListener('touchmove', onMove)
      this.container.removeEventListener('touchend', onEnd)
      this.container.removeEventListener('touchcancel', onEnd)
    })
  }

  private startAutoFire(): void {
    this.autoFireTimer = setInterval(() => {
      this.controller.fire()
    }, AUTO_FIRE_INTERVAL_MS)
  }

  destroy(): void {
    if (this.autoFireTimer !== null) {
      clearInterval(this.autoFireTimer)
      this.autoFireTimer = null
    }
    this.anchorPx = null
    this.setDir(0)
    this.cleanups.forEach((f) => f())
    this.cleanups = []
  }
}
