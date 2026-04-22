'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { SVG_SPRITE_CATALOG, type SvgCatalogEntry } from '@/core/svgSprites'
import { rasterizeSvg } from '@/core/svgRasterizer'

const PREVIEW_SCALES = [1, 2, 4] as const

export default function SvgSpritesDebugPage() {
  const groups = useMemo(() => groupBy(SVG_SPRITE_CATALOG), [])

  return (
    <main style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={h1Style}>SVG Sprite Debug</h1>
        <p style={subStyle}>
          Each sprite is rasterized at 1×, 2× and 4× via <code>rasterizeSvg()</code>. The 4× preview
          is the resolution the game uses for drawImage.
        </p>
      </header>
      {groups.map(([group, items]) => (
        <section key={group} style={sectionStyle}>
          <h2 style={h2Style}>{group}</h2>
          <div style={gridStyle}>
            {items.map((entry) => (
              <SpriteCell key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}

function SpriteCell({ entry }: { entry: SvgCatalogEntry }) {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const svg = entry.render()
    Promise.all(
      PREVIEW_SCALES.map((scale) => rasterizeSvg(svg, entry.w, entry.h, { scale })),
    )
      .then((canvases) => {
        if (cancelled) return
        canvases.forEach((source, i) => {
          const target = canvasRefs.current[i]
          if (!target) return
          target.width = source.width
          target.height = source.height
          target.style.width = `${entry.w * PREVIEW_SCALES[i]}px`
          target.style.height = `${entry.h * PREVIEW_SCALES[i]}px`
          const ctx = target.getContext('2d')
          ctx?.drawImage(source, 0, 0)
        })
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })
    return () => {
      cancelled = true
    }
  }, [entry])

  return (
    <div style={cellStyle}>
      <div style={labelStyle}>
        <strong>{entry.label}</strong>
        <span style={dimsStyle}>
          {entry.w}×{entry.h}
        </span>
      </div>
      {error ? (
        <div style={errorStyle}>{error}</div>
      ) : (
        <div style={previewRowStyle}>
          {PREVIEW_SCALES.map((scale, i) => (
            <div key={scale} style={previewItemStyle}>
              <canvas
                ref={(el) => {
                  canvasRefs.current[i] = el
                }}
              />
              <span style={scaleLabelStyle}>{scale}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function groupBy(entries: SvgCatalogEntry[]): [string, SvgCatalogEntry[]][] {
  const map = new Map<string, SvgCatalogEntry[]>()
  for (const e of entries) {
    const arr = map.get(e.group) ?? []
    arr.push(e)
    map.set(e.group, arr)
  }
  return Array.from(map.entries())
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#05060d',
  color: '#e6edf3',
  padding: '32px 24px',
  fontFamily: 'Geist, -apple-system, system-ui, sans-serif',
}

const headerStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto 24px',
}

const h1Style: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: 0.2,
}

const subStyle: React.CSSProperties = {
  margin: '6px 0 0',
  color: '#8b98a5',
  fontSize: 14,
}

const sectionStyle: React.CSSProperties = {
  maxWidth: 1100,
  margin: '0 auto 28px',
}

const h2Style: React.CSSProperties = {
  margin: '12px 0 10px',
  fontSize: 15,
  fontWeight: 600,
  color: '#b6c2cf',
  textTransform: 'uppercase',
  letterSpacing: 1,
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
  gap: 12,
}

const cellStyle: React.CSSProperties = {
  background: '#0d111a',
  border: '1px solid #1c2432',
  borderRadius: 10,
  padding: 14,
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 10,
  fontSize: 13,
  color: '#cbd5e1',
}

const dimsStyle: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 11,
  color: '#64748b',
}

const previewRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  gap: 16,
  padding: '10px 4px',
  minHeight: 88,
  background: '#060912',
  borderRadius: 8,
}

const previewItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
}

const scaleLabelStyle: React.CSSProperties = {
  fontFamily: 'JetBrains Mono, monospace',
  fontSize: 10,
  color: '#64748b',
}

const errorStyle: React.CSSProperties = {
  color: '#fca5a5',
  fontSize: 12,
  fontFamily: 'JetBrains Mono, monospace',
}
