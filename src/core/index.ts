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
  createMobileMovementConverter,
} from './viewport'
export type { ViewportRect } from './viewport'

// Input layer (adapters + bridge)
export {
  InputBridge,
  DesktopInputAdapter,
  MobileInputAdapter,
} from './input'
export type { IGameController, GameCommand, SendMove, SendStop, SendFire, PixelToLogical } from './input'

// Types — re-export everything for consumers
export type {
  // Game state
  Player,
  Bullet,
  Enemy,
  EnemyBullet,
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
  MatchData,
  QueueResult,
  MatchPollResult,
} from './types'

// Sprites
export { createSpriteSheet, generateStars } from './Sprites'

// Class-specific types
export type { GameClientEventMap } from './GameClient'
export type { RendererColors, RendererConfig } from './GameRenderer'
export type { SpriteSheet, SpriteColors, Star } from './Sprites'
