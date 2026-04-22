// ============================================================
// SVG vector sprites — neo-arcade handoff port.
// Each sprite is a React component with typed props.
// Render directly in React DOM, or serialize via renderToStaticMarkup
// for rasterization (see svgRasterizer.ts).
//
// Logical viewBox sizes match the handoff:
//   ships: classic 44x28, fighter 52x36, falcon 60x44, xwing 60x44
//   enemies: grunt 44x32, patrol 52x32
//   bullets: player 16x32, enemy 12x24
//   power-ups: 32x32
//   FX: explosion 48x48, hit-flash 32x32, muzzle 24x24
// ============================================================

import type { ReactElement } from 'react'

const INK = '#0a0612'

function SpriteDefs(): ReactElement {
  return (
    <defs>
      <filter id="glow-soft" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.2" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="glow-hot" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="b" />
        <feMerge>
          <feMergeNode in="b" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  )
}

// --- Ships -------------------------------------------------

export type ShipColors = {
  hull: string
  accent: string
  cockpit?: string
  engine?: string
  glow?: string
}

export type ShipSvgKey = 'classic' | 'fighter' | 'falcon' | 'xwing'

export const SHIP_SVG_SIZE: Record<ShipSvgKey, { w: number; h: number }> = {
  classic: { w: 44, h: 28 },
  fighter: { w: 52, h: 36 },
  falcon: { w: 60, h: 44 },
  xwing: { w: 60, h: 44 },
}

export function ShipClassic({
  hull = '#22d3ee',
  accent = '#a5f3fc',
  glow,
}: ShipColors): ReactElement {
  const glowColor = glow ?? hull
  return (
    <svg
      viewBox="0 0 44 28"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <path
        d="M2 24 L2 16 L6 16 L6 20 L38 20 L38 16 L42 16 L42 24 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="8" y="12" width="28" height="6" rx="1" fill={hull} stroke={INK} strokeWidth="1.5" />
      <path
        d="M19 12 L19 6 L25 6 L25 12 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <rect x="21" y="1" width="2" height="6" fill={INK} />
      <rect x="10" y="13.5" width="24" height="1.6" fill={accent} opacity="0.9" />
      <circle cx="22" cy="9" r="1.6" fill={glowColor} filter="url(#glow-soft)" />
      <rect x="12" y="21.5" width="3" height="2" fill={INK} />
      <rect x="20.5" y="21.5" width="3" height="2" fill={INK} />
      <rect x="29" y="21.5" width="3" height="2" fill={INK} />
    </svg>
  )
}

export function ShipFighter({
  hull = '#38bdf8',
  accent = '#bae6fd',
  cockpit = '#fde68a',
  engine = '#f97316',
}: ShipColors): ReactElement {
  return (
    <svg
      viewBox="0 0 52 36"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <path
        d="M2 22 L10 16 L18 18 L18 26 L10 28 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M50 22 L42 16 L34 18 L34 26 L42 28 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M20 10 L26 2 L32 10 L32 28 L26 32 L20 28 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M22 12 L26 5 L30 12 L30 22 L26 24 L22 22 Z"
        fill={accent}
        opacity="0.85"
      />
      <ellipse cx="26" cy="14" rx="2.4" ry="4" fill={cockpit} stroke={INK} strokeWidth="1.2" />
      <circle cx="4" cy="22" r="1.3" fill={accent} filter="url(#glow-soft)" />
      <circle cx="48" cy="22" r="1.3" fill={accent} filter="url(#glow-soft)" />
      <rect x="22" y="28" width="3" height="5" rx="1" fill={INK} />
      <rect x="27" y="28" width="3" height="5" rx="1" fill={INK} />
      <rect x="22.5" y="31" width="2" height="4" fill={engine} filter="url(#glow-hot)" />
      <rect x="27.5" y="31" width="2" height="4" fill={engine} filter="url(#glow-hot)" />
    </svg>
  )
}

export function ShipFalcon({
  hull = '#a78bfa',
  accent = '#ddd6fe',
  cockpit = '#fde68a',
  engine = '#22d3ee',
}: ShipColors): ReactElement {
  return (
    <svg
      viewBox="0 0 60 44"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <ellipse cx="28" cy="22" rx="22" ry="13" fill={hull} stroke={INK} strokeWidth="1.5" />
      <path
        d="M6 20 L0 16 L0 22 L6 24 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M6 26 L0 28 L0 34 L8 30 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 18 Q28 10 46 18"
        fill="none"
        stroke={accent}
        strokeWidth="2.5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx="36" cy="14" r="4.5" fill={accent} stroke={INK} strokeWidth="1.5" />
      <circle cx="36" cy="14" r="2" fill={hull} />
      <path
        d="M44 20 L50 20 L52 22 L50 24 L44 24 Z"
        fill={cockpit}
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <rect
        x="8"
        y="20"
        width="3"
        height="5"
        rx="1"
        fill={engine}
        filter="url(#glow-hot)"
        opacity="0.95"
      />
      <path d="M20 22 L36 22" stroke={INK} strokeWidth="1" opacity="0.4" />
    </svg>
  )
}

export function ShipXwing({
  hull = '#f87171',
  accent = '#fecaca',
  cockpit = '#fde68a',
  engine = '#22d3ee',
}: ShipColors): ReactElement {
  return (
    <svg
      viewBox="0 0 60 44"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <path
        d="M4 2 L22 14 L24 20 L4 20 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M56 2 L38 14 L36 20 L56 20 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M4 42 L22 30 L24 24 L4 24 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M56 42 L38 30 L36 24 L56 24 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M22 16 L30 6 L38 16 L38 28 L30 38 L22 28 Z"
        fill={hull}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M24 17 L30 9 L36 17 L36 22 L24 22 Z"
        fill={accent}
        opacity="0.85"
      />
      <ellipse cx="30" cy="18" rx="2.4" ry="3.4" fill={cockpit} stroke={INK} strokeWidth="1.2" />
      <rect x="2" y="0.5" width="3.5" height="3.5" fill={INK} />
      <rect x="54.5" y="0.5" width="3.5" height="3.5" fill={INK} />
      <rect x="2" y="40" width="3.5" height="3.5" fill={INK} />
      <rect x="54.5" y="40" width="3.5" height="3.5" fill={INK} />
      <rect x="27" y="33" width="6" height="4" fill={INK} />
      <rect x="28" y="34" width="4" height="3" fill={engine} filter="url(#glow-hot)" />
    </svg>
  )
}

export const SHIP_COMPONENTS: Record<ShipSvgKey, (c: ShipColors) => ReactElement> = {
  classic: ShipClassic,
  fighter: ShipFighter,
  falcon: ShipFalcon,
  xwing: ShipXwing,
}

// --- Enemies -----------------------------------------------

export type EnemyColors = {
  body: string
  shade: string
  eye: string
}

const ENEMY_GRUNT_SIZE = { w: 44, h: 32 }
const ENEMY_PATROL_SIZE = { w: 52, h: 32 }

export const ENEMY_SVG_SIZE = {
  gruntA: ENEMY_GRUNT_SIZE,
  gruntB: ENEMY_GRUNT_SIZE,
  patrolA: ENEMY_PATROL_SIZE,
  patrolB: ENEMY_PATROL_SIZE,
} as const

// Visual draw sizes used by the renderer in SVG mode. Hitbox dims live in
// gameMeta and stay unchanged — these only control how big the sprite is
// drawn so it preserves its natural aspect ratio (Option C).
export const ENEMY_VISUAL_SIZE = {
  grunt:  { w: 38, h: 28 },   // SVG natural 44×32, hitbox 28×28
  patrol: { w: 42, h: 26 },   // SVG natural 52×32, hitbox 32×32
} as const

function EnemyGruntBase({
  body,
  shade,
  eye,
  hotEye,
  legsDown,
}: EnemyColors & { hotEye: boolean; legsDown: boolean }): ReactElement {
  const filter = hotEye ? 'glow-hot' : 'glow-soft'
  return (
    <svg
      viewBox="0 0 44 32"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <path
        d="M6 14 L10 6 L34 6 L38 14 L34 22 L10 22 Z"
        fill={body}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 22 L34 22 L31 26 L13 26 Z"
        fill={shade}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle
        cx="16"
        cy="14"
        r="2.6"
        fill={eye}
        stroke={INK}
        strokeWidth="1.2"
        filter={`url(#${filter})`}
      />
      <circle
        cx="28"
        cy="14"
        r="2.6"
        fill={eye}
        stroke={INK}
        strokeWidth="1.2"
        filter={`url(#${filter})`}
      />
      <circle cx="16" cy="14" r="0.9" fill={INK} />
      <circle cx="28" cy="14" r="0.9" fill={INK} />
      <path
        d="M12 10 L14 8 M20 8 L22 6 M30 10 L32 8"
        stroke={INK}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {legsDown ? (
        <>
          <path
            d="M8 26 L6 30 M16 26 L14 30 M28 26 L30 30 M36 26 L38 30"
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 26 L10 30 M32 26 L34 30"
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : (
        <>
          <path
            d="M8 26 L10 30 M16 26 L18 30 M28 26 L26 30 M36 26 L34 30"
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 26 L14 30 M32 26 L30 30"
            stroke={INK}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  )
}

export function EnemyGruntA(c: EnemyColors): ReactElement {
  return <EnemyGruntBase {...c} hotEye={false} legsDown={true} />
}

export function EnemyGruntB(c: EnemyColors): ReactElement {
  return <EnemyGruntBase {...c} hotEye={true} legsDown={false} />
}

function EnemyPatrolBase({
  body,
  shade,
  eye,
  tucked,
  hot,
}: EnemyColors & { tucked: boolean; hot: boolean }): ReactElement {
  const filter = hot ? 'glow-hot' : 'glow-soft'
  return (
    <svg
      viewBox="0 0 52 32"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      {tucked ? (
        <>
          <path
            d="M6 18 L16 12 L20 14 L20 20 L16 22 Z"
            fill={body}
            stroke={INK}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M46 18 L36 12 L32 14 L32 20 L36 22 Z"
            fill={body}
            stroke={INK}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="10" cy="18" r="1.2" fill={eye} filter={`url(#${filter})`} />
          <circle cx="42" cy="18" r="1.2" fill={eye} filter={`url(#${filter})`} />
        </>
      ) : (
        <>
          <path
            d="M0 18 L14 8 L20 14 L20 20 L14 22 Z"
            fill={body}
            stroke={INK}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M52 18 L38 8 L32 14 L32 20 L38 22 Z"
            fill={body}
            stroke={INK}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <circle cx="4" cy="18" r="1.2" fill={eye} filter={`url(#${filter})`} />
          <circle cx="48" cy="18" r="1.2" fill={eye} filter={`url(#${filter})`} />
        </>
      )}
      <path
        d="M20 10 L26 4 L32 10 L32 22 L26 26 L20 22 Z"
        fill={body}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M20 22 L26 26 L32 22 L30 28 L22 28 Z"
        fill={shade}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M23 12 L26 7 L29 12 L29 16 L23 16 Z" fill="#fff" opacity="0.18" />
      <ellipse
        cx="26"
        cy="16"
        rx="2.2"
        ry="3"
        fill={eye}
        stroke={INK}
        strokeWidth="1.2"
        filter={`url(#${filter})`}
      />
    </svg>
  )
}

export function EnemyPatrolA(c: EnemyColors): ReactElement {
  return <EnemyPatrolBase {...c} tucked={false} hot={false} />
}

export function EnemyPatrolB(c: EnemyColors): ReactElement {
  return <EnemyPatrolBase {...c} tucked={true} hot={true} />
}

// --- Bullets -----------------------------------------------

export type BulletColors = { shell: string; core: string }

export const BULLET_PLAYER_SIZE = { w: 16, h: 32 }
export const BULLET_ENEMY_SIZE = { w: 12, h: 24 }

// Visual draw sizes for bullets in SVG mode (decoupled from hitbox).
export const BULLET_VISUAL_SIZE = {
  player: { w: 10, h: 20 },  // SVG 16×32, hitbox 6×14
  enemy:  { w: 8,  h: 16 },  // SVG 12×24, hitbox 6×10
} as const

export function BulletPlayer({
  shell = '#fde047',
  core = '#ffffff',
}: Partial<BulletColors>): ReactElement {
  return (
    <svg
      viewBox="0 0 16 32"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <path
        d="M8 0 L12 6 L12 28 L8 32 L4 28 L4 6 Z"
        fill={shell}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
        filter="url(#glow-soft)"
      />
      <rect x="7" y="5" width="2" height="22" fill={core} filter="url(#glow-hot)" />
      <path d="M8 2 L10 6 L6 6 Z" fill="#fff" opacity="0.7" />
    </svg>
  )
}

export function BulletEnemy({
  shell = '#f97316',
  core = '#fef3c7',
}: Partial<BulletColors>): ReactElement {
  return (
    <svg
      viewBox="0 0 12 24"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <path
        d="M6 0 L10 6 L10 18 L6 24 L2 18 L2 6 Z"
        fill={shell}
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
        filter="url(#glow-soft)"
      />
      <rect x="5" y="4" width="2" height="16" fill={core} filter="url(#glow-hot)" />
    </svg>
  )
}

export function BulletEnemyAimed(): ReactElement {
  return <BulletEnemy shell="#fb923c" core="#fef9c3" />
}

export function BulletEnemyComet(): ReactElement {
  return <BulletEnemy shell="#60a5fa" core="#e0f2fe" />
}

// --- Power-ups ---------------------------------------------

export const POWERUP_SVG_SIZE = { w: 32, h: 32 }

// Visual draw size for power-ups in SVG mode (decoupled from hitbox 20).
export const POWERUP_VISUAL_SIZE = 26

export function PowerUpSpeed(): ReactElement {
  const bg = '#facc15'
  const accent = '#fde68a'
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <path
        d="M16 2 L28 8 L28 24 L16 30 L4 24 L4 8 Z"
        fill={bg}
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
        filter="url(#glow-soft)"
      />
      <path
        d="M10 8 L26 8 L24 10 L18 10 L18 20 L16 20 L16 10 L10 10 Z"
        fill={accent}
        opacity="0.35"
      />
      <path d="M18 6 L9 18 L15 18 L13 26 L23 13 L17 13 Z" fill={INK} />
      <path d="M18 8 L11 17 L15.5 17 L14 23 L21 13.5 L16.5 13.5 Z" fill="#fff" opacity="0.6" />
    </svg>
  )
}

export function PowerUpMultishot(): ReactElement {
  const bg = '#22d3ee'
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <path
        d="M16 2 L28 8 L28 24 L16 30 L4 24 L4 8 Z"
        fill={bg}
        stroke={INK}
        strokeWidth="1.8"
        strokeLinejoin="round"
        filter="url(#glow-soft)"
      />
      <g fill={INK}>
        <path d="M9 22 L9 14 L7 14 L10.5 9 L14 14 L12 14 L12 22 Z" />
        <path d="M14.5 24 L14.5 12 L12.5 12 L16 7 L19.5 12 L17.5 12 L17.5 24 Z" />
        <path d="M20 22 L20 14 L18 14 L21.5 9 L25 14 L23 14 L23 22 Z" />
      </g>
      <path d="M16 7 L19.5 12 L12.5 12 Z" fill="#fff" opacity="0.35" />
    </svg>
  )
}

// --- FX ----------------------------------------------------

export const EXPLOSION_SVG_SIZE = { w: 48, h: 48 }
export const HIT_FLASH_SVG_SIZE = { w: 32, h: 32 }
export const MUZZLE_FLASH_SVG_SIZE = { w: 24, h: 24 }

export function ExplosionFrame1(): ReactElement {
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <circle
        cx="24"
        cy="24"
        r="6"
        fill="#fde047"
        stroke={INK}
        strokeWidth="1.5"
        filter="url(#glow-hot)"
      />
      <circle cx="24" cy="24" r="3" fill="#fff" />
      <g stroke="#fde047" strokeWidth="2" strokeLinecap="round" filter="url(#glow-hot)">
        <path d="M24 12 L24 18" />
        <path d="M24 36 L24 30" />
        <path d="M12 24 L18 24" />
        <path d="M36 24 L30 24" />
      </g>
    </svg>
  )
}

export function ExplosionFrame2(): ReactElement {
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <path
        d="M24 4 L28 16 L40 12 L34 22 L44 24 L34 26 L40 36 L28 32 L24 44 L20 32 L8 36 L14 26 L4 24 L14 22 L8 12 L20 16 Z"
        fill="#f97316"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
        filter="url(#glow-hot)"
      />
      <circle cx="24" cy="24" r="7" fill="#fde047" />
      <circle cx="24" cy="24" r="3" fill="#fff" />
    </svg>
  )
}

export function ExplosionFrame3(): ReactElement {
  return (
    <svg
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <g fill="#f97316" stroke={INK} strokeWidth="1.2" filter="url(#glow-soft)">
        <circle cx="10" cy="14" r="2" />
        <circle cx="38" cy="12" r="2.5" />
        <circle cx="42" cy="32" r="2" />
        <circle cx="8" cy="36" r="2.2" />
        <circle cx="24" cy="6" r="1.6" />
        <circle cx="24" cy="42" r="2" />
      </g>
      <circle cx="24" cy="24" r="4" fill="#fde047" stroke={INK} strokeWidth="1.2" opacity="0.7" />
      <circle cx="24" cy="24" r="1.5" fill="#fff" />
    </svg>
  )
}

export function HitFlash(): ReactElement {
  return (
    <svg
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <path
        d="M16 2 L19 12 L29 12 L21 18 L24 28 L16 22 L8 28 L11 18 L3 12 L13 12 Z"
        fill="#fff"
        stroke={INK}
        strokeWidth="1.5"
        strokeLinejoin="round"
        filter="url(#glow-hot)"
      />
      <circle cx="16" cy="16" r="3" fill="#fde047" />
    </svg>
  )
}

export function MuzzleFlash(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
    >
      <SpriteDefs />
      <path
        d="M12 2 L14 8 L20 6 L16 11 L22 14 L15 14 L17 20 L12 16 L7 20 L9 14 L2 14 L8 11 L4 6 L10 8 Z"
        fill="#fde047"
        stroke={INK}
        strokeWidth="1.2"
        strokeLinejoin="round"
        filter="url(#glow-hot)"
      />
      <circle cx="12" cy="12" r="2.5" fill="#fff" />
    </svg>
  )
}

// --- Catalog (for debug page) ------------------------------

export type SvgCatalogEntry = {
  id: string
  group: string
  label: string
  w: number
  h: number
  element: ReactElement
}

export const SVG_SPRITE_CATALOG: SvgCatalogEntry[] = [
  { id: 'ship-classic', group: 'Ships', label: 'Classic', w: 44, h: 28, element: <ShipClassic hull="#22d3ee" accent="#a5f3fc" /> },
  { id: 'ship-fighter', group: 'Ships', label: 'Fighter', w: 52, h: 36, element: <ShipFighter hull="#38bdf8" accent="#bae6fd" /> },
  { id: 'ship-falcon', group: 'Ships', label: 'Falcon', w: 60, h: 44, element: <ShipFalcon hull="#a78bfa" accent="#ddd6fe" /> },
  { id: 'ship-xwing', group: 'Ships', label: 'X-Wing', w: 60, h: 44, element: <ShipXwing hull="#f87171" accent="#fecaca" /> },
  { id: 'enemy-grunt-a', group: 'Enemies', label: 'Grunt A', w: 44, h: 32, element: <EnemyGruntA body="#ef4444" shade="#991b1b" eye="#fde047" /> },
  { id: 'enemy-grunt-b', group: 'Enemies', label: 'Grunt B', w: 44, h: 32, element: <EnemyGruntB body="#ef4444" shade="#991b1b" eye="#fde047" /> },
  { id: 'enemy-patrol-a', group: 'Enemies', label: 'Patrol A', w: 52, h: 32, element: <EnemyPatrolA body="#d946ef" shade="#86198f" eye="#22d3ee" /> },
  { id: 'enemy-patrol-b', group: 'Enemies', label: 'Patrol B', w: 52, h: 32, element: <EnemyPatrolB body="#d946ef" shade="#86198f" eye="#22d3ee" /> },
  { id: 'bullet-player', group: 'Bullets', label: 'Player', w: 16, h: 32, element: <BulletPlayer /> },
  { id: 'bullet-enemy', group: 'Bullets', label: 'Enemy', w: 12, h: 24, element: <BulletEnemy /> },
  { id: 'bullet-enemy-aimed', group: 'Bullets', label: 'Aimed', w: 12, h: 24, element: <BulletEnemyAimed /> },
  { id: 'bullet-enemy-comet', group: 'Bullets', label: 'Comet', w: 12, h: 24, element: <BulletEnemyComet /> },
  { id: 'powerup-speed', group: 'Power-ups', label: 'Speed', w: 32, h: 32, element: <PowerUpSpeed /> },
  { id: 'powerup-multishot', group: 'Power-ups', label: 'Multishot', w: 32, h: 32, element: <PowerUpMultishot /> },
  { id: 'explosion-1', group: 'FX', label: 'Explosion 1', w: 48, h: 48, element: <ExplosionFrame1 /> },
  { id: 'explosion-2', group: 'FX', label: 'Explosion 2', w: 48, h: 48, element: <ExplosionFrame2 /> },
  { id: 'explosion-3', group: 'FX', label: 'Explosion 3', w: 48, h: 48, element: <ExplosionFrame3 /> },
  { id: 'hit-flash', group: 'FX', label: 'Hit flash', w: 32, h: 32, element: <HitFlash /> },
  { id: 'muzzle-flash', group: 'FX', label: 'Muzzle', w: 24, h: 24, element: <MuzzleFlash /> },
]
