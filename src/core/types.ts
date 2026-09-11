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
  doubleShot?: boolean     // kept until the player loses a life
  speedBoost?: boolean     // kept until the player loses a life
  shieldCharges?: number   // hits the shield still absorbs (0 = no shield)
  /** @deprecated Timed bonuses from servers before carriers; read via buffs.ts. */
  doubleShotTimer?: number
  /** @deprecated */
  speedBoostTimer?: number
  /** @deprecated */
  shieldTimer?: number
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

/**
 * A bonus carrier: an asteroid or the goblin's courier ship. It never shoots
 * or hurts; shooting it down releases `drop`, and it takes the bonus with it
 * if it leaves the screen.
 */
export type CarrierKind = 'asteroid' | 'courier'

export type Carrier = {
  kind: CarrierKind
  x: number
  y: number
  hp: number
  drop: PowerUpKind
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
  /** Absent on servers that predate carriers. */
  carriers?: Carrier[]
  sparks: Spark[]
  lives: number
  points: Record<string, number>
  kills: Record<string, number>
  killStreaks: Record<string, number>
  waveNumber: number
  levelName: string
  /** Display name ("Sector 2 — Flank Run"); levelName is the storage key. */
  levelTitle?: string
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
export type QueuedMessage = { type: 'QUEUED'; position: number }
export type MatchFoundMessage = { type: 'MATCH_FOUND'; matchId: string }
export type QueueTimeoutMessage = { type: 'QUEUE_TIMEOUT'; reason: string }

export type ServerMessage = StateMessage | WelcomeMessage | ErrorMessage | MatchEndedMessage | PongMessage | QueuedMessage | MatchFoundMessage | QueueTimeoutMessage

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
  /** Session token from /api/session. Carries the identity; the server
   *  derives playerId, matchId and mode from it rather than trusting the
   *  client, so none of those are sent. */
  token: string
  /** Clerk session JWT. Optional — omit for guests. */
  authToken?: string
}

// === MATCHMAKING ===

export type MatchData = {
  token: string
  wsUrl: string
  /** Assigned by the server, echoed back in WELCOME. */
  playerId: string
  /** Present for solo immediately; for coop only once the matchmaker pairs. */
  matchId?: string
  mode: GameMode
}

export type SessionResult =
  | { status: 'ok'; token: string; playerId: string; matchId?: string; wsUrl: string; mode: GameMode }
  | { status: 'error'; error: string }

