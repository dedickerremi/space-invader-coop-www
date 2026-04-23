// ============================================================
// SVG sprite sheet — async builder that returns the same
// SpriteSheet shape as src/core/Sprites.ts.
// Live call sites (GameRenderer) still use the pixel-art builder
// until later PRs swap them behind NEXT_PUBLIC_USE_SVG_SPRITES.
// ============================================================

import type { SpriteSheet, SpriteColors } from './Sprites'
import type { ShipKey } from './ships'
import {
  SHIP_COMPONENTS,
  EnemyGruntA,
  EnemyGruntB,
  EnemyPatrolA,
  EnemyPatrolB,
  BulletPlayer,
  BulletEnemy,
  PowerUpSpeed,
  PowerUpMultishot,
  ExplosionFrame1,
  ExplosionFrame2,
  ExplosionFrame3,
  HitFlash,
  MuzzleFlash,
  SHIP_SVG_SIZE,
  BULLET_PLAYER_SIZE,
  BULLET_ENEMY_SIZE,
  POWERUP_SVG_SIZE,
  ENEMY_SVG_SIZE,
  EXPLOSION_SVG_SIZE,
  HIT_FLASH_SVG_SIZE,
  MUZZLE_FLASH_SVG_SIZE,
  type ShipColors,
} from './svgSprites'
import { rasterizeElement, type RasterizeOptions } from './svgRasterizer'

function shipColorsFromHull(hull: string): ShipColors {
  return { hull, accent: softenHex(hull), cockpit: '#fde68a', engine: '#f97316', glow: hull }
}

function softenHex(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  const mix = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.55))
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

export async function createSpriteSheetSvg(
  colors: SpriteColors,
  shipKey: ShipKey = 'classic',
  options?: RasterizeOptions,
): Promise<SpriteSheet> {
  const Ship = SHIP_COMPONENTS[shipKey]
  const size = SHIP_SVG_SIZE[shipKey]
  const enemyA = ENEMY_SVG_SIZE.gruntA
  const patrolA = ENEMY_SVG_SIZE.patrolA

  const [
    player1,
    player2,
    playerDead,
    staticA,
    staticB,
    patrolAC,
    patrolBC,
    bullet,
    enemyBullet,
    enemyBulletAimed,
    enemyBulletComet,
    powerUpSpeed,
    powerUpMultishot,
    explosion1,
    explosion2,
    explosion3,
    hitFlash,
    muzzleFlash,
  ] = await Promise.all([
    rasterizeElement(Ship(shipColorsFromHull(colors.player1)), size.w, size.h, options),
    rasterizeElement(Ship(shipColorsFromHull(colors.player2)), size.w, size.h, options),
    rasterizeElement(Ship(shipColorsFromHull(colors.playerDead)), size.w, size.h, options),
    rasterizeElement(
      EnemyGruntA({ body: colors.enemyStatic, shade: '#991b1b', eye: '#fde047' }),
      enemyA.w,
      enemyA.h,
      options,
    ),
    rasterizeElement(
      EnemyGruntB({ body: colors.enemyStatic, shade: '#991b1b', eye: '#fde047' }),
      enemyA.w,
      enemyA.h,
      options,
    ),
    rasterizeElement(
      EnemyPatrolA({ body: colors.enemyPatrol, shade: '#86198f', eye: '#22d3ee' }),
      patrolA.w,
      patrolA.h,
      options,
    ),
    rasterizeElement(
      EnemyPatrolB({ body: colors.enemyPatrol, shade: '#86198f', eye: '#22d3ee' }),
      patrolA.w,
      patrolA.h,
      options,
    ),
    rasterizeElement(
      BulletPlayer({ shell: colors.bullet, core: '#ffffff' }),
      BULLET_PLAYER_SIZE.w,
      BULLET_PLAYER_SIZE.h,
      options,
    ),
    rasterizeElement(
      BulletEnemy({ shell: colors.enemyBullet, core: '#fef3c7' }),
      BULLET_ENEMY_SIZE.w,
      BULLET_ENEMY_SIZE.h,
      options,
    ),
    rasterizeElement(
      BulletEnemy({ shell: '#fb923c', core: '#fef9c3' }),
      BULLET_ENEMY_SIZE.w,
      BULLET_ENEMY_SIZE.h,
      options,
    ),
    rasterizeElement(
      BulletEnemy({ shell: '#60a5fa', core: '#e0f2fe' }),
      BULLET_ENEMY_SIZE.w,
      BULLET_ENEMY_SIZE.h,
      options,
    ),
    rasterizeElement(PowerUpSpeed(), POWERUP_SVG_SIZE.w, POWERUP_SVG_SIZE.h, options),
    rasterizeElement(PowerUpMultishot(), POWERUP_SVG_SIZE.w, POWERUP_SVG_SIZE.h, options),
    rasterizeElement(ExplosionFrame1(), EXPLOSION_SVG_SIZE.w, EXPLOSION_SVG_SIZE.h, options),
    rasterizeElement(ExplosionFrame2(), EXPLOSION_SVG_SIZE.w, EXPLOSION_SVG_SIZE.h, options),
    rasterizeElement(ExplosionFrame3(), EXPLOSION_SVG_SIZE.w, EXPLOSION_SVG_SIZE.h, options),
    rasterizeElement(HitFlash(), HIT_FLASH_SVG_SIZE.w, HIT_FLASH_SVG_SIZE.h, options),
    rasterizeElement(MuzzleFlash(), MUZZLE_FLASH_SVG_SIZE.w, MUZZLE_FLASH_SVG_SIZE.h, options),
  ])

  return {
    player1,
    player2,
    playerDead,
    staticA,
    staticB,
    patrolA: patrolAC,
    patrolB: patrolBC,
    bullet,
    enemyBullet,
    enemyBulletAimed,
    enemyBulletComet,
    powerUpSpeed,
    powerUpMultishot,
    explosion1,
    explosion2,
    explosion3,
    hitFlash,
    muzzleFlash,
  }
}

/** Feature flag — read at import time on the client. */
export function isSvgSpritesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_SVG_SPRITES === '1'
}
