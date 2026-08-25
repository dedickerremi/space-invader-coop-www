// ============================================================
// MatchmakingClient — HTTP client for queue & matchmaking
// Framework-agnostic: pure TypeScript, uses fetch API only
// ============================================================

import type { QueueResult, MatchPollResult, GameMode } from './types'

export class MatchmakingClient {
  private baseUrl: string

  /**
   * @param baseUrl  API base URL. Defaults to '' (same origin / relative URLs).
   *                 For cross-origin usage: 'https://my-matchmaking-server.com'
   */
  constructor(baseUrl: string = '') {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '')
  }

  /**
   * Join the matchmaking queue.
   * Returns 'queued' if waiting, 'matched' if a match was found immediately.
   */
  async joinQueue(userId: string, mode: GameMode = 'coop'): Promise<QueueResult> {
    const res = await fetch(`${this.baseUrl}/api/queue/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, mode }),
    })

    const data = await res.json()

    if (data.status === 'matched') {
      return {
        status: 'matched',
        matchId: data.matchId,
        matchToken: data.matchToken,
        wsUrl: data.wsUrl,
        playerId: data.playerId,
        mode: data.mode ?? mode,
      }
    }

    if (data.status === 'queued') {
      return { status: 'queued', queueToken: data.queueToken, wsUrl: data.wsUrl }
    }

    return { status: 'error', error: data.error || 'Unknown error' }
  }

  /**
   * Leave the matchmaking queue.
   */
  async leaveQueue(userId: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/queue/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
  }

  /**
   * Poll for a match assignment.
   * Returns 'ready' when a match has been created, 'waiting' otherwise.
   */
  async pollMatch(userId: string): Promise<MatchPollResult> {
    const res = await fetch(`${this.baseUrl}/api/match/current?userId=${userId}`)
    const data = await res.json()

    if (data.status === 'ready') {
      return {
        status: 'ready',
        matchId: data.matchId,
        matchToken: data.matchToken,
        wsUrl: data.wsUrl,
        playerId: data.playerId,
        mode: data.mode ?? 'coop',
      }
    }

    return { status: 'waiting' }
  }

  /**
   * Get the matchmaking ID for this tab.
   *
   * Deliberately NOT persisted in web storage: localStorage is shared by every
   * tab of a browser, and sessionStorage is *copied* into a duplicated tab —
   * either one lets two tabs send the same ID, and the queue then pairs the
   * player with themselves. Module scope gives one ID per JS context, i.e. one
   * per tab, so two tabs / two windows / two browsers on the same machine get
   * distinct IDs and can co-op with each other.
   *
   * A reload mints a new ID. That is fine: an in-progress match reconnects with
   * the playerId stored in `matchData`, not with this one.
   */
  static generateUserId(): string {
    if (!tabUserId) tabUserId = `user-${randomSuffix()}`
    return tabUserId
  }
}

// Per-tab, per-page-load matchmaking ID. See generateUserId above.
let tabUserId: string | null = null

function randomSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
