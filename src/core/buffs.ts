import type { Player } from "./types"

// Bonuses used to be timers; they now last (double shot and speed until the
// player loses a life, the shield for a number of hits). These helpers read
// either shape, so this client works against servers on both sides of the
// change.

export function hasDoubleShot(p: Player): boolean {
  return p.doubleShot ?? (p.doubleShotTimer ?? 0) > 0
}

export function hasSpeedBoost(p: Player): boolean {
  return p.speedBoost ?? (p.speedBoostTimer ?? 0) > 0
}

/** Hits the shield still absorbs. A timed shield broke on its first hit. */
export function shieldCharges(p: Player): number {
  if (p.shieldCharges !== undefined) return p.shieldCharges
  return (p.shieldTimer ?? 0) > 0 ? 1 : 0
}

/** Seconds left on a timed bonus, or null when bonuses last (newer servers). */
export function secondsLeft(timer: number | undefined, lasting: boolean | number | undefined): number | null {
  if (lasting !== undefined) return null
  return timer ? Math.ceil(timer / 30) : null
}
