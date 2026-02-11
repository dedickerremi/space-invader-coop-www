// ============================================================
// Sprites — Pixel art sprite generation
// Framework-agnostic: uses offscreen Canvas to create sprites
// ============================================================

// --- Pixel patterns (1 = filled, 0 = empty) ---

// Player ship — classic cannon shape (11 x 7)
const PLAYER_PATTERN = [
  [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
]

// Enemy — frame A (legs down) (11 x 8)
const ENEMY_PATTERN_A = [
  [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1],
  [0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0],
]

// Enemy — frame B (legs up) (11 x 8)
const ENEMY_PATTERN_B = [
  [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
  [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
]

// Patrol enemy — frame A (wings spread) (13 x 8)
const PATROL_PATTERN_A = [
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
  [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

// Patrol enemy — frame B (wings tucked) (13 x 8)
const PATROL_PATTERN_B = [
  [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 0],
  [0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
]

// Player bullet — laser beam (3 x 7)
const BULLET_PATTERN = [
  [0, 1, 0],
  [1, 1, 1],
  [0, 1, 0],
  [1, 1, 1],
  [0, 1, 0],
  [1, 1, 1],
  [0, 1, 0],
]

// Enemy bullet — small plasma shot (3 x 5)
const ENEMY_BULLET_PATTERN = [
  [0, 1, 0],
  [1, 1, 1],
  [1, 1, 1],
  [1, 1, 1],
  [0, 1, 0],
]

// --- Sprite generation ---

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

// --- Star field ---

export type Star = {
  x: number
  y: number
  size: number
  brightness: number
  twinkleSpeed: number
}

/**
 * Generate a random star field.
 */
export function generateStars(width: number, height: number, count = 80): Star[] {
  const stars: Star[] = []
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() < 0.3 ? 2 : 1,
      brightness: 0.2 + Math.random() * 0.6,
      twinkleSpeed: 0.5 + Math.random() * 2,
    })
  }
  return stars
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

/**
 * Generate all game sprites with given colors.
 * Call once at startup, then use with drawImage.
 */
export function createSpriteSheet(colors: SpriteColors): SpriteSheet {
  return {
    player1: createSprite(PLAYER_PATTERN, colors.player1),
    player2: createSprite(PLAYER_PATTERN, colors.player2),
    playerDead: createSprite(PLAYER_PATTERN, colors.playerDead),
    staticA: createSprite(ENEMY_PATTERN_A, colors.enemyStatic),
    staticB: createSprite(ENEMY_PATTERN_B, colors.enemyStatic),
    patrolA: createSprite(PATROL_PATTERN_A, colors.enemyPatrol),
    patrolB: createSprite(PATROL_PATTERN_B, colors.enemyPatrol),
    bullet: createSprite(BULLET_PATTERN, colors.bullet),
    enemyBullet: createSprite(ENEMY_BULLET_PATTERN, colors.enemyBullet),
  }
}
