// ============================================================
// World — logical game dimensions (resolution-independent)
// Shared by rendering, input, and network sync
// ============================================================

export const LOGICAL_WIDTH = 800
export const LOGICAL_HEIGHT = 600

/** Player X bounds (center of ship). Matches server clamp. */
export const PLAYER_X_MIN = 20
export const PLAYER_X_MAX = LOGICAL_WIDTH - 20

/** Player Y position (fixed). */
export const PLAYER_Y = 550

export function clampPlayerX(x: number): number {
  return Math.max(PLAYER_X_MIN, Math.min(PLAYER_X_MAX, x))
}
