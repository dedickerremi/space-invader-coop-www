// ============================================================
// Viewport — logical world ↔ screen pixels (aspect fit, resolution-independent)
// ============================================================

import { LOGICAL_WIDTH, LOGICAL_HEIGHT, clampPlayerX } from './world'

export type ViewportRect = { width: number; height: number; left: number; top: number }

/**
 * Scale to fit logical size inside container; maintain aspect ratio (no stretch).
 */
export function getScaleAndOffset(
  containerWidth: number,
  containerHeight: number,
  logicalWidth: number = LOGICAL_WIDTH,
  logicalHeight: number = LOGICAL_HEIGHT,
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
  logicalWidth: number = LOGICAL_WIDTH,
  logicalHeight: number = LOGICAL_HEIGHT,
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

/**
 * Create pixel→logical for mobile: only returns logical X when touch is in bottom 40% of view.
 */
export function createMobileMovementConverter(
  getContainerRect: () => ViewportRect,
): (clientX: number, clientY: number) => number | null {
  return (clientX: number, clientY: number): number | null => {
    const rect = getContainerRect()
    const inBottom40 = clientY >= rect.top + rect.height * 0.6
    if (!inBottom40) return null
    const { x } = screenToLogical(clientX, clientY, rect)
    return clampPlayerX(x)
  }
}
