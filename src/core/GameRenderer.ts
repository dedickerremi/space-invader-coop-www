// ============================================================
// GameRenderer — Canvas 2D game rendering with pixel art sprites
// Framework-agnostic: pure TypeScript, uses Canvas API only
// ============================================================

import type { Boss, Carrier, GameState } from "./types"
import { hasDoubleShot, hasSpeedBoost, secondsLeft, shieldCharges } from "./buffs"
import { startingLives } from "./difficulty"
import { getGameMeta } from "./gameMeta"
import { createSpriteSheet, generateStars, generateNebula } from "./Sprites"
import type { SpriteSheet, Star } from "./Sprites"
import { SHIPS } from "./ships"
import type { ShipKey } from "./ships"
import {
  ENEMY_VISUAL_SIZE,
  BULLET_VISUAL_SIZE,
  POWERUP_VISUAL_SIZE,
  BOSS_VISUAL_SIZE,
} from "./svgSprites"

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
  /**
   * Optional pre-built sprite sheet (e.g. SVG-rasterized).
   * When provided, the renderer uses this instead of building one from
   * the pixel-art generator, and draws ships at the ship's
   * visualWidth/visualHeight (decoupled from the hitbox).
   */
  spriteSheet?: SpriteSheet
}

export const DEFAULT_COLORS: RendererColors = {
  player1: "#00ff88",
  player2: "#00aaff",
  playerDead: "#333",
  bullet: "#ffff00",
  enemy: "#ff4444",
  enemyGlow: "rgba(255, 68, 68, 0.6)",
  background: "#050508",
}

// Additional colors not in RendererColors (internal)
export const PATROL_COLOR = "#ff44ff"
const PATROL_GLOW = "rgba(255, 68, 255, 0.6)"
export const ENEMY_BULLET_COLOR = "#ff6644"
const ENEMY_BULLET_GLOW = "rgba(255, 102, 68, 0.5)"

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

// --- Bonus carriers ---

/** Colour and glyph per bonus, shared by falling bonuses and carriers. */
const POWER_UP_STYLE: Record<string, { color: string; glyph: string }> = {
  extra_life: { color: "#ff5577", glyph: "♥" },
  double_shot: { color: "#ffdd00", glyph: "⫶" },
  speed_boost: { color: "#33aaff", glyph: "⚡" },
  shield: { color: "#00ddff", glyph: "◉" },
  points_bonus: { color: "#ffcc00", glyph: "$" },
}

// Carrier sizes and toughness mirror the server's hitboxes (carriers.go).
const ASTEROID_RADIUS = 18
const ASTEROID_MAX_HP = 3
const COURIER_WIDTH = 44
const COURIER_HEIGHT = 24
const COURIER_MAX_HP = 2
/** Radius multipliers giving every asteroid the same lumpy outline. */
const ASTEROID_LUMPS = [1, 0.82, 0.96, 0.78, 1.05, 0.86, 0.98, 0.8, 0.93]

// --- GameRenderer class ---

export class GameRenderer {
  private ctx: CanvasRenderingContext2D
  private animationId: number | null = null
  private colors: RendererColors

  // Sprites
  private sprites: SpriteSheet
  /** True when an externally-built (SVG) sheet is in use — turns on the
   *  decoupled visual sizes for enemies/bullets/power-ups and the
   *  sprite-driven power-up render path. */
  private useSvgSprites: boolean
  /** Visual draw size for player ship — may exceed hitbox to preserve aspect. */
  private playerVisualWidth: number
  private playerVisualHeight: number
  /** Visual draw size for enemies (decoupled from hitbox in SVG mode). */
  private enemyGruntVisW: number
  private enemyGruntVisH: number
  private enemyPatrolVisW: number
  private enemyPatrolVisH: number
  /** Visual draw size for bullets (decoupled from hitbox in SVG mode). */
  private bulletVisW: number
  private bulletVisH: number
  private enemyBulletVisW: number
  private enemyBulletVisH: number
  /** Visual draw size for power-ups (decoupled from hitbox in SVG mode). */
  private powerUpVisSize: number
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
    const dpr =
      config?.devicePixelRatio ??
      (typeof window !== "undefined" ? window.devicePixelRatio : 1)

    canvas.width = this.width * dpr
    canvas.height = this.height * dpr
    canvas.style.width = `${this.width}px`
    canvas.style.height = `${this.height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas 2D context not available")
    ctx.scale(dpr, dpr)
    this.ctx = ctx

    // Generate sprites — accept an externally-built sheet (e.g. SVG) or
    // build one from the pixel-art generator.
    if (config?.spriteSheet) {
      this.sprites = config.spriteSheet
      this.useSvgSprites = true
      const ship = SHIPS[config.shipKey ?? "fighter"]
      this.playerVisualWidth = ship.visualWidth
      this.playerVisualHeight = ship.visualHeight
      this.enemyGruntVisW = ENEMY_VISUAL_SIZE.grunt.w
      this.enemyGruntVisH = ENEMY_VISUAL_SIZE.grunt.h
      this.enemyPatrolVisW = ENEMY_VISUAL_SIZE.patrol.w
      this.enemyPatrolVisH = ENEMY_VISUAL_SIZE.patrol.h
      this.bulletVisW = BULLET_VISUAL_SIZE.player.w
      this.bulletVisH = BULLET_VISUAL_SIZE.player.h
      this.enemyBulletVisW = BULLET_VISUAL_SIZE.enemy.w
      this.enemyBulletVisH = BULLET_VISUAL_SIZE.enemy.h
      this.powerUpVisSize = POWERUP_VISUAL_SIZE
    } else {
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
      this.useSvgSprites = false
      this.playerVisualWidth = meta.playerWidth
      this.playerVisualHeight = meta.playerHeight
      // Pixel-art mode: visual size matches hitbox (preserves prior behavior).
      this.enemyGruntVisW = meta.enemySize
      this.enemyGruntVisH = meta.enemySize
      this.enemyPatrolVisW = meta.patrolSize
      this.enemyPatrolVisH = meta.patrolSize
      this.bulletVisW = meta.bulletWidth
      this.bulletVisH = meta.bulletHeight
      this.enemyBulletVisW = meta.enemyBulletWidth
      this.enemyBulletVisH = meta.enemyBulletHeight
      this.powerUpVisSize = meta.powerUpSize
    }

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
    this.renderCarriers(state)
    if (state.boss) this.renderBoss(state.boss)
    this.renderPowerUps(state)
    this.renderEnemyBullets(state)
    this.renderSparks(state)

    ctx.restore()

    // Viewport-space overlays
    if (state.boss) this.renderBossHud(state.boss)
    this.renderScrollIndicator()

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
      const rgb =
        star.tint === 1
          ? "180, 210, 255"
          : star.tint === 2
            ? "255, 220, 170"
            : "255, 255, 255"
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

      if (
        m.age >= m.ttl ||
        m.x < -120 ||
        m.x > this.width + 120 ||
        m.y > this.height + 120
      ) {
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
      grad.addColorStop(1, "rgba(120, 160, 220, 0)")

      ctx.save()
      ctx.strokeStyle = grad
      ctx.lineWidth = 1.5
      ctx.shadowColor = "rgba(200, 220, 255, 0.8)"
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
    const angle =
      (Math.PI / 180) *
      (fromLeft ? 20 + Math.random() * 25 : 155 + Math.random() * 25)
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
    ctx.fillStyle = "#666"
    ctx.font = "24px JetBrains Mono, monospace"
    ctx.textAlign = "center"
    ctx.fillText("Waiting for opponent...", this.width / 2, this.height / 2)
    ctx.font = "14px JetBrains Mono, monospace"
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

      // --- Dead player (permadead: 0 lives left). Instant-respawn feature means
      //     a non-zero life-count player is always rendered alive with an
      //     invincibility flicker handled below. ---
      if (!player.alive) {
        const visW = this.playerVisualWidth
        const visH = this.playerVisualHeight
        const drawX = player.x - visW / 2
        const drawY = playerY - visH / 2

        ctx.globalAlpha = 0.15
        ctx.drawImage(this.sprites.playerDead, drawX, drawY, visW, visH)
        ctx.globalAlpha = 1.0

        ctx.fillStyle = "#ff4444"
        ctx.font = "16px JetBrains Mono, monospace"
        ctx.textAlign = "center"
        ctx.fillText("DEAD", player.x, playerY - m.playerHeight / 2 - 8)

        ctx.fillStyle = "#666"
        ctx.font = "10px JetBrains Mono, monospace"
        ctx.textAlign = "center"
        const label = player.displayName ?? (isMe ? "YOU" : `P${index + 1}`)
        ctx.fillText(
          `${label}  ${"♥".repeat(player.lives)}${"♡".repeat(Math.max(0, 3 - player.lives))}`,
          player.x,
          playerY + m.playerHeight / 2 + 14,
        )
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
      this.renderThruster(
        player.x,
        playerY,
        m.playerHeight,
        fx.tiltRad,
        color,
        now,
      )

      // Draw rotated sprite at the ship's visual size (decoupled from hitbox).
      const visW = this.playerVisualWidth
      const visH = this.playerVisualHeight
      ctx.save()
      ctx.translate(player.x, playerY)
      ctx.rotate(fx.tiltRad)
      ctx.shadowColor = isInvincible ? "#ffffff" : color
      ctx.shadowBlur = isInvincible ? 24 : 18
      ctx.drawImage(sprite, -visW / 2, -visH / 2, visW, visH)
      ctx.shadowBlur = 0
      ctx.drawImage(sprite, -visW / 2, -visH / 2, visW, visH)
      ctx.restore()

      // For HUD/overlay math below
      const drawX = player.x - m.playerWidth / 2
      const drawY = playerY - m.playerHeight / 2

      // Reset alpha
      ctx.globalAlpha = 1.0

      // Speed boost: motion trail behind ship
      if (hasSpeedBoost(player)) {
        const trailAlpha = 0.4 + 0.2 * Math.sin(now / 80)
        ctx.globalAlpha = trailAlpha
        ctx.fillStyle = "#ffdd00"
        for (let i = 1; i <= 3; i++) {
          ctx.globalAlpha = trailAlpha * (1 - i / 4)
          ctx.fillRect(
            drawX + 2,
            drawY + m.playerHeight + i * 3,
            m.playerWidth - 4,
            2,
          )
        }
        ctx.globalAlpha = 1.0
      }

      // Double-shot: yellow tint outline
      if (hasDoubleShot(player)) {
        ctx.strokeStyle = "#ffdd00"
        ctx.lineWidth = 2
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(now / 120)
        ctx.strokeRect(
          drawX - 2,
          drawY - 2,
          m.playerWidth + 4,
          m.playerHeight + 4,
        )
        ctx.globalAlpha = 1.0
      }

      // Shield: cyan ring around ship, thicker for each hit it can still
      // absorb, flickering on its last one.
      const charges = shieldCharges(player)
      if (charges > 0) {
        const cx = player.x
        const cy = playerY
        const r = Math.max(m.playerWidth, m.playerHeight) * 0.85
        const lastCharge = charges === 1
        const pulse = lastCharge
          ? 0.5 + 0.5 * Math.sin(now / 60)
          : 0.7 + 0.3 * Math.sin(now / 200)
        ctx.strokeStyle = "#00ddff"
        ctx.lineWidth = 1 + charges
        ctx.shadowColor = "#00ddff"
        ctx.shadowBlur = 12
        ctx.globalAlpha = pulse
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1.0
      }

      // Player label + lives + active buff timers
      ctx.fillStyle = "#fff"
      ctx.font = "10px JetBrains Mono, monospace"
      ctx.textAlign = "center"
      const label = player.displayName ?? (isMe ? "YOU" : `P${index + 1}`)
      // Empty hearts count down from the lives this difficulty starts with.
      const maxLives = startingLives(state.difficulty)
      let statusLine = `${label}  ${"♥".repeat(player.lives)}${"♡".repeat(Math.max(0, maxLives - player.lives))}`
      // Lasting bonuses show no countdown; the shield shows its hits left.
      // Timed bonuses (older servers) keep their seconds.
      const buffs: string[] = []
      if (charges > 0) {
        const secs = secondsLeft(player.shieldTimer, player.shieldCharges)
        buffs.push(secs !== null ? `🛡${secs}s` : `🛡×${charges}`)
      }
      if (hasDoubleShot(player)) {
        const secs = secondsLeft(player.doubleShotTimer, player.doubleShot)
        buffs.push(secs !== null ? `🔱${secs}s` : "🔱")
      }
      if (hasSpeedBoost(player)) {
        const secs = secondsLeft(player.speedBoostTimer, player.speedBoost)
        buffs.push(secs !== null ? `⚡${secs}s` : "⚡")
      }
      if (buffs.length > 0) statusLine += `  ${buffs.join(" ")}`
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
    ctx.fillStyle = "#ffe8a8"
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
    if (state.bullets.length === 0) return

    const w = this.bulletVisW
    const h = this.bulletVisH

    // Crisp pixel art needs no smoothing; SVG-rasterized sprites render
    // best with smoothing on (the canvas was rasterized at 4× DPR).
    ctx.imageSmoothingEnabled = this.useSvgSprites

    // Glow pass (blurred)
    ctx.shadowColor = this.colors.bullet
    ctx.shadowBlur = 12
    for (const bullet of state.bullets) {
      ctx.drawImage(
        this.sprites.bullet,
        bullet.x - w / 2,
        bullet.y - h / 2,
        w,
        h,
      )
    }

    // Sharp pass (no blur, on top — makes the core pop)
    ctx.shadowBlur = 0
    for (const bullet of state.bullets) {
      ctx.drawImage(
        this.sprites.bullet,
        bullet.x - w / 2,
        bullet.y - h / 2,
        w,
        h,
      )
    }

    ctx.imageSmoothingEnabled = true
  }

  private renderEnemies(state: GameState): void {
    const ctx = this.ctx
    const enemies = state.enemies ?? []

    // Pick animation frame based on time
    const elapsed = performance.now() - this.startTime
    const frame = Math.floor(elapsed / ENEMY_ANIM_INTERVAL) % 2

    ctx.imageSmoothingEnabled = this.useSvgSprites

    for (const e of enemies) {
      const isPatrol = e.type === "patrol"
      const visW = isPatrol ? this.enemyPatrolVisW : this.enemyGruntVisW
      const visH = isPatrol ? this.enemyPatrolVisH : this.enemyGruntVisH
      const dx = e.x - visW / 2
      const dy = e.y - visH / 2
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
      ctx.drawImage(sprite, dx, dy, visW, visH)
      ctx.shadowBlur = 0

      // Draw on top (sharper)
      ctx.drawImage(sprite, dx, dy, visW, visH)
    }

    ctx.imageSmoothingEnabled = true
  }

  private renderEnemyBullets(state: GameState): void {
    const ctx = this.ctx
    const bullets = state.enemyBullets ?? []
    if (bullets.length === 0) return

    const w = this.enemyBulletVisW
    const h = this.enemyBulletVisH

    ctx.imageSmoothingEnabled = this.useSvgSprites

    for (const b of bullets) {
      let sprite: HTMLCanvasElement
      let glow: string

      if (b.kind === "aimed") {
        sprite = this.sprites.enemyBulletAimed
        glow = "rgba(255, 154, 31, 0.65)"
      } else if (b.kind === "comet") {
        sprite = this.sprites.enemyBulletComet
        glow = "rgba(111, 168, 255, 0.7)"

        // Motion trail — 4 fading copies opposite velocity vector.
        const mag = Math.hypot(b.dx, b.dy) || 1
        const nx = -b.dx / mag
        const ny = -b.dy / mag
        ctx.shadowColor = glow
        ctx.shadowBlur = 10
        for (let i = 4; i >= 1; i--) {
          const alpha = 0.45 * (1 - i / 5)
          const tx = b.x + nx * i * 5
          const ty = b.y + ny * i * 5
          ctx.globalAlpha = alpha
          ctx.drawImage(sprite, tx - w / 2, ty - h / 2, w, h)
        }
        ctx.globalAlpha = 1
      } else {
        sprite = this.sprites.enemyBullet
        glow = ENEMY_BULLET_GLOW
      }

      ctx.shadowColor = glow
      ctx.shadowBlur = 8
      ctx.drawImage(sprite, b.x - w / 2, b.y - h / 2, w, h)
    }

    ctx.shadowBlur = 0
    ctx.imageSmoothingEnabled = true
  }

  /**
   * Bonus carriers: asteroids tumble across with their bonus glowing inside;
   * the goblin's courier crosses the top towing its bonus. Pips underneath
   * show how many hits are left.
   */
  private renderCarriers(state: GameState): void {
    const carriers = state.carriers ?? []
    if (carriers.length === 0) return
    const now = performance.now()
    for (const c of carriers) {
      if (c.kind === "courier") this.drawCourier(c, now)
      else this.drawAsteroid(c)
      this.drawCarriedBonus(c, now)
      this.drawCarrierPips(c)
    }
  }

  private drawAsteroid(c: Carrier): void {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(c.x, c.y)
    // Tumble with distance travelled, so it rolls rather than spins in place.
    ctx.rotate((c.x + c.y) / 40)
    ctx.beginPath()
    ASTEROID_LUMPS.forEach((k, i) => {
      const a = (i / ASTEROID_LUMPS.length) * Math.PI * 2
      const px = Math.cos(a) * ASTEROID_RADIUS * k
      const py = Math.sin(a) * ASTEROID_RADIUS * k
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.fillStyle = "#5b4a3d"
    ctx.fill()
    ctx.strokeStyle = "#a38a70"
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)"
    for (const [x, y, r] of [
      [-7, -5, 4],
      [6, 6, 3],
      [8, -7, 2.5],
    ]) {
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawCourier(c: Carrier, now: number): void {
    const ctx = this.ctx
    const w = COURIER_WIDTH
    const h = COURIER_HEIGHT
    ctx.save()
    ctx.translate(c.x, c.y)

    // Saucer hull with blinking rim lights.
    ctx.fillStyle = "#3d7a5a"
    ctx.strokeStyle = "#9fe0b8"
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.ellipse(0, 4, w / 2, h / 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    const blink = Math.floor(now / 150)
    for (let i = -2; i <= 2; i++) {
      ctx.fillStyle = (blink + i) % 2 === 0 ? "#ffe066" : "#6b5a2a"
      ctx.beginPath()
      ctx.arc(i * 8, 6, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }

    // The goblin: green head, pointy ears, grin.
    ctx.fillStyle = "#7ccf5a"
    ctx.beginPath()
    ctx.arc(0, -3, 5, 0, Math.PI * 2)
    ctx.fill()
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(side * 4, -5)
      ctx.lineTo(side * 11, -9)
      ctx.lineTo(side * 4, -1)
      ctx.closePath()
      ctx.fill()
    }
    ctx.fillStyle = "#1a1a1a"
    ctx.beginPath()
    ctx.arc(-2, -4, 1, 0, Math.PI * 2)
    ctx.arc(2, -4, 1, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "#1a1a1a"
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.arc(0, -2.5, 2.2, 0.2 * Math.PI, 0.8 * Math.PI)
    ctx.stroke()

    // Glass dome over the pilot.
    ctx.fillStyle = "rgba(170, 230, 255, 0.28)"
    ctx.strokeStyle = "rgba(200, 240, 255, 0.7)"
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(0, 1, 10, Math.PI, 0)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }

  /** The bonus a carrier releases: inside an asteroid, towed under a courier. */
  private drawCarriedBonus(c: Carrier, now: number): void {
    const ctx = this.ctx
    const style = POWER_UP_STYLE[c.drop] ?? { color: "#ffffff", glyph: "?" }
    const towed = c.kind === "courier"
    const bx = c.x
    const by = towed ? c.y + 22 + Math.sin(now / 180) * 1.5 : c.y

    if (towed) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(c.x, c.y + COURIER_HEIGHT / 3)
      ctx.lineTo(bx, by - 8)
      ctx.stroke()
    }

    // Smaller inside an asteroid, so it still reads as a rock.
    const radius = towed ? 8 : 6
    ctx.save()
    ctx.shadowColor = style.color
    ctx.shadowBlur = 10
    ctx.fillStyle = "rgba(10, 10, 15, 0.85)"
    ctx.beginPath()
    ctx.arc(bx, by, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = style.color
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = style.color
    ctx.font = `bold ${towed ? 11 : 8}px JetBrains Mono, monospace`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(style.glyph, bx, by + 1)
    ctx.textBaseline = "alphabetic"
    ctx.restore()
  }

  private drawCarrierPips(c: Carrier): void {
    const ctx = this.ctx
    const max = c.kind === "courier" ? COURIER_MAX_HP : ASTEROID_MAX_HP
    const y = c.y + (c.kind === "courier" ? 36 : ASTEROID_RADIUS + 8)
    for (let i = 0; i < max; i++) {
      ctx.fillStyle = i < c.hp ? "#ffffff" : "rgba(255, 255, 255, 0.2)"
      ctx.beginPath()
      ctx.arc(c.x + (i - (max - 1) / 2) * 6, y, 1.6, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private renderPowerUps(state: GameState): void {
    const ctx = this.ctx
    const m = getGameMeta()
    const powerUps = state.powerUps ?? []
    if (powerUps.length === 0) return

    const elapsed = performance.now() - this.startTime
    const bob = Math.sin(elapsed / 200) * 2
    const half = m.powerUpSize / 2

    const STYLE = POWER_UP_STYLE

    // SVG sprites the handoff delivered (only 2 of 5 kinds).
    const svgKindToSprite: Partial<Record<string, HTMLCanvasElement>> = this
      .useSvgSprites
      ? {
          speed_boost: this.sprites.powerUpSpeed,
          double_shot: this.sprites.powerUpMultishot,
        }
      : {}

    const visSize = this.powerUpVisSize
    const visHalf = visSize / 2

    for (const pu of powerUps) {
      const style = STYLE[pu.kind] ?? { color: "#ffffff", glyph: "?" }
      const cx = pu.x
      const cy = pu.y + bob

      const sprite = svgKindToSprite[pu.kind]
      if (sprite) {
        // SVG path — soft halo + sprite, skips the ad-hoc disc/glyph.
        ctx.save()
        ctx.shadowColor = style.color
        ctx.shadowBlur = 14
        ctx.fillStyle = style.color
        ctx.globalAlpha = 0.22
        ctx.beginPath()
        ctx.arc(cx, cy, visHalf + 1, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
        ctx.shadowBlur = 0
        ctx.imageSmoothingEnabled = true
        ctx.drawImage(sprite, cx - visHalf, cy - visHalf, visSize, visSize)
        ctx.restore()
        continue
      }

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
      ctx.fillStyle = "rgba(10, 10, 15, 0.85)"
      ctx.beginPath()
      ctx.arc(cx, cy, half - 3, 0, Math.PI * 2)
      ctx.fill()

      // Glyph
      ctx.fillStyle = style.color
      ctx.font = `bold ${Math.floor(m.powerUpSize * 0.65)}px JetBrains Mono, monospace`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(style.glyph, cx, cy + 1)
      ctx.textBaseline = "alphabetic"
    }
  }

  private renderSparks(state: GameState): void {
    const sparks = state.sparks ?? []
    if (sparks.length === 0) return

    const ctx = this.ctx

    // SVG path: 3-frame explosion animation chosen by remaining life.
    // Sprites are 48x48 in their viewBox; we draw at ~36px to feel punchy
    // without overpowering the entity that just got hit.
    const f1 = this.sprites.explosion1
    const f2 = this.sprites.explosion2
    const f3 = this.sprites.explosion3
    if (this.useSvgSprites && f1 && f2 && f3) {
      const drawSize = 36
      const half = drawSize / 2
      ctx.save()
      ctx.imageSmoothingEnabled = true
      for (const sp of sparks) {
        const fade =
          sp.life > 0 ? Math.max(0, Math.min(1, sp.ttl / sp.life)) : 0
        if (fade <= 0) continue
        // life ratio: 1 at birth → 0 at death. Pick frame as it ages.
        const sprite = fade > 0.66 ? f1 : fade > 0.33 ? f2 : f3
        // Slight scale-out + alpha fade so each spark eases.
        const scale = 0.85 + (1 - fade) * 0.35
        const w = drawSize * scale
        const h = drawSize * scale
        ctx.globalAlpha = fade
        ctx.drawImage(sprite, sp.x - w / 2, sp.y - h / 2, w, h)
      }
      ctx.globalAlpha = 1
      ctx.restore()
      return
    }

    // Pixel-art path — preserved unchanged.
    ctx.save()
    ctx.imageSmoothingEnabled = true

    for (const sp of sparks) {
      const fade = sp.life > 0 ? Math.max(0, Math.min(1, sp.ttl / sp.life)) : 0
      if (fade <= 0) continue
      const radius = 3 + (1 - fade) * 7

      // Outer glow halo
      ctx.globalAlpha = fade * 0.4
      ctx.fillStyle = "#ffaa00"
      ctx.shadowColor = "#ffaa00"
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, radius * 1.6, 0, Math.PI * 2)
      ctx.fill()

      // Bright core
      ctx.globalAlpha = fade
      ctx.fillStyle = "#ffe066"
      ctx.shadowBlur = 0
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, radius * 0.6, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  // --- Bosses ---

  private renderBoss(boss: Boss): void {
    const now = performance.now()
    if (
      this.useSvgSprites &&
      this.sprites.bossIdle &&
      this.sprites.bossCharge &&
      this.sprites.bossAngry
    ) {
      this.renderBossSvg(boss, now)
      return
    }
    switch (boss.kind) {
      case "sentinel":
        this.renderSentinel(boss, now)
        break
      case "warden":
        this.renderWarden(boss, now)
        break
      case "citadel":
        this.renderCitadel(boss, now)
        break
      case "nexus":
        this.renderNexus(boss, now)
        break
    }
  }

  /**
   * SVG boss — single design with mood (idle / charge / angry) chosen
   * from HP% and shield state. Backend kind doesn't affect the sprite
   * (the handoff delivers one boss design); kind still drives audio
   * and the HUD label elsewhere.
   */
  private renderBossSvg(boss: Boss, now: number): void {
    const ctx = this.ctx
    const cx = boss.x
    const cy = boss.y + Math.sin(now / 600) * 2
    const w = BOSS_VISUAL_SIZE.w
    const h = BOSS_VISUAL_SIZE.h

    const hpPct = boss.maxHp > 0 ? boss.hp / boss.maxHp : 1
    const sprite = boss.shieldActive
      ? this.sprites.bossCharge!
      : hpPct < 0.3
        ? this.sprites.bossAngry!
        : this.sprites.bossIdle!

    ctx.save()
    ctx.imageSmoothingEnabled = true
    ctx.shadowColor = boss.shieldActive
      ? "rgba(253, 224, 71, 0.6)"
      : hpPct < 0.3
        ? "rgba(248, 113, 113, 0.6)"
        : "rgba(167, 139, 250, 0.55)"
    ctx.shadowBlur = 22
    ctx.drawImage(sprite, cx - w / 2, cy - h / 2, w, h)
    ctx.restore()

    // Optional shield halo when active — overlay above the sprite for read.
    if (boss.shieldActive) {
      ctx.save()
      const r = Math.max(w, h) * 0.55 + Math.sin(now / 220) * 3
      ctx.strokeStyle = "rgba(253, 224, 71, 0.65)"
      ctx.lineWidth = 2
      ctx.shadowColor = "rgba(253, 224, 71, 0.6)"
      ctx.shadowBlur = 12
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  private renderSentinel(boss: Boss, now: number): void {
    const ctx = this.ctx
    const cx = boss.x
    const cy = boss.y + Math.sin(now / 600) * 2
    const w = 80,
      h = 50
    const color = "#ff4d55"

    ctx.save()
    // Chassis with glow
    ctx.shadowColor = "rgba(255, 77, 85, 0.7)"
    ctx.shadowBlur = 22
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(cx, cy - h / 2)
    ctx.lineTo(cx + w / 2, cy)
    ctx.lineTo(cx + w / 3, cy + h / 2)
    ctx.lineTo(cx - w / 3, cy + h / 2)
    ctx.lineTo(cx - w / 2, cy)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    // Dark inset
    ctx.fillStyle = "#3a0a0d"
    ctx.fillRect(cx - 18, cy - 9, 36, 18)

    // Eye ports (pulse)
    const pulse = 0.7 + 0.3 * Math.sin(now / 200)
    ctx.fillStyle = `rgba(255, 220, 85, ${pulse})`
    ctx.fillRect(cx - 12, cy - 4, 7, 7)
    ctx.fillRect(cx + 5, cy - 4, 7, 7)

    // Thrusters
    ctx.fillStyle = "#ffb347"
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(now / 60)
    ctx.fillRect(cx - 18, cy + h / 2 - 2, 6, 6)
    ctx.fillRect(cx + 12, cy + h / 2 - 2, 6, 6)
    ctx.restore()
  }

  private renderWarden(boss: Boss, now: number): void {
    const ctx = this.ctx
    const cx = boss.x
    const cy = boss.y + Math.sin(now / 800) * 3
    const w = 110,
      h = 55
    const color = "#ff9933"

    ctx.save()
    ctx.shadowColor = "rgba(255, 153, 51, 0.6)"
    ctx.shadowBlur = 22

    // Central body (wide hex)
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(cx - w / 2 + 12, cy - h / 2)
    ctx.lineTo(cx + w / 2 - 12, cy - h / 2)
    ctx.lineTo(cx + w / 2, cy)
    ctx.lineTo(cx + w / 2 - 12, cy + h / 2)
    ctx.lineTo(cx - w / 2 + 12, cy + h / 2)
    ctx.lineTo(cx - w / 2, cy)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    // Dark central band
    ctx.fillStyle = "#3a1e05"
    ctx.fillRect(cx - w / 2 + 14, cy - 6, w - 28, 12)

    // Side ports (pulse bright briefly to telegraph escort spawn)
    const portGlow = 0.5 + 0.5 * Math.sin(now / 350)
    for (const side of [-1, 1]) {
      const px = cx + side * (w / 2 - 4)
      ctx.fillStyle = `rgba(255, 230, 120, ${portGlow})`
      ctx.shadowColor = "rgba(255, 230, 120, 0.9)"
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.arc(px, cy, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0

    // Row of window slits
    ctx.fillStyle = "#ffe08a"
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(cx + i * 12 - 2, cy - 2, 4, 4)
    }
    ctx.restore()
  }

  private renderCitadel(boss: Boss, now: number): void {
    const ctx = this.ctx
    const cx = boss.x
    const cy = boss.y
    const r = 38
    const color = "#33d9d9"

    ctx.save()
    // Outer hex ring
    ctx.shadowColor = "rgba(51, 217, 217, 0.55)"
    ctx.shadowBlur = 20
    ctx.fillStyle = color
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2
      const x = cx + Math.cos(a) * r
      const y = cy + Math.sin(a) * r
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    // Inner dark hex
    ctx.fillStyle = "#062828"
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 2
      const x = cx + Math.cos(a) * (r * 0.68)
      const y = cy + Math.sin(a) * (r * 0.68)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()

    // Pulsing core
    const corePulse = 0.7 + 0.3 * Math.sin(now / 180)
    ctx.shadowColor = "#a8fff1"
    ctx.shadowBlur = 14
    ctx.fillStyle = `rgba(168, 255, 241, ${corePulse})`
    ctx.beginPath()
    ctx.arc(cx, cy, 10, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // Shield — concentric pulsing hex halo when active
    if (boss.shieldActive) {
      const shieldR = r + 10 + Math.sin(now / 220) * 3
      ctx.strokeStyle = "rgba(120, 255, 240, 0.75)"
      ctx.lineWidth = 2
      ctx.shadowColor = "rgba(120, 255, 240, 0.6)"
      ctx.shadowBlur = 12
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 2
        const x = cx + Math.cos(a) * shieldR
        const y = cy + Math.sin(a) * shieldR
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
      ctx.shadowBlur = 0
    }
    ctx.restore()
  }

  private renderNexus(boss: Boss, now: number): void {
    const ctx = this.ctx
    const cx = boss.x
    const cy = boss.y
    const r = 46
    // Phase shifts the accent palette and animation speed.
    const phase = Math.max(1, boss.phase ?? 1)
    const bodyColor = phase >= 2 ? "#b645ff" : "#7a45ff"
    const accentColor = phase >= 3 ? "#ff66cc" : "#d89eff"
    const orbitSpeed = 1 + (phase - 1) * 0.5

    ctx.save()
    // Central core
    ctx.shadowColor = "rgba(130, 90, 255, 0.6)"
    ctx.shadowBlur = 24
    ctx.fillStyle = bodyColor
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // Dark inner
    ctx.fillStyle = "#1a0830"
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2)
    ctx.fill()

    // Pulsing core
    const corePulse = 0.6 + 0.4 * Math.sin(now / 160)
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 14
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.22 * (0.8 + 0.2 * corePulse), 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // Orbiting satellites — count grows with phase
    const satCount = 2 + phase
    const t = (now / 900) * orbitSpeed
    ctx.fillStyle = accentColor
    ctx.shadowColor = accentColor
    ctx.shadowBlur = 10
    for (let i = 0; i < satCount; i++) {
      const a = t + (Math.PI * 2 * i) / satCount
      const sx = cx + Math.cos(a) * r
      const sy = cy + Math.sin(a) * r * 0.55
      ctx.beginPath()
      ctx.arc(sx, sy, 6, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.shadowBlur = 0

    if (boss.shieldActive) {
      const shieldR = r + 12 + Math.sin(now / 200) * 4
      ctx.strokeStyle = "rgba(220, 180, 255, 0.6)"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, shieldR, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  private renderBossHud(boss: Boss): void {
    const ctx = this.ctx
    const barW = Math.min(this.width - 40, 520)
    const barH = 8
    const padX = 12
    const padY = 8
    const blockW = barW + padX * 2
    const blockH = 44
    const x = (this.width - blockW) / 2
    const y = 16

    ctx.save()
    // Backdrop
    ctx.fillStyle = "rgba(10, 12, 20, 0.72)"
    ctx.fillRect(x, y, blockW, blockH)
    ctx.strokeStyle = "rgba(200, 80, 80, 0.55)"
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, blockW - 1, blockH - 1)

    // Title
    const name = boss.kind.toUpperCase()
    const title = boss.phase > 1 ? `${name} — PHASE ${boss.phase}` : name
    ctx.fillStyle = "#ffdddd"
    ctx.font = "bold 13px JetBrains Mono, monospace"
    ctx.textAlign = "left"
    ctx.textBaseline = "alphabetic"
    ctx.fillText(title, x + padX, y + padY + 12)

    // Shield indicator
    if (boss.shieldActive) {
      ctx.fillStyle = "#78fff0"
      ctx.fillText(
        "◉ SHIELD",
        x + padX + ctx.measureText(title).width + 14,
        y + padY + 12,
      )
    }

    // HP numbers (right-aligned)
    ctx.fillStyle = "#ccc"
    ctx.font = "12px JetBrains Mono, monospace"
    ctx.textAlign = "right"
    ctx.fillText(
      `${Math.max(0, boss.hp)} / ${boss.maxHp}`,
      x + blockW - padX,
      y + padY + 12,
    )

    // HP bar
    const barX = x + padX
    const barY = y + padY + 18
    ctx.fillStyle = "rgba(60, 20, 25, 0.9)"
    ctx.fillRect(barX, barY, barW, barH)
    const pct =
      boss.maxHp > 0 ? Math.max(0, Math.min(1, boss.hp / boss.maxHp)) : 0
    const grad = ctx.createLinearGradient(barX, barY, barX + barW, barY)
    grad.addColorStop(0, "#ff6a6a")
    grad.addColorStop(1, "#ffb84d")
    ctx.fillStyle = grad
    ctx.fillRect(barX, barY, barW * pct, barH)
    ctx.strokeStyle = "rgba(255, 180, 180, 0.35)"
    ctx.lineWidth = 1
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1)
    ctx.restore()
  }

  /** Mini-rail on the right edge showing the visible Y window vs the full world.
   *  Hidden when the viewport fits the entire world (nothing to scroll). */
  private renderScrollIndicator(): void {
    const worldH = getGameMeta().gameHeight
    if (this.height >= worldH) return

    const ctx = this.ctx
    const padTop = 70
    const padBottom = 70
    const railX = this.width - 8
    const railY = padTop
    const railH = Math.max(60, this.height - padTop - padBottom)
    const railW = 3

    // Pill represents the visible window [cameraY, cameraY + viewportH] mapped onto railH.
    const pillY = railY + (this.cameraY / worldH) * railH
    const pillH = Math.max(18, (this.height / worldH) * railH)

    ctx.save()
    // Rail (dim track)
    ctx.fillStyle = "rgba(200, 220, 255, 0.12)"
    ctx.fillRect(railX, railY, railW, railH)

    // Pill (visible window)
    ctx.fillStyle = "rgba(0, 255, 136, 0.7)"
    ctx.shadowColor = "rgba(0, 255, 136, 0.5)"
    ctx.shadowBlur = 6
    ctx.fillRect(railX, pillY, railW, pillH)
    ctx.restore()
  }

  private renderPausedByOther(): void {
    const ctx = this.ctx

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)"
    ctx.fillRect(0, 0, this.width, this.height)

    ctx.fillStyle = "#fff"
    ctx.font = "24px JetBrains Mono, monospace"
    ctx.textAlign = "center"
    ctx.fillText("PAUSED", this.width / 2, this.height / 2)

    ctx.font = "14px JetBrains Mono, monospace"
    ctx.fillText(
      "Waiting for other player...",
      this.width / 2,
      this.height / 2 + 30,
    )
  }
}
