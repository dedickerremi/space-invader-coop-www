'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { GameState, ServerMessage, ClientMessage } from '@/types/game'

const WS_URL = 'ws://localhost:3001'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const PLAYER_WIDTH = 40
const PLAYER_HEIGHT = 20
const PLAYER_Y = 550
const BULLET_SIZE = 4

const COLORS = {
  player1: '#00ff88',
  player2: '#00aaff',
  playerDead: '#333',
  bullet: '#ffff00',
  background: '#050508',
}

export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const stateRef = useRef<GameState | null>(null)
  const playerIdRef = useRef<string | null>(null)

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>(
    'connecting'
  )
  const [statusText, setStatusText] = useState('Connecting...')

  // Send message to server
  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  // Render game state to canvas
  const render = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    const state = stateRef.current

    if (!ctx || !canvas) return

    // Clear
    ctx.fillStyle = COLORS.background
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    if (!state) return

    // Waiting message
    if (!state.started) {
      ctx.fillStyle = '#666'
      ctx.font = '24px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for players...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.font = '14px JetBrains Mono, monospace'
      ctx.fillText(
        `${state.players.length}/2 connected`,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 30
      )
      return
    }

    // Draw players
    state.players.forEach((player, index) => {
      let color: string

      if (!player.alive) {
        color = COLORS.playerDead
      } else if (player.id === playerIdRef.current) {
        color = COLORS.player1
      } else {
        color = COLORS.player2
      }

      // Player body
      ctx.fillStyle = color
      ctx.fillRect(
        player.x - PLAYER_WIDTH / 2,
        PLAYER_Y - PLAYER_HEIGHT / 2,
        PLAYER_WIDTH,
        PLAYER_HEIGHT
      )

      // Glow effect
      if (player.alive) {
        ctx.shadowColor = color
        ctx.shadowBlur = 15
        ctx.fillRect(
          player.x - PLAYER_WIDTH / 2,
          PLAYER_Y - PLAYER_HEIGHT / 2,
          PLAYER_WIDTH,
          PLAYER_HEIGHT
        )
        ctx.shadowBlur = 0
      }

      // Player label
      ctx.fillStyle = '#fff'
      ctx.font = '10px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      const label = player.id === playerIdRef.current ? 'YOU' : `P${index + 1}`
      ctx.fillText(label, player.x, PLAYER_Y + 25)
    })

    // Draw bullets
    ctx.fillStyle = COLORS.bullet
    ctx.shadowColor = COLORS.bullet
    ctx.shadowBlur = 10

    for (const bullet of state.bullets) {
      ctx.beginPath()
      ctx.arc(bullet.x, bullet.y, BULLET_SIZE, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.shadowBlur = 0
  }, [])

  // WebSocket connection
  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      setStatus('connected')
      setStatusText('Connected')
    }

    ws.onclose = () => {
      console.log('[WS] Disconnected')
      setStatus('error')
      setStatusText('Disconnected - Refresh to reconnect')
    }

    ws.onerror = (err) => {
      console.error('[WS] Error:', err)
    }

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data)

        switch (message.type) {
          case 'STATE':
            stateRef.current = message.state
            break
          case 'WELCOME':
            playerIdRef.current = message.playerId
            setStatusText(`Connected as ${message.playerId.slice(-6)}`)
            break
          case 'ERROR':
            setStatus('error')
            setStatusText(`Error: ${message.reason}`)
            break
        }
      } catch {
        console.warn('[WS] Failed to parse message')
      }
    }

    return () => {
      ws.close()
    }
  }, [])

  // Input handling
  useEffect(() => {
    let leftPressed = false
    let rightPressed = false

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault()
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (!leftPressed) {
            leftPressed = true
            send({ type: 'MOVE', dir: -1 })
          }
          break
        case 'ArrowRight':
          if (!rightPressed) {
            rightPressed = true
            send({ type: 'MOVE', dir: 1 })
          }
          break
        case ' ':
          send({ type: 'SHOOT' })
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          leftPressed = false
          if (rightPressed) {
            send({ type: 'MOVE', dir: 1 })
          } else {
            send({ type: 'STOP' })
          }
          break
        case 'ArrowRight':
          rightPressed = false
          if (leftPressed) {
            send({ type: 'MOVE', dir: -1 })
          } else {
            send({ type: 'STOP' })
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [send])

  // Render loop
  useEffect(() => {
    let animationId: number

    const loop = () => {
      render()
      animationId = requestAnimationFrame(loop)
    }

    loop()

    return () => {
      cancelAnimationFrame(animationId)
    }
  }, [render])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'JetBrains Mono, Fira Code, monospace',
        color: '#e0e0e0',
      }}
    >
      <h1
        style={{
          fontSize: '1.5rem',
          marginBottom: '1rem',
          color: '#00ff88',
          textTransform: 'uppercase',
          letterSpacing: '0.3em',
          textShadow: '0 0 20px rgba(0, 255, 136, 0.5)',
        }}
      >
        Space Invaders
      </h1>

      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          border: '2px solid #00ff88',
          boxShadow:
            '0 0 30px rgba(0, 255, 136, 0.3), inset 0 0 60px rgba(0, 0, 0, 0.5)',
          background: '#050508',
        }}
      />

      <div
        style={{
          marginTop: '1rem',
          fontSize: '0.875rem',
          color:
            status === 'connected'
              ? '#00ff88'
              : status === 'error'
                ? '#ff4444'
                : '#666',
        }}
      >
        {statusText}
      </div>

      <div
        style={{
          marginTop: '1.5rem',
          fontSize: '0.75rem',
          color: '#444',
          textAlign: 'center',
        }}
      >
        <kbd style={kbdStyle}>←</kbd> <kbd style={kbdStyle}>→</kbd> Move
        &nbsp;&nbsp;
        <kbd style={kbdStyle}>Space</kbd> Shoot
      </div>
    </div>
  )
}

const kbdStyle: React.CSSProperties = {
  background: '#1a1a24',
  border: '1px solid #333',
  borderRadius: '4px',
  padding: '0.2em 0.5em',
  margin: '0 0.2em',
}

