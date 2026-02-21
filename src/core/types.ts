// ============================================================
// Space Invaders Coop — Core SDK Types
// Framework-agnostic: pure TypeScript, zero dependencies
// ============================================================

// === GAME STATE (from server) ===

export type Player = {
  id: string
  x: number
  alive: boolean
  lives: number
  respawnTimer: number     // ticks until respawn (0 = not respawning)
  invincibleTimer: number  // ticks of invincibility remaining (0 = vulnerable)
  activePowerUp: string    // "" = none, "speed", "multishot"
  powerUpTimer: number     // ticks remaining
}

export type Bullet = {
  x: number
  y: number
  ownerId: string
}

export type Enemy = {
  x: number
  y: number
  type: 'static' | 'patrol'
}

export type EnemyBullet = {
  x: number
  y: number
  dx: number
  dy: number
}

export type PowerUp = {
  x: number
  y: number
  kind: 'speed' | 'multishot'
}

export type PlayerScore = {
  playerId: string
  points: number
  kills: number
}

export type GameOverSummary = {
  playerScores: PlayerScore[]
}

/** Game dimensions/layout from backend (GET /api/game-meta). Single source of truth for display. */
export type GameMeta = {
  gameWidth: number
  gameHeight: number
  playerXMin: number
  playerXMax: number
  playerY: number
  playerWidth: number
  playerHeight: number
  bulletSpeed: number
  bulletWidth: number
  bulletHeight: number
  enemyBulletWidth: number
  enemyBulletHeight: number
  enemySize: number
  patrolSize: number
  powerUpSize: number
}

export type GameState = {
  players: Player[]
  bullets: Bullet[]
  enemyBullets: EnemyBullet[]
  enemies: Enemy[]
  powerUps: PowerUp[]
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

// === SERVER → CLIENT MESSAGES ===

export type StateMessage = { type: 'STATE'; state: GameState }
export type WelcomeMessage = { type: 'WELCOME'; playerId: string; matchId: string }
export type ErrorMessage = { type: 'ERROR'; reason: string }
export type MatchEndedMessage = { type: 'MATCH_ENDED'; reason: string }
export type PongMessage = { type: 'PONG'; timestamp: number }

export type ServerMessage = StateMessage | WelcomeMessage | ErrorMessage | MatchEndedMessage | PongMessage

// === CLIENT → SERVER MESSAGES ===

export type MoveMessage = { type: 'MOVE'; dir: -1 | 1 }
export type StopMessage = { type: 'STOP' }
export type ShootMessage = { type: 'SHOOT' }
export type PauseMessage = { type: 'PAUSE' }
export type ResumeMessage = { type: 'RESUME' }
export type ExitMessage = { type: 'EXIT' }
export type PingMessage = { type: 'PING'; timestamp: number }

export type ClientMessage =
  | MoveMessage
  | StopMessage
  | ShootMessage
  | PauseMessage
  | ResumeMessage
  | ExitMessage
  | PingMessage

// === CONNECTION ===

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type ConnectionParams = {
  token: string
  matchId: string
  playerId: string
}

// === MATCHMAKING ===

export type MatchData = {
  matchId: string
  matchToken: string
  wsUrl: string
  playerId: string
}

export type QueueResult =
  | { status: 'queued' }
  | { status: 'matched'; matchId: string; matchToken: string; wsUrl: string; playerId: string }
  | { status: 'error'; error: string }

export type MatchPollResult =
  | { status: 'waiting' }
  | { status: 'ready'; matchId: string; matchToken: string; wsUrl: string; playerId: string }
