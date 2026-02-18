// ============================================================
// InputBridge — translates GameController commands into network messages
// Handles targetX (mobile) → MOVE_LEFT / MOVE_RIGHT / STOP
// Exposes predicted local X for client-side prediction
// ============================================================

import { clampPlayerX } from '../world'

export type SendMove = (dir: -1 | 1) => void
export type SendStop = () => void
export type SendFire = () => void

const MOVE_THRESHOLD = 4 // logical units; avoid jitter

import type { IGameController } from './GameController'

export class InputBridge implements IGameController {
  private _targetX: number | null = null
  private _paused = false
  private lastSentDir: -1 | 0 | 1 = 0

  constructor(
    private sendMove: SendMove,
    private sendStop: SendStop,
    private sendFire: SendFire,
    /** Called when user requests pause (Escape / two-finger tap) */
    private onPauseRequested?: () => void,
  ) {}

  moveLeft(): void {
    if (this._paused) return
    this._targetX = null
    if (this.lastSentDir !== -1) {
      this.lastSentDir = -1
      this.sendMove(-1)
    }
  }

  moveRight(): void {
    if (this._paused) return
    this._targetX = null
    if (this.lastSentDir !== 1) {
      this.lastSentDir = 1
      this.sendMove(1)
    }
  }

  stop(): void {
    this._targetX = null
    if (this.lastSentDir !== 0) {
      this.lastSentDir = 0
      this.sendStop()
    }
  }

  setTargetX(x: number | null): void {
    if (this._paused) return
    this._targetX = x === null ? null : clampPlayerX(x)
  }

  getTargetX(): number | null {
    return this._targetX
  }

  fire(): void {
    if (this._paused) return
    this.sendFire()
  }

  pause(): void {
    this.onPauseRequested?.()
  }

  setPaused(paused: boolean): void {
    this._paused = paused
    if (paused) {
      this._targetX = null
      if (this.lastSentDir !== 0) {
        this.lastSentDir = 0
        this.sendStop()
      }
    }
  }

  /**
   * Call from sync loop: given current server X (authoritative), derive MOVE/STOP from targetX.
   * Returns predicted X for local player (client-side prediction).
   * Server correction: next state update carries server X; we feed it here and keep sending
   * MOVE/STOP so server state converges. Display uses predicted X for smooth 1:1 feel.
   */
  tick(serverPlayerX: number): number {
    if (this._targetX === null) {
      return serverPlayerX
    }
    const dx = this._targetX - serverPlayerX
    if (Math.abs(dx) <= MOVE_THRESHOLD) {
      if (this.lastSentDir !== 0) {
        this.lastSentDir = 0
        this.sendStop()
      }
      return this._targetX
    }
    const dir: -1 | 1 = dx < 0 ? -1 : 1
    if (this.lastSentDir !== dir) {
      this.lastSentDir = dir
      this.sendMove(dir)
    }
    return this._targetX
  }
}
