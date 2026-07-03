import type { GameClient } from './GameClient'
import type { GameMode } from './types'

type PendingGame = {
  client: GameClient
  matchId: string
  playerId: string
  wsUrl: string
  mode: GameMode
}

let _pending: PendingGame | null = null

export function setPendingGame(data: PendingGame): void {
  _pending = data
}

export function takePendingGame(): PendingGame | null {
  const d = _pending
  _pending = null
  return d
}
