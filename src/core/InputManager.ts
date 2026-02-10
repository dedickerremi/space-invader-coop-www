// ============================================================
// InputManager — keyboard, touch & gamepad input abstraction
// Framework-agnostic: pure TypeScript, DOM events only
// ============================================================

// --- Callbacks the consumer provides ---

export type InputCallbacks = {
  onMove: (dir: -1 | 1) => void
  onStop: () => void
  onShoot: () => void
  onPause: () => void
}

// --- InputManager class ---

export class InputManager {
  private cleanups: (() => void)[] = []
  private _paused = false

  constructor(private callbacks: InputCallbacks) {}

  /** Set to true to ignore game inputs (move/shoot). Pause key still works. */
  set paused(value: boolean) {
    this._paused = value
  }

  get paused(): boolean {
    return this._paused
  }

  /**
   * Enable keyboard controls:
   *  - ArrowLeft / ArrowRight → move
   *  - Space → shoot
   *  - Escape → pause
   */
  enableKeyboard(): void {
    let leftPressed = false
    let rightPressed = false

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape always works (even when paused)
      if (e.key === 'Escape') {
        e.preventDefault()
        this.callbacks.onPause()
        return
      }

      // Don't process game inputs if paused
      if (this._paused) return

      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault()
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (!leftPressed) {
            leftPressed = true
            this.callbacks.onMove(-1)
          }
          break
        case 'ArrowRight':
          if (!rightPressed) {
            rightPressed = true
            this.callbacks.onMove(1)
          }
          break
        case ' ':
          this.callbacks.onShoot()
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (this._paused) return

      switch (e.key) {
        case 'ArrowLeft':
          leftPressed = false
          if (rightPressed) {
            this.callbacks.onMove(1)
          } else {
            this.callbacks.onStop()
          }
          break
        case 'ArrowRight':
          rightPressed = false
          if (leftPressed) {
            this.callbacks.onMove(-1)
          } else {
            this.callbacks.onStop()
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    this.cleanups.push(() => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    })
  }

  /**
   * Enable touch controls on a given element:
   *  - Left half → move left
   *  - Right half → move right
   *  - Tap → shoot
   *  - Two-finger tap → pause
   */
  enableTouch(element: HTMLElement): void {
    let moveDir: -1 | 1 | 0 = 0
    let shootTimeout: ReturnType<typeof setTimeout> | null = null

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault()

      // Two-finger tap → pause
      if (e.touches.length >= 2) {
        this.callbacks.onPause()
        return
      }

      if (this._paused) return

      const touch = e.touches[0]
      const rect = element.getBoundingClientRect()
      const relativeX = touch.clientX - rect.left

      // Determine direction
      if (relativeX < rect.width / 3) {
        moveDir = -1
        this.callbacks.onMove(-1)
      } else if (relativeX > (rect.width * 2) / 3) {
        moveDir = 1
        this.callbacks.onMove(1)
      } else {
        // Center tap → shoot
        this.callbacks.onShoot()
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (this._paused) return

      if (e.touches.length === 0) {
        moveDir = 0
        this.callbacks.onStop()
      }

      if (shootTimeout) {
        clearTimeout(shootTimeout)
        shootTimeout = null
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (this._paused || e.touches.length === 0) return
      e.preventDefault()

      const touch = e.touches[0]
      const rect = element.getBoundingClientRect()
      const relativeX = touch.clientX - rect.left

      const newDir: -1 | 1 | 0 =
        relativeX < rect.width / 3 ? -1 : relativeX > (rect.width * 2) / 3 ? 1 : 0

      if (newDir !== moveDir) {
        moveDir = newDir
        if (newDir === 0) {
          this.callbacks.onStop()
        } else {
          this.callbacks.onMove(newDir)
        }
      }
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: false })
    element.addEventListener('touchend', handleTouchEnd, { passive: false })
    element.addEventListener('touchmove', handleTouchMove, { passive: false })

    this.cleanups.push(() => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchmove', handleTouchMove)
    })
  }

  /**
   * Remove all registered event listeners and clean up.
   */
  destroy(): void {
    for (const cleanup of this.cleanups) {
      cleanup()
    }
    this.cleanups = []
  }
}
