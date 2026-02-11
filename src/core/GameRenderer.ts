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

// Additional colors not in RendererColors (internal)
const PATROL_COLOR = '#ff44ff'
const PATROL_GLOW = 'rgba(255, 68, 255, 0.6)'
const ENEMY_BULLET_COLOR = '#ff6644'
const ENEMY_BULLET_GLOW = 'rgba(255, 102, 68, 0.5)'

// --- Constants ---

const PLAYER_WIDTH = 40
const PLAYER_HEIGHT = 26
const PLAYER_Y = 550
const BULLET_WIDTH = 6
const BULLET_HEIGHT = 14
const ENEMY_BULLET_WIDTH = 6
const ENEMY_BULLET_HEIGHT = 10
const ENEMY_SIZE = 28
const PATROL_SIZE = 32

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
      enemyStatic: this.colors.enemy,
      enemyPatrol: PATROL_COLOR,
      bullet: this.colors.bullet,
      enemyBullet: ENEMY_BULLET_COLOR,
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

    // Draw enemy bullets
    this.renderEnemyBullets(state)

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
    const now = performance.now()

    // Disable smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false

    state.players.forEach((player, index) => {
      const isMe = player.id === this.localPlayerId
      const isInvincible = player.invincibleTimer > 0

      // --- Dead player: show respawn countdown ---
      if (!player.alive) {
        // Draw ghost sprite (faded)
        const ghostX = isMe ? 200 : 600 // show at spawn position
        const drawX = ghostX - PLAYER_WIDTH / 2
        const drawY = PLAYER_Y - PLAYER_HEIGHT / 2

        if (player.lives > 0) {
          // Faded ghost sprite
          ctx.globalAlpha = 0.25
          ctx.drawImage(this.sprites.playerDead, drawX, drawY, PLAYER_WIDTH, PLAYER_HEIGHT)
          ctx.globalAlpha = 1.0

          // Respawn countdown text
          const seconds = Math.ceil(player.respawnTimer / 30) // 30 ticks per second
          ctx.fillStyle = '#ffaa00'
          ctx.font = '14px JetBrains Mono, monospace'
          ctx.textAlign = 'center'
          ctx.fillText(`${seconds}s`, ghostX, PLAYER_Y - PLAYER_HEIGHT / 2 - 8)
        } else {
          // Permanently dead — dim "X"
          ctx.globalAlpha = 0.15
          ctx.drawImage(this.sprites.playerDead, drawX, drawY, PLAYER_WIDTH, PLAYER_HEIGHT)
          ctx.globalAlpha = 1.0

          ctx.fillStyle = '#ff4444'
          ctx.font = '16px JetBrains Mono, monospace'
          ctx.textAlign = 'center'
          ctx.fillText('DEAD', ghostX, PLAYER_Y - PLAYER_HEIGHT / 2 - 8)
        }

        // Player label + lives below
        ctx.fillStyle = '#666'
        ctx.font = '10px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        const label = isMe ? 'YOU' : `P${index + 1}`
        ctx.fillText(`${label}  ${'♥'.repeat(player.lives)}${'♡'.repeat(Math.max(0, 3 - player.lives))}`, ghostX, PLAYER_Y + PLAYER_HEIGHT / 2 + 14)
        return
      }

      // --- Alive player ---
      let sprite: HTMLCanvasElement
      if (isMe) {
        sprite = this.sprites.player1
      } else {
        sprite = this.sprites.player2
      }

      const drawX = player.x - PLAYER_WIDTH / 2
      const drawY = PLAYER_Y - PLAYER_HEIGHT / 2

      // Invincibility: blink effect (flash every ~100ms)
      if (isInvincible) {
        const blink = Math.floor(now / 100) % 2 === 0
        ctx.globalAlpha = blink ? 1.0 : 0.3
      }

      // Glow effect
      const color = isMe ? this.colors.player1 : this.colors.player2
      ctx.shadowColor = isInvincible ? '#ffffff' : color
      ctx.shadowBlur = isInvincible ? 24 : 18
      ctx.drawImage(sprite, drawX, drawY, PLAYER_WIDTH, PLAYER_HEIGHT)
      ctx.shadowBlur = 0

      // Draw sprite (on top of glow)
      ctx.drawImage(sprite, drawX, drawY, PLAYER_WIDTH, PLAYER_HEIGHT)

      // Reset alpha
      ctx.globalAlpha = 1.0

      // Player label + lives
      ctx.fillStyle = '#fff'
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      const label = isMe ? 'YOU' : `P${index + 1}`
      ctx.fillText(`${label}  ${'♥'.repeat(player.lives)}${'♡'.repeat(Math.max(0, 3 - player.lives))}`, player.x, PLAYER_Y + PLAYER_HEIGHT / 2 + 14)
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

    // Pick animation frame based on time
    const elapsed = performance.now() - this.startTime
    const frame = Math.floor(elapsed / ENEMY_ANIM_INTERVAL) % 2

    // Disable smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false

    for (const e of enemies) {
      const isPatrol = e.type === 'patrol'
      const size = isPatrol ? PATROL_SIZE : ENEMY_SIZE
      const half = size / 2
      const glowColor = isPatrol ? PATROL_GLOW : this.colors.enemyGlow

      // Pick sprite based on type + frame
      let sprite: HTMLCanvasElement
      if (isPatrol) {
        sprite = frame === 0 ? this.sprites.patrolA : this.sprites.patrolB
      } else {
        sprite = frame === 0 ? this.sprites.staticA : this.sprites.staticB
      }

      // Glow
      ctx.shadowColor = glowColor
      ctx.shadowBlur = 14
      ctx.drawImage(sprite, e.x - half, e.y - half, size, size)
      ctx.shadowBlur = 0

      // Draw on top (sharper)
      ctx.drawImage(sprite, e.x - half, e.y - half, size, size)
    }

    ctx.imageSmoothingEnabled = true
  }

  private renderEnemyBullets(state: GameState): void {
    const ctx = this.ctx
    const bullets = state.enemyBullets ?? []
    if (bullets.length === 0) return

    ctx.imageSmoothingEnabled = false
    ctx.shadowColor = ENEMY_BULLET_GLOW
    ctx.shadowBlur = 8

    for (const b of bullets) {
      ctx.drawImage(
        this.sprites.enemyBullet,
        b.x - ENEMY_BULLET_WIDTH / 2,
        b.y - ENEMY_BULLET_HEIGHT / 2,
        ENEMY_BULLET_WIDTH,
        ENEMY_BULLET_HEIGHT,
      )
    }

    ctx.shadowBlur = 0
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
