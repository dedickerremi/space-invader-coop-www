'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { GameClient, GameRenderer, InputManager } from '@/core'
import type { GameState, GameOverSummary } from '@/core'

// --- Types ---

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

// --- Constants ---

const WS_URL_DEFAULT =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WS_URL) || 'ws://localhost:3001'

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 600

// --- Component ---

export function GameCanvas({ matchToken, wsUrl, matchId, playerId }: GameCanvasProps) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const clientRef = useRef<GameClient | null>(null)
  const rendererRef = useRef<GameRenderer | null>(null)
  const inputRef = useRef<InputManager | null>(null)

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'ended'>('connecting')
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

  // --- Refs for values that InputManager / Renderer need without re-creating ---
  const isPausedRef = useRef(false)
  const pausedByMeRef = useRef(false)

  // Keep refs in sync
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])
  useEffect(() => { pausedByMeRef.current = pausedByMe }, [pausedByMe])

  // --- Toggle pause (used by InputManager callback) ---
  const togglePause = useCallback(() => {
    const client = clientRef.current
    if (!client) return

    if (isPausedRef.current && pausedByMeRef.current) {
      client.send({ type: 'RESUME' })
      setShowPauseMenu(false)
    } else if (!isPausedRef.current) {
      client.send({ type: 'PAUSE' })
      setShowPauseMenu(true)
    }
  }, [])

  // --- Exit game ---
  const exitGame = useCallback(() => {
    clientRef.current?.send({ type: 'EXIT' })
    sessionStorage.removeItem('matchData')
    router.push('/')
  }, [router])

  // --- Initialize GameClient ---
  useEffect(() => {
    if (!matchToken || !matchId || !playerId) {
      setStatus('error')
      setStatusText('Missing match data - please join a match')
      return
    }

    const client = new GameClient()
    clientRef.current = client

    client.on('connectionChange', (s) => {
      if (s === 'connected') {
        setStatus('connected')
        setStatusText('Connected')
      } else if (s === 'error') {
        setStatus((prev) => (prev === 'ended' ? prev : 'error'))
        setStatusText((prev) =>
          prev.includes('Error:') ? prev : 'Connection error - check if backend is running',
        )
      } else if (s === 'disconnected') {
        setStatus((prev) => (prev === 'ended' ? prev : 'error'))
        setStatusText((prev) => (prev.includes('Error:') ? prev : 'Connection closed'))
      }
    })

    client.on('welcome', (pid, mid) => {
      if (matchId) {
        setStatusText(`Match: ${matchId.slice(-6)}`)
      } else {
        setStatusText(`Connected as ${pid.slice(-6)}`)
      }
    })

    client.on('stateUpdate', (state: GameState) => {
      // Feed state to renderer
      if (rendererRef.current) {
        rendererRef.current.state = state
        rendererRef.current.localPlayerId = client.playerId
      }

      // Update pause state
      const paused = state.paused ?? false
      const byMe = state.pausedBy === client.playerId

      setIsPaused(paused)
      setPausedByMe(byMe)

      if (paused && byMe) setShowPauseMenu(true)
      if (!paused) setShowPauseMenu(false)

      // Update InputManager pause flag
      if (inputRef.current) {
        inputRef.current.paused = paused
      }

      // Update HUD
      const totalPoints = Object.values(state.points ?? {}).reduce((a, b) => a + b, 0)
      const lives = state.lives ?? 0
      const waveNumber = state.waveNumber ?? 0
      const gameOver = state.gameOver ?? false
      const gameOverSummary = state.gameOverSummary ?? null

      setHud((prev) => {
        const same =
          prev.totalPoints === totalPoints &&
          prev.lives === lives &&
          prev.waveNumber === waveNumber &&
          prev.gameOver === gameOver
        if (same && (!gameOver || prev.gameOverSummary)) return prev
        return { totalPoints, lives, waveNumber, gameOver, gameOverSummary }
      })
    })

    client.on('error', (reason) => {
      setStatus('error')
      setStatusText(`Error: ${reason}`)
    })

    client.on('matchEnded', (reason) => {
      setStatus('ended')
      setStatusText(reason)
      setTimeout(() => {
        sessionStorage.removeItem('matchData')
        router.push('/')
      }, 2000)
    })

    const effectiveWsUrl = wsUrl || WS_URL_DEFAULT
    client.connect(effectiveWsUrl, { token: matchToken, matchId, playerId })

    return () => {
      client.disconnect()
      client.removeAllListeners()
      clientRef.current = null
    }
  }, [matchToken, matchId, playerId, wsUrl, router])

  // --- Initialize Renderer ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new GameRenderer(canvas, { width: CANVAS_WIDTH, height: CANVAS_HEIGHT })
    rendererRef.current = renderer
    renderer.start()

    return () => {
      renderer.stop()
      rendererRef.current = null
    }
  }, [])

  // Keep renderer overlay flag in sync
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.showPauseOverlay = showPauseMenu
    }
  }, [showPauseMenu])

  // --- Initialize InputManager ---
  useEffect(() => {
    const input = new InputManager({
      onMove: (dir) => clientRef.current?.send({ type: 'MOVE', dir }),
      onStop: () => clientRef.current?.send({ type: 'STOP' }),
      onShoot: () => clientRef.current?.send({ type: 'SHOOT' }),
      onPause: () => togglePause(),
    })
    inputRef.current = input
    input.enableKeyboard()

    // Enable touch on canvas if available
    if (canvasRef.current) {
      input.enableTouch(canvasRef.current)
    }

    return () => {
      input.destroy()
      inputRef.current = null
    }
  }, [togglePause])

  // --- Render ---

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
        <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={canvasStyle} />

        {/* Pause Menu Overlay */}
        {showPauseMenu && (
          <div style={overlayStyle}>
            <div style={menuStyle}>
              <h2 style={menuTitleStyle}>PAUSED</h2>
              <button onClick={togglePause} style={menuButtonStyle}>Resume</button>
              <button onClick={exitGame} style={exitButtonStyle}>Exit Game</button>
            </div>
          </div>
        )}

        {/* Game Over Overlay */}
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
                <button onClick={exitGame} style={menuButtonStyle}>Return to menu</button>
              </div>
            </div>
          </div>
        )}

        {/* Match Ended Overlay */}
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

// --- Styles (unchanged) ---

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
  boxShadow: '0 0 30px rgba(0, 255, 136, 0.3), inset 0 0 60px rgba(0, 0, 0, 0.5)',
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
