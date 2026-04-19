'use client'

import { useEffect, useRef, useState } from 'react'
import { SHIPS, SHIP_ORDER, createLayeredSprite, resolveTint } from '@/core'
import type { ShipKey } from '@/core'

const STORAGE_KEY = 'shipKey'
const PREVIEW_SIZE = 72
const PREVIEW_HULL = '#00ff88'

/**
 * Small canvas rendering one ship at fixed size, crisp pixel scaling.
 */
function ShipPreview({ shipKey, selected }: { shipKey: ShipKey; selected: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const ship = SHIPS[shipKey]
    const sprite = createLayeredSprite(
      ship.layers.map((l) => ({ pattern: l.pattern, color: resolveTint(l.tint, PREVIEW_HULL) })),
    )

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    canvas.width = PREVIEW_SIZE * dpr
    canvas.height = PREVIEW_SIZE * dpr
    canvas.style.width = `${PREVIEW_SIZE}px`
    canvas.style.height = `${PREVIEW_SIZE}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false

    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)

    // Subtle glow while selected.
    if (selected) {
      ctx.shadowColor = PREVIEW_HULL
      ctx.shadowBlur = 16
    }

    // Preserve sprite aspect ratio inside the preview square.
    const sw = sprite.width
    const sh = sprite.height
    const scale = Math.min((PREVIEW_SIZE - 8) / sw, (PREVIEW_SIZE - 8) / sh)
    const dw = sw * scale
    const dh = sh * scale
    const dx = (PREVIEW_SIZE - dw) / 2
    const dy = (PREVIEW_SIZE - dh) / 2
    ctx.drawImage(sprite, dx, dy, dw, dh)
  }, [shipKey, selected])

  return <canvas ref={canvasRef} style={{ display: 'block' }} />
}

export function ShipSelector() {
  const [selected, setSelected] = useState<ShipKey>('fighter')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && stored in SHIPS) setSelected(stored as ShipKey)
  }, [])

  const choose = (key: ShipKey) => {
    setSelected(key)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, key)
    }
  }

  return (
    <div style={wrapperStyle}>
      <div style={labelStyle}>Pick your ship</div>
      <div style={gridStyle}>
        {SHIP_ORDER.map((key) => {
          const ship = SHIPS[key]
          const isSel = key === selected
          return (
            <button
              key={key}
              type="button"
              onClick={() => choose(key)}
              aria-pressed={isSel}
              style={{
                ...cellStyle,
                borderColor: isSel ? '#00ff88' : '#333',
                boxShadow: isSel ? '0 0 18px rgba(0, 255, 136, 0.35)' : 'none',
              }}
            >
              <ShipPreview shipKey={key} selected={isSel} />
              <span style={nameStyle}>{ship.name}</span>
              <span style={descStyle}>{ship.description}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// --- Styles ---

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.75rem',
  marginBottom: '2rem',
}

const labelStyle: React.CSSProperties = {
  color: '#666',
  fontSize: '0.8rem',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
}

const gridStyle: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const cellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.6rem 0.75rem',
  background: '#0d0d14',
  border: '2px solid #333',
  borderRadius: 6,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: '#e0e0e0',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  minWidth: 96,
}

const nameStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  color: '#e0e0e0',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginTop: '0.3rem',
}

const descStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  color: '#666',
}
