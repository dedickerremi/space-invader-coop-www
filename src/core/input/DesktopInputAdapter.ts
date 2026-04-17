// ============================================================
// DesktopInputAdapter — keyboard → GameController commands
// ============================================================

import type { IGameController } from './GameController'

const FIRE_INTERVAL_MS = 200 // fire rate when Space is held

export class DesktopInputAdapter {
  private cleanups: (() => void)[] = []
  private leftPressed = false
  private rightPressed = false
  private upPressed = false
  private downPressed = false
  private spacePressed = false
  private fireTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private controller: IGameController,
    private element: Window | HTMLElement = window,
  ) {
    this.attach()
  }

  private startFiring(): void {
    if (this.fireTimer) return
    this.controller.fire()
    this.fireTimer = setInterval(() => this.controller.fire(), FIRE_INTERVAL_MS)
  }

  private stopFiring(): void {
    if (this.fireTimer) {
      clearInterval(this.fireTimer)
      this.fireTimer = null
    }
  }

  private isLeft(key: string): boolean {
    return key === 'ArrowLeft' || key === 'a' || key === 'A' || key === 'q' || key === 'Q'
  }
  private isRight(key: string): boolean {
    return key === 'ArrowRight' || key === 'd' || key === 'D'
  }
  private isUp(key: string): boolean {
    return key === 'ArrowUp' || key === 'w' || key === 'W' || key === 'z' || key === 'Z'
  }
  private isDown(key: string): boolean {
    return key === 'ArrowDown' || key === 's' || key === 'S'
  }

  private attach(): void {
    const el = this.element as Window & { addEventListener: Window['addEventListener'] }
    const PREVENT_KEYS = new Set([
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ',
    ])
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        this.controller.pause()
        return
      }
      if (PREVENT_KEYS.has(e.key)) e.preventDefault()

      if (this.isLeft(e.key)) {
        if (!this.leftPressed) {
          this.leftPressed = true
          this.controller.moveLeft()
        }
      } else if (this.isRight(e.key)) {
        if (!this.rightPressed) {
          this.rightPressed = true
          this.controller.moveRight()
        }
      } else if (this.isUp(e.key)) {
        if (!this.upPressed) {
          this.upPressed = true
          this.controller.moveUp()
        }
      } else if (this.isDown(e.key)) {
        if (!this.downPressed) {
          this.downPressed = true
          this.controller.moveDown()
        }
      } else if (e.key === ' ') {
        if (!this.spacePressed) {
          this.spacePressed = true
          this.startFiring()
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (this.isLeft(e.key)) {
        this.leftPressed = false
        if (this.rightPressed) this.controller.moveRight()
        else this.controller.stop()
      } else if (this.isRight(e.key)) {
        this.rightPressed = false
        if (this.leftPressed) this.controller.moveLeft()
        else this.controller.stop()
      } else if (this.isUp(e.key)) {
        this.upPressed = false
        if (this.downPressed) this.controller.moveDown()
        else this.controller.stopY()
      } else if (this.isDown(e.key)) {
        this.downPressed = false
        if (this.upPressed) this.controller.moveUp()
        else this.controller.stopY()
      } else if (e.key === ' ') {
        this.spacePressed = false
        this.stopFiring()
      }
    }
    el.addEventListener('keydown', handleKeyDown)
    el.addEventListener('keyup', handleKeyUp)
    this.cleanups.push(() => {
      el.removeEventListener('keydown', handleKeyDown)
      el.removeEventListener('keyup', handleKeyUp)
    })
  }

  destroy(): void {
    this.stopFiring()
    this.cleanups.forEach((f) => f())
    this.cleanups = []
  }
}
