// ============================================================
// Game metadata from backend (GET /api/game-meta)
// Single source of truth for game dimensions; frontend only displays.
// ============================================================

import type { GameMeta } from './types'

let currentMeta: GameMeta | null = null

/** Fallback when fetch fails or before load (matches backend defaults). */
export function getDefaultMeta(): GameMeta {
  return {
    gameWidth: 800,
    gameHeight: 600,
    playerXMin: 20,
    playerXMax: 780,
    playerYMin: 350,
    playerYMax: 580,
    playerY: 550,
    playerWidth: 40,
    playerHeight: 20,
    bulletSpeed: 8,
    bulletWidth: 6,
    bulletHeight: 14,
    enemyBulletWidth: 6,
    enemyBulletHeight: 10,
    enemySize: 28,
    patrolSize: 32,
    powerUpSize: 20,
  }
}

export function getGameMeta(): GameMeta {
  return currentMeta ?? getDefaultMeta()
}

export function setGameMeta(meta: GameMeta): void {
  currentMeta = meta
}

/**
 * Fetch game dimensions from backend. Use WS URL to derive API base (wss→https, ws→http).
 */
export async function fetchGameMeta(wsUrl: string): Promise<GameMeta> {
  const base = wsUrl.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/?$/, '')
  const url = `${base}/api/game-meta`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`game-meta: ${res.status}`)
  const data = (await res.json()) as Partial<GameMeta>
  const merged: GameMeta = { ...getDefaultMeta(), ...data }
  setGameMeta(merged)
  return merged
}
