// ============================================================
// DesktopInputAdapter — keyboard → GameController commands
// ============================================================

import type { IGameController } from './GameController'

export class DesktopInputAdapter {
  private cleanups: (() => void)[] = []
  private leftPressed = false
  private rightPressed = false

  constructor(
    private controller: IGameController,
    private element: Window | HTMLElement = window,
  ) {
    this.attach()
  }

  private attach(): void {
    const el = this.element as Window & { addEventListener: Window['addEventListener'] }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        this.controller.pause()
        return
      }
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault()
      switch (e.key) {
        case 'ArrowLeft':
          if (!this.leftPressed) {
            this.leftPressed = true
            this.controller.moveLeft()
          }
          break
        case 'ArrowRight':
          if (!this.rightPressed) {
            this.rightPressed = true
            this.controller.moveRight()
          }
          break
        case ' ':
          this.controller.fire()
          break
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          this.leftPressed = false
          if (this.rightPressed) this.controller.moveRight()
          else this.controller.stop()
          break
        case 'ArrowRight':
          this.rightPressed = false
          if (this.leftPressed) this.controller.moveLeft()
          else this.controller.stop()
          break
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
    this.cleanups.forEach((f) => f())
    this.cleanups = []
  }
}
