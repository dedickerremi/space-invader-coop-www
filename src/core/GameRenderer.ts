// ============================================================
// GameRenderer — Canvas 2D game rendering with pixel art sprites
// Framework-agnostic: pure TypeScript, uses Canvas API only
// ============================================================

import type { GameState } from './types'
import { createSpriteSheet, generateStars } from './Sprites'
import type { SpriteSheet, Star } from './Sprites'

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
const PLAYER_HEIGHT = 26
const PLAYER_Y = 550
const BULLET_WIDTH = 6
const BULLET_HEIGHT = 14
const ENEMY_SIZE = 28

// Enemy animation: alternate frames every N ms
const ENEMY_ANIM_INTERVAL = 600

// --- GameRenderer class ---

export class GameRenderer {
  private ctx: CanvasRenderingContext2D
  private animationId: number | null = null
  private colors: RendererColors

  // Sprites
  private sprites: SpriteSheet
  private stars: Star[]
  private startTime: number

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

    // Generate sprites
    this.sprites = createSpriteSheet({
      player1: this.colors.player1,
      player2: this.colors.player2,
      playerDead: this.colors.playerDead,
      enemy: this.colors.enemy,
      bullet: this.colors.bullet,
    })

    // Generate background stars
    this.stars = generateStars(this.width, this.height)

    // Track time for animations
    this.startTime = performance.now()
  }

  /**
   * Render a single frame with the current state.
   */
  render(): void {
    const ctx = this.ctx
    const state = this.state

    // Clear with background
    ctx.fillStyle = this.colors.background
    ctx.fillRect(0, 0, this.width, this.height)

    // Draw star field
    this.renderStars()

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

  private renderStars(): void {
    const ctx = this.ctx
    const elapsed = (performance.now() - this.startTime) / 1000

    for (const star of this.stars) {
      // Twinkle: oscillate brightness over time
      const twinkle = 0.5 + 0.5 * Math.sin(elapsed * star.twinkleSpeed + star.x)
      const alpha = star.brightness * twinkle
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.fillRect(star.x, star.y, star.size, star.size)
    }
  }

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

    // Disable smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false

    state.players.forEach((player, index) => {
      let sprite: HTMLCanvasElement

      if (!player.alive) {
        sprite = this.sprites.playerDead
      } else if (player.id === this.localPlayerId) {
        sprite = this.sprites.player1
      } else {
        sprite = this.sprites.player2
      }

      const drawX = player.x - PLAYER_WIDTH / 2
      const drawY = PLAYER_Y - PLAYER_HEIGHT / 2

      // Glow effect for alive players
      if (player.alive) {
        const color = player.id === this.localPlayerId ? this.colors.player1 : this.colors.player2
        ctx.shadowColor = color
        ctx.shadowBlur = 18
        ctx.drawImage(sprite, drawX, drawY, PLAYER_WIDTH, PLAYER_HEIGHT)
        ctx.shadowBlur = 0
      }

      // Draw sprite (on top of glow)
      ctx.drawImage(sprite, drawX, drawY, PLAYER_WIDTH, PLAYER_HEIGHT)

      // Player label
      ctx.fillStyle = '#fff'
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      const label = player.id === this.localPlayerId ? 'YOU' : `P${index + 1}`
      ctx.fillText(label, player.x, PLAYER_Y + PLAYER_HEIGHT / 2 + 14)
    })

    ctx.imageSmoothingEnabled = true
  }

  private renderBullets(state: GameState): void {
    const ctx = this.ctx

    // Disable smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false

    ctx.shadowColor = this.colors.bullet
    ctx.shadowBlur = 8

    for (const bullet of state.bullets) {
      ctx.drawImage(
        this.sprites.bullet,
        bullet.x - BULLET_WIDTH / 2,
        bullet.y - BULLET_HEIGHT / 2,
        BULLET_WIDTH,
        BULLET_HEIGHT,
      )
    }

    ctx.shadowBlur = 0
    ctx.imageSmoothingEnabled = true
  }

  private renderEnemies(state: GameState): void {
    const ctx = this.ctx
    const enemies = state.enemies ?? []
    const half = ENEMY_SIZE / 2

    // Pick animation frame based on time
    const elapsed = performance.now() - this.startTime
    const frame = Math.floor(elapsed / ENEMY_ANIM_INTERVAL) % 2
    const sprite = frame === 0 ? this.sprites.enemyA : this.sprites.enemyB

    // Disable smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false

    for (const e of enemies) {
      // Glow
      ctx.shadowColor = this.colors.enemyGlow
      ctx.shadowBlur = 14
      ctx.drawImage(sprite, e.x - half, e.y - half, ENEMY_SIZE, ENEMY_SIZE)
      ctx.shadowBlur = 0

      // Draw on top (sharper)
      ctx.drawImage(sprite, e.x - half, e.y - half, ENEMY_SIZE, ENEMY_SIZE)
    }

    ctx.imageSmoothingEnabled = true
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
