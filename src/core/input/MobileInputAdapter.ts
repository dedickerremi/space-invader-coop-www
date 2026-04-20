// ============================================================
// MobileInputAdapter — virtual joystick (anchor-based) + auto-fire
//   First finger contact = anchor. Movement vector from anchor drives
//   dirX and dirY independently (8-direction feel). A circular dead-zone
//   keeps jitter on one axis from leaking into the other.
//   Two-finger tap = pause.
// ============================================================

import type { IGameController } from './GameController'

const AUTO_FIRE_INTERVAL_MS = 250
/** CSS-pixel radius around the anchor where movement is neutral. */
const DEADZONE_PX = 12
/** Secondary-axis threshold: an axis only fires if its |delta| exceeds
 *  this fraction of the dominant axis. Avoids a near-horizontal drag
 *  registering as diagonal. */
const AXIS_RATIO = 0.4

export class MobileInputAdapter {
  private cleanups: (() => void)[] = []
  private autoFireTimer: ReturnType<typeof setInterval> | null = null
  private anchorX: number | null = null
  private anchorY: number | null = null
  private currentDirX: -1 | 0 | 1 = 0
  private currentDirY: -1 | 0 | 1 = 0

  constructor(
    private controller: IGameController,
    private container: HTMLElement,
  ) {
    this.attach()
    this.startAutoFire()
  }

  private setDirX(dir: -1 | 0 | 1): void {
    if (dir === this.currentDirX) return
    this.currentDirX = dir
    if (dir === -1) this.controller.moveLeft()
    else if (dir === 1) this.controller.moveRight()
    else this.controller.stop()
  }

  private setDirY(dir: -1 | 0 | 1): void {
    if (dir === this.currentDirY) return
    this.currentDirY = dir
    if (dir === -1) this.controller.moveUp()
    else if (dir === 1) this.controller.moveDown()
    else this.controller.stopY()
  }

  private updateFromDelta(dx: number, dy: number): void {
    const dist = Math.hypot(dx, dy)
    if (dist < DEADZONE_PX) {
      this.setDirX(0)
      this.setDirY(0)
      return
    }
    const ax = Math.abs(dx)
    const ay = Math.abs(dy)
    const dominant = Math.max(ax, ay)
    const dirX: -1 | 0 | 1 = ax >= dominant * AXIS_RATIO ? (dx < 0 ? -1 : 1) : 0
    const dirY: -1 | 0 | 1 = ay >= dominant * AXIS_RATIO ? (dy < 0 ? -1 : 1) : 0
    this.setDirX(dirX)
    this.setDirY(dirY)
  }

  private attach(): void {
    const onStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        this.anchorX = null
        this.anchorY = null
        this.setDirX(0)
        this.setDirY(0)
        this.controller.pause()
        return
      }
      this.anchorX = e.touches[0].clientX
      this.anchorY = e.touches[0].clientY
      this.setDirX(0)
      this.setDirY(0)
      e.preventDefault()
    }

    const onMove = (e: TouchEvent) => {
      if (this.anchorX === null || this.anchorY === null || e.touches.length === 0) return
      const dx = e.touches[0].clientX - this.anchorX
      const dy = e.touches[0].clientY - this.anchorY
      this.updateFromDelta(dx, dy)
      e.preventDefault()
    }

    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        this.anchorX = null
        this.anchorY = null
        this.setDirX(0)
        this.setDirY(0)
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
    this.anchorX = null
    this.anchorY = null
    this.setDirX(0)
    this.setDirY(0)
    this.cleanups.forEach((f) => f())
    this.cleanups = []
  }
}
