// === GAME STATE (from server) ===

export type Player = {
  id: string
  x: number
  alive: boolean
}

export type Bullet = {
  x: number
  y: number
}

export type GameState = {
  players: Player[]
  bullets: Bullet[]
  started: boolean
}

// === SERVER MESSAGES ===

export type StateMessage = { type: 'STATE'; state: GameState }
export type WelcomeMessage = { type: 'WELCOME'; playerId: string }
export type ErrorMessage = { type: 'ERROR'; reason: string }

export type ServerMessage = StateMessage | WelcomeMessage | ErrorMessage

// === CLIENT MESSAGES ===

export type MoveMessage = { type: 'MOVE'; dir: -1 | 1 }
export type StopMessage = { type: 'STOP' }
export type ShootMessage = { type: 'SHOOT' }

export type ClientMessage = MoveMessage | StopMessage | ShootMessage

