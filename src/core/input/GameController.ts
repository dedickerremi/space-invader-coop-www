// ============================================================
// GameController — abstract input interface (input-agnostic)
// Engine only receives these commands; adapters translate input into them
// ============================================================

export type GameCommand =
  | { type: 'MOVE_LEFT' }
  | { type: 'MOVE_RIGHT' }
  | { type: 'MOVE_UP' }
  | { type: 'MOVE_DOWN' }
  | { type: 'STOP' }
  | { type: 'STOP_Y' }
  | { type: 'SET_POSITION'; x: number }
  | { type: 'FIRE' }
  | { type: 'PAUSE' }

/**
 * Abstract game controller. Input adapters call these methods;
 * the bridge translates them into network messages and optional prediction.
 */
export interface IGameController {
  moveLeft(): void
  moveRight(): void
  stop(): void
  moveUp(): void
  moveDown(): void
  stopY(): void
  /** Mobile: set target X (logical). Ship follows finger. */
  setTargetX(x: number | null): void
  fire(): void
  pause(): void

  /** For bridge/sync: get current target X (mobile slide). null = not used. */
  getTargetX(): number | null

  /** Set paused state (ignore move/fire; pause key still works). */
  setPaused(paused: boolean): void
}
