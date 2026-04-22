// ============================================================
// Ships — Player ship catalog (pixel-art layered sprites)
// ============================================================

export type ShipKey = 'classic' | 'fighter' | 'falcon' | 'xwing'

export type TintName = 'hull' | 'accent' | 'engine' | 'cockpit'

export type ShipLayer = { pattern: number[][]; tint: TintName }

export type ShipDef = {
  key: ShipKey
  name: string
  description: string
  /** Canonical 15×11 multi-tint grid. 1=hull, 2=accent, 3=cockpit, 4=engine. */
  grid: number[][]
  /** Per-tint 0/1 layers derived from grid — kept for compatibility with createLayeredSprite. */
  layers: ShipLayer[]
}

// Ship pixel grids. All 15 wide x 11 tall. Tint indices: 1=hull, 2=accent, 3=cockpit, 4=engine.

const CLASSIC = [
  [0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 3, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 2, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  [1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 2, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 1, 4, 4, 4, 1, 0, 0, 1, 0, 1],
  [0, 0, 0, 0, 0, 0, 4, 0, 4, 0, 0, 0, 0, 0, 0],
]

const FIGHTER = [
  [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 1, 1, 3, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 3, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 2, 2, 2, 1, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1],
  [1, 0, 0, 0, 1, 1, 1, 2, 1, 1, 1, 0, 0, 0, 1],
  [0, 0, 0, 0, 1, 4, 1, 0, 1, 4, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 4, 0, 0, 0, 4, 0, 0, 0, 0, 0],
]

const FALCON = [
  [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 1, 1, 1, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  [1, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0],
  [1, 1, 2, 2, 2, 3, 3, 2, 2, 2, 1, 1, 1, 3, 0],
  [1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 1, 1, 1, 3, 3],
  [1, 1, 2, 2, 2, 3, 3, 2, 2, 2, 1, 1, 1, 3, 0],
  [1, 1, 1, 2, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 1, 4, 1, 1, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 4, 4, 4, 0, 0, 0, 0, 0, 0, 0, 0],
]

const XWING = [
  [1, 2, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 2, 1],
  [1, 1, 2, 0, 0, 0, 1, 1, 1, 0, 0, 0, 2, 1, 1],
  [0, 1, 1, 2, 0, 0, 1, 3, 1, 0, 0, 2, 1, 1, 0],
  [0, 0, 1, 1, 2, 1, 1, 3, 1, 1, 2, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 1, 2, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 2, 1, 1, 1, 1, 1, 2, 1, 1, 0, 0],
  [0, 1, 1, 2, 0, 0, 1, 1, 1, 0, 0, 2, 1, 1, 0],
  [1, 1, 2, 0, 0, 0, 1, 4, 1, 0, 0, 0, 2, 1, 1],
  [1, 2, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 2, 1],
]

const TINT_BY_INDEX: Record<number, TintName> = { 1: 'hull', 2: 'accent', 3: 'cockpit', 4: 'engine' }

/** Split a multi-tint grid into one 0/1 layer per tint index present. */
function gridToLayers(grid: number[][]): ShipLayer[] {
  const h = grid.length
  const w = grid[0].length
  const layers: ShipLayer[] = []
  for (const idx of [1, 2, 3, 4] as const) {
    let hit = false
    const pattern: number[][] = Array.from({ length: h }, () => new Array(w).fill(0))
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (grid[y][x] === idx) {
          pattern[y][x] = 1
          hit = true
        }
      }
    }
    if (hit) layers.push({ pattern, tint: TINT_BY_INDEX[idx] })
  }
  return layers
}

function defineShip(key: ShipKey, name: string, description: string, grid: number[][]): ShipDef {
  return { key, name, description, grid, layers: gridToLayers(grid) }
}

export const SHIPS: Record<ShipKey, ShipDef> = {
  classic: defineShip('classic', 'Classic', 'Arcade cannon', CLASSIC),
  fighter: defineShip('fighter', 'Fighter', 'Interceptor', FIGHTER),
  falcon: defineShip('falcon', 'Falcon', 'Light freighter', FALCON),
  xwing: defineShip('xwing', 'X-Wing', 'Rebel starfighter', XWING),
}

export const SHIP_ORDER: ShipKey[] = ['classic', 'fighter', 'falcon', 'xwing']

/** Resolve a named tint for a given hull color. */
export function resolveTint(tint: TintName, hull: string): string {
  if (tint === 'hull') return hull
  if (tint === 'cockpit') return '#eaffff'
  if (tint === 'accent') {
    if (hull === '#00ff88') return '#66ffbb'
    if (hull === '#00aaff') return '#88d4ff'
    return '#b0b0b0'
  }
  // engine glow
  if (hull === '#00ff88') return '#aaffe0'
  if (hull === '#00aaff') return '#bbe8ff'
  return '#cccccc'
}

export function getShip(key: ShipKey | null | undefined): ShipDef {
  if (key && key in SHIPS) return SHIPS[key]
  return SHIPS.fighter
}
