// ============================================================
// Space Invaders Coop — Core SDK
// Framework-agnostic entry point
// ============================================================

// Classes
export { GameClient } from './GameClient'
export { GameRenderer } from './GameRenderer'
export { InputManager } from './InputManager'
export { MatchmakingClient } from './MatchmakingClient'

// Types — re-export everything for consumers
export type {
  // Game state
  Player,
  Bullet,
  Enemy,
  EnemyBullet,
  PlayerScore,
  GameOverSummary,
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
export type { InputCallbacks } from './InputManager'
export type { SpriteSheet, SpriteColors, Star } from './Sprites'
