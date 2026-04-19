// ============================================================
// GameRenderer — Canvas 2D game rendering with pixel art sprites
// Framework-agnostic: pure TypeScript, uses Canvas API only
// ============================================================

import type { GameState } from './types'
import { getGameMeta } from './gameMeta'
import { createSpriteSheet, generateStars, generateNebula } from './Sprites'
import type { SpriteSheet, Star } from './Sprites'
import type { ShipKey } from './ships'

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
  /** Which player ship sprite to use. Defaults to 'fighter'. */
  shipKey?: ShipKey
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

// Shooting-star tuning
const METEOR_MIN_INTERVAL_MS = 3500
const METEOR_MAX_INTERVAL_MS = 9000
const METEOR_TRAIL_LEN = 90

type Meteor = {
  x: number
  y: number
  vx: number
  vy: number
  /** Age in ms */
  age: number
  /** Total lifetime in ms */
  ttl: number
}

// --- GameRenderer class ---

export class GameRenderer {
  private ctx: CanvasRenderingContext2D
  private animationId: number | null = null
  private colors: RendererColors

  // Sprites
  private sprites: SpriteSheet
  private stars: Star[]
  private nebula: HTMLCanvasElement
  private meteors: Meteor[] = []
  private lastMeteorSpawn = 0
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

  /** Vertical camera offset in world coords (world.y = screen.y + cameraY). 0 on desktop. */
  private cameraY = 0

  /** Per-player animation state (lateral tilt, last X) for visual polish. */
  private playerFx = new Map<string, { lastX: number; tiltRad: number }>()

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
    this.sprites = createSpriteSheet(
      {
        player1: this.colors.player1,
        player2: this.colors.player2,
        playerDead: this.colors.playerDead,
        enemyStatic: this.colors.enemy,
        enemyPatrol: PATROL_COLOR,
        bullet: this.colors.bullet,
        enemyBullet: ENEMY_BULLET_COLOR,
      },
      config?.shipKey,
    )

    // Generate background stars + pre-rendered nebula texture
    this.stars = generateStars(this.width, this.height)
    this.nebula = generateNebula(this.width, this.height)

    // Track time for animations
    this.startTime = performance.now()
    this.lastMeteorSpawn = this.startTime
  }

  /**
   * Render a single frame with the current state.
   */
  render(): void {
    const ctx = this.ctx
    const state = this.state

    // Clear with background (viewport space)
    ctx.fillStyle = this.colors.background
    ctx.fillRect(0, 0, this.width, this.height)

    // Nebula clouds behind everything (viewport space — backdrop stays fixed)
    ctx.drawImage(this.nebula, 0, 0)

    // Draw star field (viewport space — backdrop stays fixed)
    this.renderStars()

    // Shooting stars occasionally streak across the sky
    this.updateAndRenderMeteors()

    if (!state) return

    // Not started yet — waiting screen (viewport space)
    if (!state.started) {
      this.renderWaiting(state)
      return
    }

    // Track camera (vertical follow-player) if viewport is shorter than world
    this.updateCamera(state)

    // World-space rendering (all game entities positioned in logical world coords)
    ctx.save()
    if (this.cameraY !== 0) ctx.translate(0, -this.cameraY)

    this.renderPlayers(state)
    this.renderBullets(state)
    this.renderEnemies(state)
    this.renderPowerUps(state)
    this.renderEnemyBullets(state)
    this.renderSparks(state)

    ctx.restore()

    // Viewport-space overlays

    if (state.paused && !this.showPauseOverlay) {
      this.renderPausedByOther()
    }

    const now = performance.now()
    if (this.hitFlashUntil > 0 && now < this.hitFlashUntil) {
      const alpha = 0.15 * ((this.hitFlashUntil - now) / 80)
      if (alpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fillRect(0, 0, this.width, this.height)
      }
    }
  }

  /** Smooth-follow camera so the local player sits ~75% down the viewport. */
  private updateCamera(state: GameState): void {
    const worldHeight = getGameMeta().gameHeight
    if (this.height >= worldHeight) {
      this.cameraY = 0
      return
    }
    const lp = state.players.find((p) => p.id === this.localPlayerId)
    if (!lp) return
    const playerY = lp.y ?? getGameMeta().playerY
    const target = playerY - this.height * 0.75
    const clamped = Math.max(0, Math.min(worldHeight - this.height, target))
    // Lerp toward target for smooth follow
    this.cameraY += (clamped - this.cameraY) * 0.15
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
      const rgb = star.tint === 1 ? '180, 210, 255' : star.tint === 2 ? '255, 220, 170' : '255, 255, 255'
      ctx.fillStyle = `rgba(${rgb}, ${alpha})`
      ctx.fillRect(star.x, star.y, star.size, star.size)

      // Rare bright stars get a soft cross-flare overlay for a cosmic feel.
      if (star.flare && alpha > 0.3) {
        const cx = star.x + star.size / 2
        const cy = star.y + star.size / 2
        const reach = 3 + twinkle * 2
        ctx.strokeStyle = `rgba(${rgb}, ${alpha * 0.55})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx - reach, cy)
        ctx.lineTo(cx + reach, cy)
        ctx.moveTo(cx, cy - reach)
        ctx.lineTo(cx, cy + reach)
        ctx.stroke()
      }
    }
  }

  /**
   * Spawn a shooting star occasionally and advance existing ones.
   * Trails fade over their lifetime; expired meteors are pruned.
   */
  private updateAndRenderMeteors(): void {
    const ctx = this.ctx
    const now = performance.now()

    // Stochastic spawn at a random interval.
    if (now - this.lastMeteorSpawn > METEOR_MIN_INTERVAL_MS) {
      const chancePerFrame = 1 / 180 // ~3s @60fps after min interval elapsed
      const forceSpawn = now - this.lastMeteorSpawn > METEOR_MAX_INTERVAL_MS
      if (forceSpawn || Math.random() < chancePerFrame) {
        this.spawnMeteor()
        this.lastMeteorSpawn = now
      }
    }

    if (this.meteors.length === 0) return

    const survivors: Meteor[] = []
    for (const m of this.meteors) {
      // Assume ~60fps; advance state per frame rather than wall-clock to keep trail consistent.
      m.age += 16.67
      m.x += m.vx
      m.y += m.vy

      if (m.age >= m.ttl || m.x < -120 || m.x > this.width + 120 || m.y > this.height + 120) {
        continue
      }
      survivors.push(m)

      // Fade in quickly, then fade out across the full lifetime.
      const fadeIn = Math.min(1, m.age / 180)
      const life = 1 - m.age / m.ttl
      const alpha = fadeIn * life

      // Trail: line segment behind the head along the motion vector.
      const len = METEOR_TRAIL_LEN
      const mag = Math.hypot(m.vx, m.vy) || 1
      const tx = m.x - (m.vx / mag) * len
      const ty = m.y - (m.vy / mag) * len

      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty)
      grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`)
      grad.addColorStop(0.4, `rgba(180, 210, 255, ${alpha * 0.6})`)
      grad.addColorStop(1, 'rgba(120, 160, 220, 0)')

      ctx.save()
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.5
      ctx.shadowColor = 'rgba(200, 220, 255, 0.8)'
      ctx.shadowBlur = 6
      ctx.beginPath()
      ctx.moveTo(m.x, m.y)
      ctx.lineTo(tx, ty)
      ctx.stroke()

      // Bright head dot.
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
      ctx.beginPath()
      ctx.arc(m.x, m.y, 1.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
    this.meteors = survivors
  }

  private spawnMeteor(): void {
    // Launch from the top-ish, travel down-and-across at a shallow angle.
    const fromLeft = Math.random() < 0.5
    const startX = fromLeft ? -60 : this.width + 60
    const startY = Math.random() * this.height * 0.5
    const speed = 6 + Math.random() * 4
    const angle = (Math.PI / 180) * (fromLeft ? 20 + Math.random() * 25 : 155 + Math.random() * 25)
    this.meteors.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      ttl: 900 + Math.random() * 700,
    })
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
        const label = player.displayName ?? (isMe ? 'YOU' : `P${index + 1}`)
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

      // Lateral tilt: derive velocity from X delta, lerp a small roll angle.
      const fx = this.playerFx.get(player.id) ?? { lastX: player.x, tiltRad: 0 }
      const dx = player.x - fx.lastX
      const MAX_TILT = 0.28
      const TILT_GAIN = 0.045
      const targetTilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, dx * TILT_GAIN))
      fx.tiltRad += (targetTilt - fx.tiltRad) * 0.18
      fx.lastX = player.x
      this.playerFx.set(player.id, fx)

      // Invincibility: blink effect (flash every ~100ms)
      if (isInvincible) {
        const blink = Math.floor(now / 100) % 2 === 0
        ctx.globalAlpha = blink ? 1.0 : 0.3
      }

      const color = isMe ? this.colors.player1 : this.colors.player2

      // Thruster flame (drawn in world space, below ship, before sprite)
      this.renderThruster(player.x, playerY, m.playerHeight, fx.tiltRad, color, now)

      // Draw rotated sprite (glow pass + sharp pass)
      ctx.save()
      ctx.translate(player.x, playerY)
      ctx.rotate(fx.tiltRad)
      ctx.shadowColor = isInvincible ? '#ffffff' : color
      ctx.shadowBlur = isInvincible ? 24 : 18
      ctx.drawImage(sprite, -m.playerWidth / 2, -m.playerHeight / 2, m.playerWidth, m.playerHeight)
      ctx.shadowBlur = 0
      ctx.drawImage(sprite, -m.playerWidth / 2, -m.playerHeight / 2, m.playerWidth, m.playerHeight)
      ctx.restore()

      // For HUD/overlay math below
      const drawX = player.x - m.playerWidth / 2
      const drawY = playerY - m.playerHeight / 2

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
      const label = player.displayName ?? (isMe ? 'YOU' : `P${index + 1}`)
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

  /**
   * Draw a small flickering thruster flame below the player, aligned with the ship's tilt.
   * Flame intensity grows with lateral speed; a subtle idle shimmer stays when stationary.
   */
  private renderThruster(
    x: number,
    y: number,
    playerHeight: number,
    tiltRad: number,
    color: string,
    now: number,
  ): void {
    const ctx = this.ctx
    const speed = Math.min(1, Math.abs(tiltRad) / 0.28)
    const flicker = 0.7 + 0.3 * Math.sin(now / 60)
    const baseLen = playerHeight * 0.35
    const flameLen = baseLen * (0.4 + 0.9 * speed) * flicker
    const flameHalfW = playerHeight * 0.18 * (0.6 + 0.4 * speed)

    ctx.save()
    ctx.translate(x, y + playerHeight * 0.4)
    ctx.rotate(tiltRad)

    // Outer glow halo
    ctx.shadowColor = color
    ctx.shadowBlur = 14
    ctx.fillStyle = color
    ctx.globalAlpha = 0.35 + 0.25 * speed
    ctx.beginPath()
    ctx.moveTo(-flameHalfW, 0)
    ctx.lineTo(flameHalfW, 0)
    ctx.lineTo(0, flameLen)
    ctx.closePath()
    ctx.fill()

    // Hot core
    ctx.shadowBlur = 0
    ctx.fillStyle = '#ffe8a8'
    ctx.globalAlpha = 0.8 * flicker
    ctx.beginPath()
    ctx.moveTo(-flameHalfW * 0.45, 0)
    ctx.lineTo(flameHalfW * 0.45, 0)
    ctx.lineTo(0, flameLen * 0.7)
    ctx.closePath()
    ctx.fill()

    ctx.globalAlpha = 1
    ctx.restore()
  }

  private renderBullets(state: GameState): void {
    const ctx = this.ctx
    const m = getGameMeta()
    if (state.bullets.length === 0) return

    // Disable smoothing for crisp pixel art
    ctx.imageSmoothingEnabled = false

    // Glow pass (blurred)
    ctx.shadowColor = this.colors.bullet
    ctx.shadowBlur = 12
    for (const bullet of state.bullets) {
      ctx.drawImage(
        this.sprites.bullet,
        bullet.x - m.bulletWidth / 2,
        bullet.y - m.bulletHeight / 2,
        m.bulletWidth,
        m.bulletHeight,
      )
    }

    // Sharp pass (no blur, on top — makes the core pop)
    ctx.shadowBlur = 0
    for (const bullet of state.bullets) {
      ctx.drawImage(
        this.sprites.bullet,
        bullet.x - m.bulletWidth / 2,
        bullet.y - m.bulletHeight / 2,
        m.bulletWidth,
        m.bulletHeight,
      )
    }

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
