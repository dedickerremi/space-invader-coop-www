// ============================================================
// World — logical game dimensions (from backend metadata)
// Shared by rendering, input, and viewport
// ============================================================

import { getGameMeta } from './gameMeta'

export function getLogicalWidth(): number {
  return getGameMeta().gameWidth
}

export function getLogicalHeight(): number {
  return getGameMeta().gameHeight
}

export function getPlayerXMin(): number {
  return getGameMeta().playerXMin
}

export function getPlayerXMax(): number {
  return getGameMeta().playerXMax
}

export function getPlayerY(): number {
  return getGameMeta().playerY
}

/** Player X bounds (center of ship). Matches server clamp. */
export function clampPlayerX(x: number): number {
  const { playerXMin, playerXMax } = getGameMeta()
  return Math.max(playerXMin, Math.min(playerXMax, x))
}

export function getPlayerYMin(): number {
  return getGameMeta().playerYMin
}

export function getPlayerYMax(): number {
  return getGameMeta().playerYMax
}

/** Player Y bounds (center of ship). Matches server clamp. */
export function clampPlayerY(y: number): number {
  const { playerYMin, playerYMax } = getGameMeta()
  return Math.max(playerYMin, Math.min(playerYMax, y))
}
