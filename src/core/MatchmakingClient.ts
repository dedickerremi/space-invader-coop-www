// ============================================================
// MatchmakingClient — HTTP client for queue & matchmaking
// Framework-agnostic: pure TypeScript, uses fetch API only
// ============================================================

import type { QueueResult, MatchPollResult } from './types'

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
  async joinQueue(userId: string): Promise<QueueResult> {
    const res = await fetch(`${this.baseUrl}/api/queue/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })

    const data = await res.json()

    if (data.status === 'matched') {
      return {
        status: 'matched',
        matchId: data.matchId,
        matchToken: data.matchToken,
        wsUrl: data.wsUrl,
        playerId: data.playerId,
      }
    }

    if (data.status === 'queued') {
      return { status: 'queued' }
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
      }
    }

    return { status: 'waiting' }
  }

  /**
   * Generate a unique user ID.
   * Uses sessionStorage when available (so each tab gets a unique ID).
   */
  static generateUserId(): string {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('userId')
      if (stored) return stored

      const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      sessionStorage.setItem('userId', id)
      return id
    }

    // Fallback for environments without sessionStorage (e.g. React Native)
    return `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}
