// ============================================================
// Sprites — Pixel art sprite generation
// Framework-agnostic: uses offscreen Canvas to create sprites
// ============================================================

import { getShip, resolveTint } from './ships'
import type { ShipKey } from './ships'

// --- Pixel patterns (1 = filled, 0 = empty) ---
// Player ship patterns live in ./ships (shared with the home-page selector).

// Invader (static grid enemy) — 13 x 9, crab silhouette, 2-frame animation.

const ENEMY_PATTERN_A = [
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0],
  [0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
]

const ENEMY_PATTERN_B = [
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
  [0, 0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
]

// Patrol enemy — 13 x 9, wedge-shaped, 2-frame animation.

const PATROL_PATTERN_A = [
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 2, 1, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 1],
  [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

const PATROL_PATTERN_B = [
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 2, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 2, 1, 2, 1, 1, 1, 1, 0],
  [0, 0, 1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

// Player bullet — 5 x 11 rail-bolt shell. 1=shell, 2=tip, 3=core.

const PLAYER_BULLET = [
  [0, 0, 2, 0, 0],
  [0, 2, 3, 2, 0],
  [0, 1, 3, 1, 0],
  [1, 1, 3, 1, 1],
  [0, 1, 3, 1, 0],
  [0, 1, 3, 1, 0],
  [0, 1, 3, 1, 0],
  [0, 1, 3, 1, 0],
  [0, 1, 3, 1, 0],
  [0, 1, 1, 1, 0],
  [0, 0, 1, 0, 0],
]

// Enemy normal — 3 x 7 plasma blob. 1=shell, 2=core.

const ENEMY_BULLET_NORMAL = [
  [0, 1, 0],
  [1, 2, 1],
  [1, 2, 1],
  [1, 2, 1],
  [1, 2, 1],
  [1, 2, 1],
  [0, 1, 0],
]

// Enemy aimed — 3 x 9 finned missile. 1=shell, 2=core.

const ENEMY_BULLET_AIMED_GRID = [
  [0, 1, 0],
  [1, 2, 1],
  [1, 2, 1],
  [1, 2, 1],
  [1, 2, 1],
  [1, 2, 1],
  [1, 2, 1],
  [1, 1, 1],
  [0, 1, 0],
]

// Enemy comet — 3 x 11, leading sphere + baked-in trail. 1=shell, 2=core.

const ENEMY_BULLET_COMET_GRID = [
  [0, 1, 0],
  [1, 2, 1],
  [1, 2, 1],
  [1, 2, 1],
  [1, 2, 1],
  [0, 1, 0],
  [0, 1, 0],
  [0, 1, 0],
  [0, 0, 0],
  [0, 1, 0],
  [0, 0, 0],
]

// Power-ups — 9 x 9 capsule-style badges.

const POWERUP_SPEED_PATTERN = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0],
  [0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
]

const POWERUP_MULTISHOT_PATTERN = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 0, 0, 1, 0, 0, 1, 0],
  [0, 1, 0, 0, 1, 0, 0, 1, 0],
  [0, 1, 0, 0, 1, 0, 0, 1, 0],
  [0, 1, 0, 0, 1, 0, 0, 1, 0],
  [0, 1, 0, 0, 1, 0, 0, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 0, 0],
]

// --- Sprite generation ---

/** Extract a 0/1 layer from a multi-tint grid for a single tint index. */
function extractTint(grid: number[][], tintIdx: number): number[][] {
  return grid.map((row) => row.map((v) => (v === tintIdx ? 1 : 0)))
}

/**
 * Create a single-color sprite from a pixel pattern.
 * Returns an offscreen canvas that can be used with drawImage.
 */
function createSprite(pattern: number[][], color: string): HTMLCanvasElement {
  const h = pattern.length
  const w = pattern[0].length
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = color
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (pattern[y][x]) {
        ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  return canvas
}

/**
 * Create a multi-layer sprite by compositing several patterns (drawn bottom-up).
 * All patterns must share the same dimensions.
 */
export function createLayeredSprite(
  layers: { pattern: number[][]; color: string }[],
): HTMLCanvasElement {
  const h = layers[0].pattern.length
  const w = layers[0].pattern[0].length
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  for (const { pattern, color } of layers) {
    ctx.fillStyle = color
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (pattern[y][x]) ctx.fillRect(x, y, 1, 1)
      }
    }
  }

  return canvas
}

/** Render a multi-tint grid with a per-index color resolver. */
function createTintedSprite(
  grid: number[][],
  resolve: (tintIdx: number) => string | null,
): HTMLCanvasElement {
  const h = grid.length
  const w = grid[0].length
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = grid[y][x]
      if (!v) continue
      const c = resolve(v)
      if (!c) continue
      ctx.fillStyle = c
      ctx.fillRect(x, y, 1, 1)
    }
  }
  return canvas
}

// --- Star field ---

export type Star = {
  x: number
  y: number
  size: number
  brightness: number
  twinkleSpeed: number
  /** Rare bright stars that get a cross-shaped flare overlay. */
  flare: boolean
  /** Tinge — 0 = white, 1 = cool blue, 2 = warm amber. */
  tint: 0 | 1 | 2
}

/**
 * Generate a random star field.
 */
export function generateStars(width: number, height: number, count = 160): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    const r = Math.random()
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: r < 0.15 ? 2 : 1,
      brightness: 0.25 + Math.random() * 0.65,
      twinkleSpeed: 0.5 + Math.random() * 2,
      flare: r < 0.07,
      tint: (Math.random() < 0.1 ? 1 : Math.random() < 0.04 ? 2 : 0) as 0 | 1 | 2,
    })
  }
  return stars
}

/**
 * Pre-render a soft nebula background into an offscreen canvas.
 * Returns a texture the renderer blits behind the stars each frame.
 */
export function generateNebula(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const blobs: { x: number; y: number; r: number; color: string }[] = [
    { x: width * 0.2, y: height * 0.25, r: Math.max(width, height) * 0.35, color: '90, 60, 160' },
    { x: width * 0.75, y: height * 0.35, r: Math.max(width, height) * 0.3, color: '60, 120, 190' },
    { x: width * 0.35, y: height * 0.75, r: Math.max(width, height) * 0.32, color: '180, 80, 140' },
    { x: width * 0.85, y: height * 0.8, r: Math.max(width, height) * 0.25, color: '30, 170, 180' },
    { x: width * 0.5, y: height * 0.5, r: Math.max(width, height) * 0.2, color: '40, 50, 120' },
    { x: width * 0.1, y: height * 0.6, r: Math.max(width, height) * 0.22, color: '110, 40, 180' },
  ]

  for (const b of blobs) {
    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r)
    grad.addColorStop(0, `rgba(${b.color}, 0.14)`)
    grad.addColorStop(0.6, `rgba(${b.color}, 0.04)`)
    grad.addColorStop(1, `rgba(${b.color}, 0)`)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, width, height)
  }

  return canvas
}

// --- SpriteSheet: all pre-rendered sprites for the game ---

export type SpriteSheet = {
  player1: HTMLCanvasElement
  player2: HTMLCanvasElement
  playerDead: HTMLCanvasElement
  staticA: HTMLCanvasElement
  staticB: HTMLCanvasElement
  patrolA: HTMLCanvasElement
  patrolB: HTMLCanvasElement
  bullet: HTMLCanvasElement
  enemyBullet: HTMLCanvasElement
  /** Orange-tinted variant — used for "aimed" bullets that track the player. */
  enemyBulletAimed: HTMLCanvasElement
  /** Cool bluish variant — used for "comet" bullets with a trailing effect. */
  enemyBulletComet: HTMLCanvasElement
  powerUpSpeed: HTMLCanvasElement
  powerUpMultishot: HTMLCanvasElement
}

export type SpriteColors = {
  player1: string
  player2: string
  playerDead: string
  enemyStatic: string
  enemyPatrol: string
  bullet: string
  enemyBullet: string
}

// Enemy accent (tint index 2) for the 13×9 grids — a slightly brighter shade of the hull.
// Neon palette: patrol hull = #c455ff, accent = #eaa5ff. Invader accent not used (grid has no 2s).
const PATROL_ACCENT = '#eaa5ff'

// Player bullet tint colors (neon palette: yellow shell, white core, cream tip).
const PLAYER_BULLET_TIP = '#fff7c2'
const PLAYER_BULLET_CORE = '#ffffff'

/**
 * Generate all game sprites with given colors.
 * Call once at startup, then use with drawImage.
 */
export function createSpriteSheet(colors: SpriteColors, shipKey?: ShipKey): SpriteSheet {
  const ship = getShip(shipKey)
  const buildPlayer = (hullColor: string): HTMLCanvasElement =>
    createLayeredSprite(
      ship.layers.map((l) => ({ pattern: l.pattern, color: resolveTint(l.tint, hullColor) })),
    )

  const buildPatrol = (grid: number[][]): HTMLCanvasElement =>
    createTintedSprite(grid, (idx) => {
      if (idx === 1) return colors.enemyPatrol
      if (idx === 2) return PATROL_ACCENT
      return null
    })

  const buildPlayerBullet = (shell: string): HTMLCanvasElement =>
    createLayeredSprite([
      { pattern: extractTint(PLAYER_BULLET, 1), color: shell },
      { pattern: extractTint(PLAYER_BULLET, 2), color: PLAYER_BULLET_TIP },
      { pattern: extractTint(PLAYER_BULLET, 3), color: PLAYER_BULLET_CORE },
    ])

  const buildEnemyBullet = (grid: number[][], shell: string, core: string): HTMLCanvasElement =>
    createLayeredSprite([
      { pattern: extractTint(grid, 1), color: shell },
      { pattern: extractTint(grid, 2), color: core },
    ])

  return {
    player1: buildPlayer(colors.player1),
    player2: buildPlayer(colors.player2),
    playerDead: buildPlayer(colors.playerDead),
    staticA: createSprite(ENEMY_PATTERN_A, colors.enemyStatic),
    staticB: createSprite(ENEMY_PATTERN_B, colors.enemyStatic),
    patrolA: buildPatrol(PATROL_PATTERN_A),
    patrolB: buildPatrol(PATROL_PATTERN_B),
    bullet: buildPlayerBullet(colors.bullet),
    enemyBullet: buildEnemyBullet(ENEMY_BULLET_NORMAL, colors.enemyBullet, '#ffe1b0'),
    enemyBulletAimed: buildEnemyBullet(ENEMY_BULLET_AIMED_GRID, '#ff9a1f', '#ffe8a8'),
    enemyBulletComet: buildEnemyBullet(ENEMY_BULLET_COMET_GRID, '#6fa8ff', '#e8f4ff'),
    powerUpSpeed: createSprite(POWERUP_SPEED_PATTERN, '#ffdd00'),
    powerUpMultishot: createSprite(POWERUP_MULTISHOT_PATTERN, '#00ddff'),
  }
}
