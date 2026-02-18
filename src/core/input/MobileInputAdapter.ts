// ============================================================
// MobileInputAdapter — touch (bottom 40%, slide) + auto-fire
// Converts pixel coords to logical X via provided converter
// ============================================================

import type { IGameController } from './GameController'

/** Returns logical X when touch is in movement zone (bottom 40%), else null */
export type PixelToLogical = (clientX: number, clientY: number) => number | null

const AUTO_FIRE_INTERVAL_MS = 250

export class MobileInputAdapter {
  private cleanups: (() => void)[] = []
  private autoFireTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private controller: IGameController,
    private container: HTMLElement,
    private pixelToLogical: PixelToLogical,
  ) {
    this.attach()
    this.startAutoFire()
  }

  private attach(): void {
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        this.controller.pause()
        return
      }
      const t = e.touches[0]
      const x = this.pixelToLogical(t.clientX, t.clientY)
      if (x !== null) {
        e.preventDefault()
        this.controller.setTargetX(x)
      }
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      const t = e.touches[0]
      const x = this.pixelToLogical(t.clientX, t.clientY)
      if (x !== null) {
        e.preventDefault()
        this.controller.setTargetX(x)
      } else {
        this.controller.setTargetX(null)
      }
    }
    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        this.controller.setTargetX(null)
      }
    }
    this.container.addEventListener('touchstart', handleTouchStart, { passive: false })
    this.container.addEventListener('touchmove', handleTouchMove, { passive: false })
    this.container.addEventListener('touchend', handleTouchEnd, { passive: false })
    this.container.addEventListener('touchcancel', handleTouchEnd, { passive: false })
    this.cleanups.push(() => {
      this.container.removeEventListener('touchstart', handleTouchStart)
      this.container.removeEventListener('touchmove', handleTouchMove)
      this.container.removeEventListener('touchend', handleTouchEnd)
      this.container.removeEventListener('touchcancel', handleTouchEnd)
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
    this.controller.setTargetX(null)
    this.cleanups.forEach((f) => f())
    this.cleanups = []
  }
}
