// === GAME STATE (from server) ===

export type Player = {
  id: string
  x: number
  alive: boolean
}

export type Bullet = {
  x: number
  y: number
  ownerId: string
}

export type Enemy = {
  x: number
  y: number
}

export type PlayerScore = {
  playerId: string
  points: number
  kills: number
}

export type GameOverSummary = {
  playerScores: PlayerScore[]
}

export type GameState = {
  players: Player[]
  bullets: Bullet[]
  enemies: Enemy[]
  lives: number
  points: Record<string, number>
  kills: Record<string, number>
  waveNumber: number
  started: boolean
  paused: boolean
  pausedBy: string | null
  gameOver: boolean
  gameOverSummary: GameOverSummary | null
}

// === SERVER MESSAGES ===

export type StateMessage = { type: 'STATE'; state: GameState }
export type WelcomeMessage = { type: 'WELCOME'; playerId: string; matchId: string }
export type ErrorMessage = { type: 'ERROR'; reason: string }
export type MatchEndedMessage = { type: 'MATCH_ENDED'; reason: string }

export type ServerMessage = StateMessage | WelcomeMessage | ErrorMessage | MatchEndedMessage

// === CLIENT MESSAGES ===

export type MoveMessage = { type: 'MOVE'; dir: -1 | 1 }
export type StopMessage = { type: 'STOP' }
export type ShootMessage = { type: 'SHOOT' }
export type PauseMessage = { type: 'PAUSE' }
export type ResumeMessage = { type: 'RESUME' }
export type ExitMessage = { type: 'EXIT' }

export type ClientMessage = MoveMessage | StopMessage | ShootMessage | PauseMessage | ResumeMessage | ExitMessage
