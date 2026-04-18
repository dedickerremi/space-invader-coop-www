// ============================================================
// GameRenderer — Canvas 2D game rendering with pixel art sprites
// Framework-agnostic: pure TypeScript, uses Canvas API only
// ============================================================

import type { GameState } from './types'
import { getGameMeta } from './gameMeta'
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
  /** For sharp rendering on retina; logical size is unchanged */
  devicePixelRatio?: number
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

  /** Timestamp until which to show a subtle hit/kill flash (0 = off) */
  hitFlashUntil = 0

  constructor(canvas: HTMLCanvasElement, config?: RendererConfig) {
    const meta = getGameMeta()
    this.width = config?.width ?? meta.gameWidth
    this.height = config?.height ?? meta.gameHeight
    this.colors = { ...DEFAULT_COLORS, ...config?.colors }
    const dpr = config?.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1)

    canvas.width = this.width * dpr
    canvas.height = this.height * dpr
    canvas.style.width = `${this.width}px`
    canvas.style.height = `${this.height}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context not available')
    ctx.scale(dpr, dpr)
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

    // Draw player bullets (so they appear from the ship)
    this.renderBullets(state)

    // Draw enemies
    this.renderEnemies(state)

    // Draw power-ups (falling collectibles)
    this.renderPowerUps(state)

    // Draw pause indicator (when other player paused and we're not showing our own menu)
    if (state.paused && !this.showPauseOverlay) {
      this.renderPausedByOther()
    }

    // Subtle hit/kill flash (fade out over ~80ms)
    const now = performance.now()
    if (this.hitFlashUntil > 0 && now < this.hitFlashUntil) {
      const alpha = 0.15 * ((this.hitFlashUntil - now) / 80)
      if (alpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fillRect(0, 0, this.width, this.height)
      }
    }

    // Draw enemy bullets last so they're always visible all the way to the bottom
    this.renderEnemyBullets(state)

    // Sparks on top of everything (bullet collisions, etc.)
    this.renderSparks(state)
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
    const m = getGameMeta()

    // Disable smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false

    state.players.forEach((player, index) => {
      const isMe = player.id === this.localPlayerId
      const isInvincible = player.invincibleTimer > 0

      const playerY = player.y ?? m.playerY

      // --- Dead player: show respawn countdown (can move, cannot shoot) ---
      if (!player.alive) {
        const drawX = player.x - m.playerWidth / 2
        const drawY = playerY - m.playerHeight / 2

        if (player.lives > 0) {
          ctx.globalAlpha = 0.25
          ctx.drawImage(this.sprites.playerDead, drawX, drawY, m.playerWidth, m.playerHeight)
          ctx.globalAlpha = 1.0

          const seconds = Math.ceil(player.respawnTimer / 30)
          ctx.fillStyle = '#ffaa00'
          ctx.font = '14px JetBrains Mono, monospace'
          ctx.textAlign = 'center'
          ctx.fillText(`${seconds}s`, player.x, playerY - m.playerHeight / 2 - 8)
        } else {
          ctx.globalAlpha = 0.15
          ctx.drawImage(this.sprites.playerDead, drawX, drawY, m.playerWidth, m.playerHeight)
          ctx.globalAlpha = 1.0

          ctx.fillStyle = '#ff4444'
          ctx.font = '16px JetBrains Mono, monospace'
          ctx.textAlign = 'center'
          ctx.fillText('DEAD', player.x, playerY - m.playerHeight / 2 - 8)
        }

        ctx.fillStyle = '#666'
        ctx.font = '10px JetBrains Mono, monospace'
        ctx.textAlign = 'center'
        const label = isMe ? 'YOU' : `P${index + 1}`
        ctx.fillText(`${label}  ${'♥'.repeat(player.lives)}${'♡'.repeat(Math.max(0, 3 - player.lives))}`, player.x, playerY + m.playerHeight / 2 + 14)
        return
      }

      // --- Alive player ---
      let sprite: HTMLCanvasElement
      if (isMe) {
        sprite = this.sprites.player1
      } else {
        sprite = this.sprites.player2
      }

      const drawX = player.x - m.playerWidth / 2
      const drawY = playerY - m.playerHeight / 2

      // Invincibility: blink effect (flash every ~100ms)
      if (isInvincible) {
        const blink = Math.floor(now / 100) % 2 === 0
        ctx.globalAlpha = blink ? 1.0 : 0.3
      }

      // Glow effect
      const color = isMe ? this.colors.player1 : this.colors.player2
      ctx.shadowColor = isInvincible ? '#ffffff' : color
      ctx.shadowBlur = isInvincible ? 24 : 18
      ctx.drawImage(sprite, drawX, drawY, m.playerWidth, m.playerHeight)
      ctx.shadowBlur = 0

      // Draw sprite (on top of glow)
      ctx.drawImage(sprite, drawX, drawY, m.playerWidth, m.playerHeight)

      // Reset alpha
      ctx.globalAlpha = 1.0

      // Speed boost: motion trail behind ship
      if ((player.speedBoostTimer ?? 0) > 0) {
        const trailAlpha = 0.4 + 0.2 * Math.sin(now / 80)
        ctx.globalAlpha = trailAlpha
        ctx.fillStyle = '#ffdd00'
        for (let i = 1; i <= 3; i++) {
          ctx.globalAlpha = trailAlpha * (1 - i / 4)
          ctx.fillRect(drawX + 2, drawY + m.playerHeight + i * 3, m.playerWidth - 4, 2)
        }
        ctx.globalAlpha = 1.0
      }

      // Double-shot: yellow tint outline
      if ((player.doubleShotTimer ?? 0) > 0) {
        ctx.strokeStyle = '#ffdd00'
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 120)
        ctx.strokeRect(drawX - 2, drawY - 2, m.playerWidth + 4, m.playerHeight + 4)
        ctx.globalAlpha = 1.0
      }

      // Shield: cyan ring around ship
      if ((player.shieldTimer ?? 0) > 0) {
        const cx = player.x
        const cy = playerY
        const r = Math.max(m.playerWidth, m.playerHeight) * 0.85
        // Pulse stronger when shield is about to expire (< 30 ticks = 1s)
        const lowTime = player.shieldTimer < 30
        const pulse = lowTime ? 0.5 + 0.5 * Math.sin(now / 60) : 0.7 + 0.3 * Math.sin(now / 200)
        ctx.strokeStyle = '#00ddff'
        ctx.lineWidth = 2
        ctx.shadowColor = '#00ddff'
        ctx.shadowBlur = 12
        ctx.globalAlpha = pulse
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1.0
      }

      // Player label + lives + active buff timers
      ctx.fillStyle = '#fff'
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      const label = isMe ? 'YOU' : `P${index + 1}`
      let statusLine = `${label}  ${'♥'.repeat(player.lives)}${'♡'.repeat(Math.max(0, 3 - player.lives))}`
      const buffs: string[] = []
      if ((player.shieldTimer ?? 0) > 0) buffs.push(`🛡${Math.ceil(player.shieldTimer / 30)}s`)
      if ((player.doubleShotTimer ?? 0) > 0) buffs.push(`🔱${Math.ceil(player.doubleShotTimer / 30)}s`)
      if ((player.speedBoostTimer ?? 0) > 0) buffs.push(`⚡${Math.ceil(player.speedBoostTimer / 30)}s`)
      if (buffs.length > 0) statusLine += `  ${buffs.join(' ')}`
      ctx.fillText(statusLine, player.x, playerY + m.playerHeight / 2 + 14)
    })

    ctx.imageSmoothingEnabled = true
  }

  private renderBullets(state: GameState): void {
    const ctx = this.ctx
    const m = getGameMeta()

    // Disable smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false

    ctx.shadowColor = this.colors.bullet
    ctx.shadowBlur = 8

    for (const bullet of state.bullets) {
      ctx.drawImage(
        this.sprites.bullet,
        bullet.x - m.bulletWidth / 2,
        bullet.y - m.bulletHeight / 2,
        m.bulletWidth,
        m.bulletHeight,
      )
    }

    ctx.shadowBlur = 0
    ctx.imageSmoothingEnabled = true
  }

  private renderEnemies(state: GameState): void {
    const ctx = this.ctx
    const m = getGameMeta()
    const enemies = state.enemies ?? []

    // Pick animation frame based on time
    const elapsed = performance.now() - this.startTime
    const frame = Math.floor(elapsed / ENEMY_ANIM_INTERVAL) % 2

    // Disable smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false

    for (const e of enemies) {
      const isPatrol = e.type === 'patrol'
      const size = isPatrol ? m.patrolSize : m.enemySize
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
    const m = getGameMeta()
    const bullets = state.enemyBullets ?? []
    if (bullets.length === 0) return

    ctx.imageSmoothingEnabled = false
    ctx.shadowColor = ENEMY_BULLET_GLOW
    ctx.shadowBlur = 8

    for (const b of bullets) {
      ctx.drawImage(
        this.sprites.enemyBullet,
        b.x - m.enemyBulletWidth / 2,
        b.y - m.enemyBulletHeight / 2,
        m.enemyBulletWidth,
        m.enemyBulletHeight,
      )
    }

    ctx.shadowBlur = 0
    ctx.imageSmoothingEnabled = true
  }

  private renderPowerUps(state: GameState): void {
    const ctx = this.ctx
    const m = getGameMeta()
    const powerUps = state.powerUps ?? []
    if (powerUps.length === 0) return

    const elapsed = performance.now() - this.startTime
    const bob = Math.sin(elapsed / 200) * 2
    const half = m.powerUpSize / 2

    const STYLE: Record<string, { color: string; glyph: string }> = {
      extra_life:    { color: '#ff5577', glyph: '♥' },
      double_shot:   { color: '#ffdd00', glyph: '⫶' },
      speed_boost:   { color: '#33aaff', glyph: '⚡' },
      shield:        { color: '#00ddff', glyph: '◉' },
      points_bonus:  { color: '#ffcc00', glyph: '$' },
    }

    for (const pu of powerUps) {
      const style = STYLE[pu.kind] ?? { color: '#ffffff', glyph: '?' }
      const cx = pu.x
      const cy = pu.y + bob

      // Glow halo
      ctx.shadowColor = style.color
      ctx.shadowBlur = 14
      ctx.fillStyle = style.color
      ctx.globalAlpha = 0.25
      ctx.beginPath()
      ctx.arc(cx, cy, half + 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.globalAlpha = 1.0

      // Filled badge
      ctx.fillStyle = style.color
      ctx.beginPath()
      ctx.arc(cx, cy, half, 0, Math.PI * 2)
      ctx.fill()

      // Inner darker disc for contrast
      ctx.fillStyle = 'rgba(10, 10, 15, 0.85)'
      ctx.beginPath()
      ctx.arc(cx, cy, half - 3, 0, Math.PI * 2)
      ctx.fill()

      // Glyph
      ctx.fillStyle = style.color
      ctx.font = `bold ${Math.floor(m.powerUpSize * 0.65)}px JetBrains Mono, monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(style.glyph, cx, cy + 1)
      ctx.textBaseline = 'alphabetic'
    }
  }

  private renderSparks(state: GameState): void {
    const sparks = state.sparks ?? []
    if (sparks.length === 0) return

    const ctx = this.ctx
    ctx.save()
    ctx.imageSmoothingEnabled = true

    for (const sp of sparks) {
      const fade = sp.life > 0 ? Math.max(0, Math.min(1, sp.ttl / sp.life)) : 0
      if (fade <= 0) continue
      const radius = 3 + (1 - fade) * 7

      // Outer glow halo
      ctx.globalAlpha = fade * 0.4
      ctx.fillStyle = '#ffaa00'
      ctx.shadowColor = '#ffaa00'
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, radius * 1.6, 0, Math.PI * 2)
      ctx.fill()

      // Bright core
      ctx.globalAlpha = fade
      ctx.fillStyle = '#ffe066'
      ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, radius * 0.6, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
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
