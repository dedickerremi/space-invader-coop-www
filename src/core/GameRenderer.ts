// ============================================================
// GameRenderer — Canvas 2D game rendering
// Framework-agnostic: pure TypeScript, uses Canvas API only
// ============================================================

import type { GameState } from './types'

// --- Configuration ---

export type RendererColors = {
  player1: string
  player2: string
  playerDead: string
  bullet: string
  enemy: string
  enemyGlow: string
  background: string
}

export type RendererConfig = {
  width?: number
  height?: number
  colors?: Partial<RendererColors>
}

const DEFAULT_COLORS: RendererColors = {
  player1: '#00ff88',
  player2: '#00aaff',
  playerDead: '#333',
  bullet: '#ffff00',
  enemy: '#ff4444',
  enemyGlow: 'rgba(255, 68, 68, 0.6)',
  background: '#050508',
}

// --- Constants ---

const PLAYER_WIDTH = 40
const PLAYER_HEIGHT = 20
const PLAYER_Y = 550
const BULLET_SIZE = 4
const ENEMY_SIZE = 24

// --- GameRenderer class ---

export class GameRenderer {
  private ctx: CanvasRenderingContext2D
  private animationId: number | null = null
  private colors: RendererColors

  readonly width: number
  readonly height: number

  /** Current game state to render (set externally) */
  state: GameState | null = null

  /** Local player ID (to distinguish "you" from other player) */
  localPlayerId: string | null = null

  /** Whether the pause menu is shown (affects overlay rendering) */
  showPauseOverlay = false

  constructor(canvas: HTMLCanvasElement, config?: RendererConfig) {
    this.width = config?.width ?? 800
    this.height = config?.height ?? 600
    this.colors = { ...DEFAULT_COLORS, ...config?.colors }

    canvas.width = this.width
    canvas.height = this.height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context not available')
    this.ctx = ctx
  }

  /**
   * Render a single frame with the current state.
   */
  render(): void {
    const ctx = this.ctx
    const state = this.state

    // Clear
    ctx.fillStyle = this.colors.background
    ctx.fillRect(0, 0, this.width, this.height)

    if (!state) return

    // Not started yet — waiting screen
    if (!state.started) {
      this.renderWaiting(state)
      return
    }

    // Draw players
    this.renderPlayers(state)

    // Draw bullets
    this.renderBullets(state)

    // Draw enemies
    this.renderEnemies(state)

    // Draw pause indicator (when other player paused and we're not showing our own menu)
    if (state.paused && !this.showPauseOverlay) {
      this.renderPausedByOther()
    }
  }

  /**
   * Start the render loop (requestAnimationFrame).
   */
  start(): void {
    this.stop()
    const loop = () => {
      this.render()
      this.animationId = requestAnimationFrame(loop)
    }
    loop()
  }

  /**
   * Stop the render loop.
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId)
      this.animationId = null
    }
  }

  // --- Private rendering methods ---

  private renderWaiting(state: GameState): void {
    const ctx = this.ctx
    ctx.fillStyle = '#666'
    ctx.font = '24px JetBrains Mono, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Waiting for opponent...', this.width / 2, this.height / 2)
    ctx.font = '14px JetBrains Mono, monospace'
    ctx.fillText(
      `${state.players.length}/2 connected`,
      this.width / 2,
      this.height / 2 + 30,
    )
  }

  private renderPlayers(state: GameState): void {
    const ctx = this.ctx

    state.players.forEach((player, index) => {
      let color: string

      if (!player.alive) {
        color = this.colors.playerDead
      } else if (player.id === this.localPlayerId) {
        color = this.colors.player1
      } else {
        color = this.colors.player2
      }

      // Player body
      ctx.fillStyle = color
      ctx.fillRect(
        player.x - PLAYER_WIDTH / 2,
        PLAYER_Y - PLAYER_HEIGHT / 2,
        PLAYER_WIDTH,
        PLAYER_HEIGHT,
      )

      // Glow effect
      if (player.alive) {
        ctx.shadowColor = color
        ctx.shadowBlur = 15
        ctx.fillRect(
          player.x - PLAYER_WIDTH / 2,
          PLAYER_Y - PLAYER_HEIGHT / 2,
          PLAYER_WIDTH,
          PLAYER_HEIGHT,
        )
        ctx.shadowBlur = 0
      }

      // Player label
      ctx.fillStyle = '#fff'
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      const label = player.id === this.localPlayerId ? 'YOU' : `P${index + 1}`
      ctx.fillText(label, player.x, PLAYER_Y + 25)
    })
  }

  private renderBullets(state: GameState): void {
    const ctx = this.ctx

    ctx.fillStyle = this.colors.bullet
    ctx.shadowColor = this.colors.bullet
    ctx.shadowBlur = 10

    for (const bullet of state.bullets) {
      ctx.beginPath()
      ctx.arc(bullet.x, bullet.y, BULLET_SIZE, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.shadowBlur = 0
  }

  private renderEnemies(state: GameState): void {
    const ctx = this.ctx
    const half = ENEMY_SIZE / 2
    const enemies = state.enemies ?? []

    for (const e of enemies) {
      ctx.fillStyle = this.colors.enemy
      ctx.shadowColor = this.colors.enemyGlow
      ctx.shadowBlur = 12
      ctx.fillRect(e.x - half, e.y - half, ENEMY_SIZE, ENEMY_SIZE)
      ctx.shadowBlur = 0
    }
  }

  private renderPausedByOther(): void {
    const ctx = this.ctx

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.fillStyle = '#fff'
    ctx.font = '24px JetBrains Mono, monospace'
    ctx.textAlign = 'center'
    ctx.fillText('PAUSED', this.width / 2, this.height / 2)

    ctx.font = '14px JetBrains Mono, monospace'
    ctx.fillText('Waiting for other player...', this.width / 2, this.height / 2 + 30)
  }
}
