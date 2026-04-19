// ============================================================
// Space Invaders Coop — Core SDK Types
// Framework-agnostic: pure TypeScript, zero dependencies
// ============================================================

// === GAME STATE (from server) ===

export type Player = {
  id: string
  userId?: string
  displayName?: string
  x: number
  y: number
  directionY: -1 | 0 | 1
  alive: boolean
  lives: number
  invincibleTimer: number  // ticks of invincibility remaining (0 = vulnerable)
  doubleShotTimer: number  // ticks remaining (0 = inactive)
  speedBoostTimer: number  // ticks remaining (0 = inactive)
  shieldTimer: number      // ticks remaining (0 = inactive)
}

export type PowerUpKind =
  | 'extra_life'
  | 'double_shot'
  | 'speed_boost'
  | 'shield'
  | 'points_bonus'

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

export type EnemyBulletKind = 'aimed' | 'comet' | ''

export type EnemyBullet = {
  x: number
  y: number
  dx: number
  dy: number
  /** Optional — absent on existing bullet types (backward compatible). */
  kind?: EnemyBulletKind
}

export type BossKind = 'sentinel' | 'warden' | 'citadel' | 'nexus'

export type Boss = {
  kind: BossKind
  x: number
  y: number
  hp: number
  maxHp: number
  phase: number
  /** Citadel/Nexus only — true while the boss is invulnerable. */
  shieldActive?: boolean
}

export type PowerUp = {
  x: number
  y: number
  kind: PowerUpKind
}

export type Spark = {
  x: number
  y: number
  ttl: number
  life: number
  kind: 'bullet'
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
  playerYMin: number
  playerYMax: number
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
  sparks: Spark[]
  lives: number
  points: Record<string, number>
  kills: Record<string, number>
  killStreaks: Record<string, number>
  waveNumber: number
  levelName: string
  waveName: string
  totalWaves: number
  victory?: boolean
  /** Present during a boss fight, absent (or null) otherwise. */
  boss?: Boss | null
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

export type MoveMessage = { type: 'MOVE'; dir?: -1 | 0 | 1; dirY?: -1 | 0 | 1 }
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

export type GameMode = 'solo' | 'coop'

export type ConnectionParams = {
  token: string
  matchId: string
  playerId: string
  mode: GameMode
  /** Clerk session JWT. Optional — omit for guests. */
  authToken?: string
}

// === MATCHMAKING ===

export type MatchData = {
  matchId: string
  matchToken: string
  wsUrl: string
  playerId: string
  mode: GameMode
}

export type QueueResult =
  | { status: 'queued' }
  | { status: 'matched'; matchId: string; matchToken: string; wsUrl: string; playerId: string; mode: GameMode }
  | { status: 'error'; error: string }

export type MatchPollResult =
  | { status: 'waiting' }
  | { status: 'ready'; matchId: string; matchToken: string; wsUrl: string; playerId: string; mode: GameMode }
