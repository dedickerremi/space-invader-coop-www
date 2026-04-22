// ============================================================
// SVG → Canvas rasterization.
// Takes a React element containing an <svg>, serializes it to
// markup via react-dom/server, then loads that markup as an
// <img> and blits it into an HTMLCanvasElement at scaled size.
// Browser antialiasing keeps vectors crisp at any scale.
// ============================================================

import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

export type RasterizeOptions = {
  /** Device-pixel scale. 4 gives crisp output on retina screens. */
  scale?: number
}

const DEFAULT_SCALE = 4

export async function rasterizeElement(
  element: ReactElement,
  width: number,
  height: number,
  options: RasterizeOptions = {},
): Promise<HTMLCanvasElement> {
  if (typeof window === 'undefined') {
    throw new Error('rasterizeElement: must run in the browser')
  }

  const scale = options.scale ?? DEFAULT_SCALE
  const markup = renderToStaticMarkup(element)
  const sized = injectSize(markup, width, height)
  const blob = new Blob([sized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('rasterizeElement: canvas 2D context unavailable')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

function injectSize(svgXml: string, width: number, height: number): string {
  return svgXml.replace(
    /<svg\b([^>]*)>/,
    (_match, attrs) => `<svg${attrs} width="${width}" height="${height}">`,
  )
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('rasterizeElement: failed to load SVG image'))
    img.src = url
  })
}
