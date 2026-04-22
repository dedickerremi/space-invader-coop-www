// ============================================================
// SVG → Canvas rasterization.
// Serializes an SVG string into a Blob URL, loads it as an Image,
// and blits it into an HTMLCanvasElement at (w * scale) × (h * scale).
// Browser handles antialiasing — vectors stay crisp at any scale.
// ============================================================

export type RasterizeOptions = {
  /** Device-pixel scale. 4 gives crisp output on retina screens. */
  scale?: number
}

const DEFAULT_SCALE = 4

export async function rasterizeSvg(
  svgXml: string,
  width: number,
  height: number,
  options: RasterizeOptions = {},
): Promise<HTMLCanvasElement> {
  if (typeof window === 'undefined') {
    throw new Error('rasterizeSvg: must run in the browser')
  }

  const scale = options.scale ?? DEFAULT_SCALE
  const sized = injectSize(svgXml, width, height)
  const blob = new Blob([sized], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('rasterizeSvg: canvas 2D context unavailable')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

function injectSize(svgXml: string, width: number, height: number): string {
  // Prefer the rasterized Image to know its own intrinsic size, which lets the
  // browser sample the SVG at the canvas pixel grid rather than the logical
  // viewBox. We inject width/height on the root <svg>.
  return svgXml.replace(
    /<svg\b([^>]*)>/,
    (_match, attrs) => `<svg${attrs} width="${width}" height="${height}">`,
  )
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('rasterizeSvg: failed to load SVG image'))
    img.src = url
  })
}

/** Convenience: rasterize many SVGs in parallel. */
export function rasterizeAll<K extends string>(
  entries: Record<K, { svg: string; w: number; h: number }>,
  options?: RasterizeOptions,
): Promise<Record<K, HTMLCanvasElement>> {
  const keys = Object.keys(entries) as K[]
  return Promise.all(
    keys.map((k) => rasterizeSvg(entries[k].svg, entries[k].w, entries[k].h, options)),
  ).then((canvases) => {
    const out = {} as Record<K, HTMLCanvasElement>
    keys.forEach((k, i) => {
      out[k] = canvases[i]
    })
    return out
  })
}
