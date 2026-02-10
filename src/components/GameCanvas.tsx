'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { GameState, ServerMessage, ClientMessage, GameOverSummary } from '@/types/game'

type HudState = {
  totalPoints: number
  lives: number
  waveNumber: number
  gameOver: boolean
  gameOverSummary: GameOverSummary | null
}

type GameCanvasProps = {
  matchToken?: string
  wsUrl?: string
  matchId?: string
  playerId?: string
}

const WS_URL_DEFAULT =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WS_URL) || 'ws://localhost:3001'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600
const PLAYER_WIDTH = 40
const PLAYER_HEIGHT = 20
const PLAYER_Y = 550
const BULLET_SIZE = 4

const ENEMY_SIZE = 24

const COLORS = {
  player1: '#00ff88',
  player2: '#00aaff',
  playerDead: '#333',
  bullet: '#ffff00',
  enemy: '#ff4444',
  enemyGlow: 'rgba(255, 68, 68, 0.6)',
  background: '#050508',
}

export function GameCanvas({ matchToken, wsUrl, matchId, playerId }: GameCanvasProps) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const stateRef = useRef<GameState | null>(null)
  const playerIdRef = useRef<string | null>(null)
  const wsInitializedRef = useRef(false) // Track if WS was initialized

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'ended'>(
    'connecting'
  )
  const [statusText, setStatusText] = useState('Connecting...')
  const [showPauseMenu, setShowPauseMenu] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [pausedByMe, setPausedByMe] = useState(false)
  const [hud, setHud] = useState<HudState>({
    totalPoints: 0,
    lives: 0,
    waveNumber: 0,
    gameOver: false,
    gameOverSummary: null,
  })

  // Initialize WebSocket connection once (no useEffect)
  const effectiveWsUrl = wsUrl || WS_URL_DEFAULT
  if (!wsInitializedRef.current && matchToken && matchId && playerId && effectiveWsUrl) {
    wsInitializedRef.current = true

    console.log('[WS] Initializing connection...')
    const params = new URLSearchParams({
      token: matchToken,
      matchId,
      playerId,
    })
    const ws = new WebSocket(`${effectiveWsUrl}?${params.toString()}`)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      setStatus('connected')
      setStatusText('Connected')
    }

    ws.onclose = (event) => {
      console.log('[WS] Disconnected', event.code, event.reason)
      wsRef.current = null
      setStatus((prevStatus) => {
        if (prevStatus === 'ended') return prevStatus
        return 'error'
      })
      setStatusText((prevText) => {
        if (prevText.includes('Error:')) return prevText
        return 'Connection closed'
      })
    }

    ws.onerror = (err) => {
      console.error('[WS] Error:', err)
      setStatus('error')
      setStatusText('Connection error - check if backend is running')
    }

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data)
        console.log('[WS] Received:', message.type)

        switch (message.type) {
          case 'STATE': {
            const s = message.state
            stateRef.current = s
            setIsPaused(s.paused ?? false)
            setPausedByMe(s.pausedBy === playerIdRef.current)
            if (s.paused && s.pausedBy === playerIdRef.current) {
              setShowPauseMenu(true)
            }
            if (!s.paused) {
              setShowPauseMenu(false)
            }
            // Update HUD in React state so header re-renders (ref alone doesn't trigger render)
            const totalPoints = Object.values(s.points ?? {}).reduce((a, b) => a + b, 0)
            const lives = s.lives ?? 0
            const waveNumber = s.waveNumber ?? 0
            const gameOver = s.gameOver ?? false
            const gameOverSummary = s.gameOverSummary ?? null
            setHud((prev) => {
              const same =
                prev.totalPoints === totalPoints &&
                prev.lives === lives &&
                prev.waveNumber === waveNumber &&
                prev.gameOver === gameOver
              if (same && (!gameOver || prev.gameOverSummary)) return prev
              return { totalPoints, lives, waveNumber, gameOver, gameOverSummary }
            })
            break
          }
          case 'WELCOME':
            playerIdRef.current = message.playerId
            if (matchId) {
              setStatusText(`Match: ${matchId.slice(-6)}`)
            } else {
              setStatusText(`Connected as ${message.playerId.slice(-6)}`)
            }
            break
          case 'ERROR':
            console.error('[WS] Server error:', message.reason)
            setStatus('error')
            setStatusText(`Error: ${message.reason}`)
            setTimeout(() => {
              if (wsRef.current) {
                wsRef.current.close()
              }
            }, 2000)
            break
          case 'MATCH_ENDED':
            setStatus('ended')
            setStatusText(message.reason)
            setTimeout(() => {
              sessionStorage.removeItem('matchData')
              router.push('/')
            }, 2000)
            break
        }
      } catch {
        console.warn('[WS] Failed to parse message')
      }
    }
  } else if (!matchToken || !matchId || !playerId || !effectiveWsUrl) {
    if (!wsInitializedRef.current) {
      console.error('[WS] Missing match data:', { matchToken, matchId, playerId, wsUrl: effectiveWsUrl })
      setStatus('error')
      setStatusText('Missing match data - please join a match')
    }
  }

  // Send message to server
  const send = useCallback((message: ClientMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  // Toggle pause
  const togglePause = useCallback(() => {
    if (isPaused && pausedByMe) {
      send({ type: 'RESUME' })
      setShowPauseMenu(false)
    } else if (!isPaused) {
      send({ type: 'PAUSE' })
      setShowPauseMenu(true)
    }
  }, [isPaused, pausedByMe, send])

  // Exit game
  const exitGame = useCallback(() => {
    send({ type: 'EXIT' })
    sessionStorage.removeItem('matchData')
    router.push('/')
  }, [send, router])

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

    const enemies = state.enemies ?? []
    const lives = state.lives ?? 0
    const points = state.points ?? {}
    const totalPoints = Object.values(points).reduce((a, b) => a + b, 0)

    // Waiting message
    if (!state.started) {
      ctx.fillStyle = '#666'
      ctx.font = '24px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for opponent...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
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

    // Draw enemies
    const half = ENEMY_SIZE / 2
    for (const e of enemies) {
      ctx.fillStyle = COLORS.enemy
      ctx.shadowColor = COLORS.enemyGlow
      ctx.shadowBlur = 12
      ctx.fillRect(e.x - half, e.y - half, ENEMY_SIZE, ENEMY_SIZE)
      ctx.shadowBlur = 0
    }

    // Draw pause indicator if paused (but not showing menu - e.g. other player paused)
    if (state.paused && !showPauseMenu) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      ctx.fillStyle = '#fff'
      ctx.font = '24px JetBrains Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillText('PAUSED', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.font = '14px JetBrains Mono, monospace'
      ctx.fillText('Waiting for other player...', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 30)
    }
  }, [showPauseMenu])

  // Cleanup WebSocket on unmount (minimal useEffect only for cleanup)
  useEffect(() => {
    return () => {
      console.log('[WS] Cleaning up connection on unmount')
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      wsInitializedRef.current = false
    }
  }, []) // Empty deps - only cleanup on unmount

  // Input handling
  useEffect(() => {
    let leftPressed = false
    let rightPressed = false

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to toggle pause
      if (e.key === 'Escape') {
        e.preventDefault()
        togglePause()
        return
      }

      // Don't process game inputs if paused
      if (isPaused) return

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
      // Don't process game inputs if paused
      if (isPaused) return

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
  }, [send, isPaused, togglePause])

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

  const { totalPoints, lives, gameOver, gameOverSummary } = hud

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1 style={titleStyle}>Space Invaders</h1>
        <div style={scoreLivesStyle}>
          <span style={scoreStyle}>Score: {totalPoints}</span>
          <span style={livesStyle}>Lives: {lives}</span>
        </div>
        <button onClick={togglePause} style={pauseButtonStyle} title="Pause (Esc)" disabled={gameOver}>
          ⏸
        </button>
      </div>

      <div style={canvasContainerStyle}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          style={canvasStyle}
        />

        {/* Pause Menu Overlay */}
        {showPauseMenu && (
          <div style={overlayStyle}>
            <div style={menuStyle}>
              <h2 style={menuTitleStyle}>PAUSED</h2>
              <button onClick={togglePause} style={menuButtonStyle}>
                Resume
              </button>
              <button onClick={exitGame} style={exitButtonStyle}>
                Exit Game
              </button>
            </div>
          </div>
        )}

        {/* Game Over Overlay (no lives left) */}
        {gameOver && gameOverSummary && (
          <div style={overlayStyle}>
            <div style={menuStyle}>
              <h2 style={menuTitleStyle}>Game Over</h2>
              <p style={{ color: '#888', marginBottom: '1rem' }}>No lives left!</p>
              <div style={summaryTableStyle}>
                <div style={summaryRowStyle}>
                  <span style={summaryHeaderStyle}>Player</span>
                  <span style={summaryHeaderStyle}>Kills</span>
                  <span style={summaryHeaderStyle}>Points</span>
                </div>
                {gameOverSummary.playerScores.map((s, i) => (
                  <div key={s.playerId} style={summaryRowStyle}>
                    <span style={s.playerId === playerId ? summaryYouStyle : undefined}>
                      {s.playerId === playerId ? 'You' : `P${i + 1}`}
                    </span>
                    <span>{s.kills}</span>
                    <span>{s.points}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button onClick={exitGame} style={menuButtonStyle}>
                  Return to menu
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Match Ended Overlay (disconnect / exit) */}
        {status === 'ended' && !gameOver && (
          <div style={overlayStyle}>
            <div style={menuStyle}>
              <h2 style={menuTitleStyle}>MATCH ENDED</h2>
              <p style={{ color: '#888', marginBottom: '1rem' }}>{statusText}</p>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>Returning to menu...</p>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          ...statusTextStyle,
          color:
            status === 'connected'
              ? '#00ff88'
              : status === 'error' || status === 'ended'
                ? '#ff4444'
                : '#666',
        }}
      >
        {statusText}
      </div>

      <div style={controlsStyle}>
        <kbd style={kbdStyle}>←</kbd> <kbd style={kbdStyle}>→</kbd> Move
        &nbsp;&nbsp;
        <kbd style={kbdStyle}>Space</kbd> Shoot
        &nbsp;&nbsp;
        <kbd style={kbdStyle}>Esc</kbd> Pause
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0a0a0f',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'JetBrains Mono, Fira Code, monospace',
  color: '#e0e0e0',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  marginBottom: '1rem',
}

const titleStyle: React.CSSProperties = {
  fontSize: '1.5rem',
  color: '#00ff88',
  textTransform: 'uppercase',
  letterSpacing: '0.3em',
  textShadow: '0 0 20px rgba(0, 255, 136, 0.5)',
  margin: 0,
}

const scoreLivesStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  alignItems: 'center',
  fontSize: '1rem',
}
const scoreStyle: React.CSSProperties = { color: '#00ff88' }
const livesStyle: React.CSSProperties = { color: '#ffaa00' }

const summaryTableStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  minWidth: '220px',
  marginBottom: '0.5rem',
}
const summaryRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr 1fr',
  gap: '1rem',
  fontSize: '0.9rem',
}
const summaryHeaderStyle: React.CSSProperties = {
  fontWeight: 'bold',
  color: '#00ff88',
}
const summaryYouStyle: React.CSSProperties = {
  color: '#00aaff',
  fontWeight: 'bold',
}

const pauseButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #444',
  color: '#888',
  fontSize: '1.2rem',
  padding: '0.3rem 0.6rem',
  cursor: 'pointer',
  borderRadius: '4px',
  transition: 'all 0.2s',
}

const canvasContainerStyle: React.CSSProperties = {
  position: 'relative',
}

const canvasStyle: React.CSSProperties = {
  border: '2px solid #00ff88',
  boxShadow:
    '0 0 30px rgba(0, 255, 136, 0.3), inset 0 0 60px rgba(0, 0, 0, 0.5)',
  background: '#050508',
  display: 'block',
}

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.85)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const menuStyle: React.CSSProperties = {
  background: '#0a0a0f',
  border: '2px solid #00ff88',
  padding: '2rem 3rem',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '1rem',
  boxShadow: '0 0 30px rgba(0, 255, 136, 0.3)',
}

const menuTitleStyle: React.CSSProperties = {
  color: '#00ff88',
  fontSize: '1.5rem',
  textTransform: 'uppercase',
  letterSpacing: '0.2em',
  margin: 0,
  marginBottom: '1rem',
}

const menuButtonStyle: React.CSSProperties = {
  padding: '0.75rem 2rem',
  background: 'transparent',
  border: '2px solid #00ff88',
  color: '#00ff88',
  fontSize: '1rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  width: '100%',
  transition: 'all 0.2s',
}

const exitButtonStyle: React.CSSProperties = {
  ...menuButtonStyle,
  borderColor: '#ff4444',
  color: '#ff4444',
}

const statusTextStyle: React.CSSProperties = {
  marginTop: '1rem',
  fontSize: '0.875rem',
}

const controlsStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  fontSize: '0.75rem',
  color: '#444',
  textAlign: 'center',
}

const kbdStyle: React.CSSProperties = {
  background: '#1a1a24',
  border: '1px solid #333',
  borderRadius: '4px',
  padding: '0.2em 0.5em',
  margin: '0 0.2em',
}
