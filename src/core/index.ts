// ============================================================
// Space Invaders Coop — Core SDK
// Framework-agnostic entry point
// ============================================================

// Classes
export { GameClient } from './GameClient'
export { GameRenderer } from './GameRenderer'
export { MatchmakingClient } from './MatchmakingClient'

// World (logical dimensions from backend meta)
export { getLogicalWidth, getLogicalHeight, getPlayerXMin, getPlayerXMax, getPlayerY, clampPlayerX } from './world'

// Game metadata (fetch from backend, single source of truth for sizes)
export { fetchGameMeta, getGameMeta, setGameMeta, getDefaultMeta } from './gameMeta'

// Viewport (pixel ↔ logical)
export {
  getScaleAndOffset,
  screenToLogical,
} from './viewport'
export type { ViewportRect } from './viewport'

// Input layer (adapters + bridge)
export {
  InputBridge,
  DesktopInputAdapter,
  MobileInputAdapter,
} from './input'
export type { IGameController, GameCommand, SendMove, SendStop, SendFire } from './input'

// Types — re-export everything for consumers
export type {
  // Game state
  Player,
  Bullet,
  Enemy,
  EnemyBullet,
  EnemyBulletKind,
  Boss,
  BossKind,
  PowerUp,
  PowerUpKind,
  Carrier,
  CarrierKind,
  Spark,
  PlayerScore,
  GameOverSummary,
  GameMeta,
  GameState,
  // Messages
  ServerMessage,
  ClientMessage,
  StateMessage,
  WelcomeMessage,
  ErrorMessage,
  MatchEndedMessage,
  MoveMessage,
  StopMessage,
  ShootMessage,
  PauseMessage,
  ResumeMessage,
  ExitMessage,
  // Connection
  ConnectionStatus,
  ConnectionParams,
  // Matchmaking
  GameMode,
  MatchData,
  SessionResult,
} from './types'

// Sprites
export { createSpriteSheet, createLayeredSprite, generateStars } from './Sprites'

// Audio
export { BossAudio } from './audio/BossAudio'

// Ship catalog (for selector previews + renderer config)
export { SHIPS, SHIP_ORDER, getShip, resolveTint } from './ships'
export type { ShipKey, ShipDef, ShipLayer, TintName } from './ships'

// Class-specific types
export type { GameClientEventMap } from './GameClient'
export type { RendererColors, RendererConfig } from './GameRenderer'
export type { SpriteSheet, SpriteColors, Star } from './Sprites'
