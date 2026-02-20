// ============================================================
// Viewport — logical world ↔ screen pixels (aspect fit, resolution-independent)
// ============================================================

import { getLogicalWidth, getLogicalHeight, clampPlayerX } from './world'

export type ViewportRect = { width: number; height: number; left: number; top: number }

/**
 * Scale to fit logical size inside container; maintain aspect ratio (no stretch).
 */
export function getScaleAndOffset(
  containerWidth: number,
  containerHeight: number,
  logicalWidth: number = getLogicalWidth(),
  logicalHeight: number = getLogicalHeight(),
): { scale: number; offsetX: number; offsetY: number } {
  const scaleX = containerWidth / logicalWidth
  const scaleY = containerHeight / logicalHeight
  const scale = Math.min(scaleX, scaleY)
  const scaledWidth = logicalWidth * scale
  const scaledHeight = logicalHeight * scale
  const offsetX = (containerWidth - scaledWidth) / 2
  const offsetY = (containerHeight - scaledHeight) / 2
  return { scale, offsetX, offsetY }
}

/**
 * Screen pixel (clientX, clientY) relative to container → logical (x, y).
 */
export function screenToLogical(
  clientX: number,
  clientY: number,
  rect: ViewportRect,
  logicalWidth: number = getLogicalWidth(),
  logicalHeight: number = getLogicalHeight(),
): { x: number; y: number } {
  const { scale, offsetX, offsetY } = getScaleAndOffset(
    rect.width,
    rect.height,
    logicalWidth,
    logicalHeight,
  )
  const localX = clientX - rect.left - offsetX
  const localY = clientY - rect.top - offsetY
  return {
    x: localX / scale,
    y: localY / scale,
  }
}

/** Center dead zone (logical width): touch in this band = stay still (return null). */
const MOBILE_DEAD_ZONE_CENTER = 120

/** Soften edges: touch at screen edge maps to ~85% toward game edge so movement feels less extreme. */
const MOBILE_EDGE_SOFTEN = 0.85

export type MobileConverterOptions = {
  /** When true, wrapper is portrait (center-crop); map touch X to visible center band only. */
  portraitCrop?: boolean
}

/**
 * Create pixel→logical for mobile: only returns logical X when touch is in bottom 40% of view.
 * Center dead zone = stay still; softened edges = more precise control.
 * portraitCrop: when wrapper is portrait, map touch X to the visible center band of the game.
 */
export function createMobileMovementConverter(
  getContainerRect: () => ViewportRect,
  options: MobileConverterOptions = {},
): (clientX: number, clientY: number) => number | null {
  const { portraitCrop = false } = options
  return (clientX: number, clientY: number): number | null => {
    const rect = getContainerRect()
    const inBottom40 = clientY >= rect.top + rect.height * 0.6
    if (!inBottom40) return null
    let x: number
    if (portraitCrop) {
      const lh = getLogicalHeight()
      const lw = getLogicalWidth()
      const visibleWidthLogical = lh * (rect.width / rect.height)
      const left = lw / 2 - visibleWidthLogical / 2
      const t = (clientX - rect.left) / rect.width
      x = left + t * visibleWidthLogical
    } else {
      const out = screenToLogical(clientX, clientY, rect)
      x = out.x
    }
    const clamped = clampPlayerX(x)
    const center = getLogicalWidth() / 2
    if (Math.abs(clamped - center) <= MOBILE_DEAD_ZONE_CENTER) return null
    const fromCenter = clamped - center
    const softened = center + fromCenter * MOBILE_EDGE_SOFTEN
    return clampPlayerX(softened)
  }
}
