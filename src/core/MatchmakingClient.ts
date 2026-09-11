// ============================================================
// MatchmakingClient — HTTP client for queue & matchmaking
// Framework-agnostic: pure TypeScript, uses fetch API only
// ============================================================

import type { SessionResult, GameMode, Difficulty } from './types'

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
   * Ask the server for a session.
   *
   * The server assigns the player id — the client no longer invents one. That
   * is what makes two tabs, two windows or two browsers on one machine
   * distinct players who can co-op with each other, and it is why the socket
   * can trust who is connecting.
   *
   * A solo session comes back with a match id already assigned. A coop one
   * does not: the matchmaker hands it one when it finds an opponent at the
   * same difficulty.
   */
  async createSession(mode: GameMode = 'coop', difficulty: Difficulty = 'easy'): Promise<SessionResult> {
    try {
      const res = await fetch(`${this.baseUrl}/api/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, difficulty }),
      })
      const data = await res.json()

      if (!res.ok || data.status !== 'ok') {
        return { status: 'error', error: data.error || 'Could not reach the game server' }
      }

      return {
        status: 'ok',
        token: data.token,
        playerId: data.playerId,
        matchId: data.matchId,
        wsUrl: data.wsUrl,
        mode: data.mode ?? mode,
        difficulty: data.difficulty ?? difficulty,
      }
    } catch {
      return { status: 'error', error: 'Could not reach the game server' }
    }
  }
}
