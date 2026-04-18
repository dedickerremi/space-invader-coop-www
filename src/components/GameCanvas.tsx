'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  GameClient,
  GameRenderer,
  InputBridge,
  DesktopInputAdapter,
  MobileInputAdapter,
  createMobileMovementConverter,
  fetchGameMeta,
  setGameMeta,
  getDefaultMeta,
  getGameMeta,
  getLogicalWidth,
  getLogicalHeight,
} from '@/core'
import type { GameState, GameOverSummary, Bullet, GameMode } from '@/core'
import { SignInHint } from '@/components/SignInHint'

// --- Types ---

type PlayerHud = {
  id: string
  displayName?: string
  lives: number
  alive: boolean
  respawnTimer: number
  killStreak: number
}

type HudState = {
  totalPoints: number
  lives: number
  players: PlayerHud[]
  waveNumber: number
  gameOver: boolean
  gameOverSummary: GameOverSummary | null
}

type GameCanvasProps = {
  matchToken?: string
  wsUrl?: string
  matchId?: string
  playerId?: string
  mode?: GameMode
  /** Clerk session JWT getter. Returns null for signed-out/guest sessions. */
  getAuthToken?: () => Promise<string | null>
}

// --- Constants ---

const WS_URL_DEFAULT =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_WS_URL) || 'ws://localhost:3001'

// Canvas size comes from backend meta (set after fetch)

/** Hit flash duration (ms); optional vibration on kill */
const HIT_FEEDBACK_MS = 80
const VIBRATE_MS = 50

// --- Component ---

export function GameCanvas({ matchToken, wsUrl, matchId, playerId, mode = 'coop', getAuthToken }: GameCanvasProps) {
  const router = useRouter()
  const gameViewContainerRef = useRef<HTMLDivElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const clientRef = useRef<GameClient | null>(null)
  const rendererRef = useRef<GameRenderer | null>(null)
  const bridgeRef = useRef<InputBridge | null>(null)
  const adapterRef = useRef<DesktopInputAdapter | MobileInputAdapter | null>(null)
  const lastKillsRef = useRef<number>(0)

  // Client-side bullet prediction: phantom bullets shown instantly on SHOOT,
  // removed when server confirms or after timeout.
  type PhantomBullet = Bullet & { createdAt: number }
  const phantomBulletsRef = useRef<PhantomBullet[]>([])
  const prevLocalBulletCountRef = useRef(0)

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'ended'>('connecting')
  const [statusText, setStatusText] = useState('Connecting...')
  const [showPauseMenu, setShowPauseMenu] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [pausedByMe, setPausedByMe] = useState(false)
  const [pingMs, setPingMs] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [hud, setHud] = useState<HudState>({
    totalPoints: 0,
    lives: 0,
    players: [],
    waveNumber: 0,
    gameOver: false,
    gameOverSummary: null,
  })

  // Mobile/tablet: touch or viewport ≤ 1024px → slide + auto-fire
  useEffect(() => {
    const check = () =>
      setIsMobile(
        typeof window !== 'undefined' &&
          ('ontouchstart' in window || window.innerWidth <= 1024),
      )
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // --- Refs for bridge / renderer ---
  const isPausedRef = useRef(false)
  const pausedByMeRef = useRef(false)

  // Keep refs in sync
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])
  useEffect(() => { pausedByMeRef.current = pausedByMe }, [pausedByMe])

  // --- Toggle pause (used by input bridge callback) ---
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

  // --- Initialize GameClient (fetch game meta first so renderer has backend dimensions) ---
  useEffect(() => {
    if (!matchToken || !matchId || !playerId) {
      setStatus('error')
      setStatusText('Missing match data - please join a match')
      return
    }

    const effectiveWsUrl = wsUrl || WS_URL_DEFAULT

    let cancelled = false
    ;(async () => {
      try {
        await fetchGameMeta(effectiveWsUrl)
      } catch {
        if (!cancelled) setGameMeta(getDefaultMeta())
      }
    })()

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
      const paused = state.paused ?? false
      const byMe = state.pausedBy === client.playerId
      bridgeRef.current?.setPaused(paused)

      setIsPaused(paused)
      setPausedByMe(byMe)
      if (paused && byMe) setShowPauseMenu(true)
      if (!paused) setShowPauseMenu(false)

      // Client-side prediction: bridge.tick(serverX) → predicted X for local player
      const localPlayer = state.players.find((p) => p.id === client.playerId)
      const serverX = localPlayer?.x ?? 300
      const predictedX = bridgeRef.current?.tick(serverX) ?? serverX

      // --- Phantom bullet reconciliation ---
      const now = performance.now()
      const MAX_PHANTOM_MS = 600

      // Remove phantoms older than timeout (safety net for edge cases)
      phantomBulletsRef.current = phantomBulletsRef.current.filter(
        b => now - b.createdAt < MAX_PHANTOM_MS,
      )

      // When server confirms new bullets from local player, remove oldest phantoms
      const localServerBullets = state.bullets.filter(b => b.ownerId === client.playerId).length
      const delta = localServerBullets - prevLocalBulletCountRef.current
      if (delta > 0) {
        phantomBulletsRef.current.splice(0, delta)
      }
      prevLocalBulletCountRef.current = localServerBullets

      // Move remaining phantoms up at server bullet speed
      const bSpeed = getGameMeta().bulletSpeed
      phantomBulletsRef.current = phantomBulletsRef.current
        .map(b => ({ ...b, y: b.y - bSpeed }))
        .filter(b => b.y > 0)

      const stateForRender: GameState = {
        ...state,
        players: state.players.map((p) =>
          p.id === client.playerId ? { ...p, x: predictedX } : p,
        ),
        bullets: [...state.bullets, ...phantomBulletsRef.current],
      }

      if (rendererRef.current) {
        rendererRef.current.state = stateForRender
        rendererRef.current.localPlayerId = client.playerId
      }

      // Hit feedback: kills increased → flash + optional vibration
      const kills = state.kills?.[client.playerId ?? ''] ?? 0
      if (kills > lastKillsRef.current) {
        lastKillsRef.current = kills
        if (rendererRef.current) rendererRef.current.hitFlashUntil = performance.now() + HIT_FEEDBACK_MS
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(VIBRATE_MS)
      }

      // Update HUD
      const totalPoints = Object.values(state.points ?? {}).reduce((a, b) => a + b, 0)
      const lives = state.lives ?? 0
      const waveNumber = state.waveNumber ?? 0
      const gameOver = state.gameOver ?? false
      const gameOverSummary = state.gameOverSummary ?? null
      const streaks = state.killStreaks ?? {}
      const players: PlayerHud[] = (state.players ?? []).map((p) => ({
        id: p.id,
        displayName: p.displayName,
        lives: p.lives ?? 0,
        alive: p.alive,
        respawnTimer: p.respawnTimer ?? 0,
        killStreak: streaks[p.id] ?? 0,
      }))

      setHud((prev) => {
        const streakChanged =
          prev.players.length !== players.length ||
          prev.players.some((pp, i) => pp.killStreak !== players[i]?.killStreak)
        const same =
          prev.totalPoints === totalPoints &&
          prev.lives === lives &&
          prev.waveNumber === waveNumber &&
          prev.gameOver === gameOver &&
          !streakChanged
        if (same && (!gameOver || prev.gameOverSummary)) return prev
        return { totalPoints, lives, players, waveNumber, gameOver, gameOverSummary }
      })
    })

    client.on('pingUpdate', (ms) => {
      setPingMs(ms)
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

    const bridge = new InputBridge(
      (axes) => client.send({ type: 'MOVE', ...axes }),
      () => client.send({ type: 'STOP' }),
      () => {
        client.send({ type: 'SHOOT' })
        const meta = getGameMeta()
        const st = rendererRef.current?.state
        const lp = st?.players.find(p => p.id === client.playerId)
        const px = lp?.x ?? meta.gameWidth / 2
        const py = lp?.y ?? meta.playerY
        phantomBulletsRef.current.push({
          x: px,
          y: py - meta.playerHeight / 2,
          ownerId: client.playerId ?? '',
          createdAt: performance.now(),
        })
      },
      () => togglePause(),
    )
    bridgeRef.current = bridge

    // Resolve Clerk session token (null for guests) then connect.
    ;(async () => {
      let authToken: string | null = null
      if (getAuthToken) {
        try {
          authToken = await getAuthToken()
        } catch {
          authToken = null
        }
      }
      if (cancelled) return
      client.connect(effectiveWsUrl, {
        token: matchToken,
        matchId,
        playerId,
        mode,
        ...(authToken ? { authToken } : {}),
      })
    })()

    return () => {
      cancelled = true
      client.disconnect()
      client.removeAllListeners()
      clientRef.current = null
      bridgeRef.current = null
    }
  }, [matchToken, matchId, playerId, wsUrl, mode, router, togglePause, getAuthToken])

  // --- Initialize Renderer (uses backend meta for size; getGameMeta() for drawing) ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const w = getLogicalWidth()
    const h = getLogicalHeight()
    const renderer = new GameRenderer(canvas, { width: w, height: h })
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

  // --- Initialize input adapter (Desktop or Mobile) ---
  // On mobile we use the canvas wrapper so the slide zone is ON the canvas, not below it.
  useEffect(() => {
    const bridge = bridgeRef.current
    if (!bridge) return

    const touchTarget = isMobile ? canvasWrapperRef.current : null
    if (isMobile && touchTarget) {
      const getRect = () => {
        const r = touchTarget.getBoundingClientRect()
        return { width: r.width, height: r.height, left: r.left, top: r.top }
      }
      const pixelToLogical = createMobileMovementConverter(getRect)
      const adapter = new MobileInputAdapter(bridge, touchTarget, pixelToLogical)
      adapterRef.current = adapter
      return () => {
        adapter.destroy()
        adapterRef.current = null
      }
    } else {
      const adapter = new DesktopInputAdapter(bridge, window)
      adapterRef.current = adapter
      return () => {
        adapter.destroy()
        adapterRef.current = null
      }
    }
  }, [isMobile])

  // --- Render ---

  const { totalPoints, players: hudPlayers, gameOver, gameOverSummary } = hud

  // Build per-player lives display
  const livesDisplay = hudPlayers.map((p) => {
    const isMe = p.id === playerId
    const label = isMe ? (p.displayName ?? 'YOU') : (p.displayName ?? `P${p.id.slice(-4)}`)
    const hearts = '♥'.repeat(p.lives) + '♡'.repeat(Math.max(0, 3 - p.lives))
    const streak = p.killStreak ?? 0
    // Backend: every 5 consecutive kills guarantees a drop. Highlight when next kill triggers it.
    const streakHot = streak > 0 && streak % 5 === 4
    return { label, hearts, isMe, alive: p.alive, streak, streakHot }
  })

  return (
    <div style={containerStyle}>
      {/* Desktop: header above game */}
      {!isMobile && (
        <div style={{ ...headerStyle, flexShrink: 0 }}>
          <h1 style={titleStyle}>Space Invaders</h1>
          <div style={scoreLivesStyle}>
            <span style={scoreStyle}>Score: {totalPoints}</span>
            {livesDisplay.map((p) => (
              <span
                key={p.label}
                style={{
                  color: p.isMe ? '#00ff88' : '#00aaff',
                  opacity: p.alive ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>{p.label}: {p.hearts}</span>
                {p.streak > 0 && (
                  <span
                    style={{
                      color: p.streakHot ? '#ffaa00' : '#888',
                      fontSize: '0.85em',
                      fontWeight: p.streakHot ? 'bold' : 'normal',
                      textShadow: p.streakHot ? '0 0 8px rgba(255, 170, 0, 0.7)' : 'none',
                    }}
                  >
                    🔥{p.streak}
                  </span>
                )}
              </span>
            ))}
            <span style={pingStyle}>{pingMs}ms</span>
          </div>
          <button onClick={togglePause} style={pauseButtonStyle} title="Pause (Esc)" disabled={gameOver}>
            ⏸
          </button>
        </div>
      )}

      <div
        ref={gameViewContainerRef}
        style={{
          ...canvasContainerStyle,
          ...(isMobile
            ? {
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                touchAction: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }
            : {}),
        }}
      >
        <div
          ref={canvasWrapperRef}
          style={
            isMobile
              ? {
                  maxWidth: '100%',
                  maxHeight: '100%',
                  touchAction: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }
              : undefined
          }
        >
          <canvas
            ref={canvasRef}
            width={getLogicalWidth()}
            height={getLogicalHeight()}
            style={{
              ...canvasStyle,
              ...(isMobile
                ? {
                    maxWidth: '100%',
                    maxHeight: '100%',
                    width: 'auto',
                    height: 'auto',
                    display: 'block',
                  }
                : {}),
            }}
          />
        </div>

        {/* On mobile: header overlay on top of game */}
        {isMobile && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.75rem',
              background: 'linear-gradient(to bottom, rgba(10,10,15,0.9) 0%, transparent 100%)',
              pointerEvents: 'none',
            }}
          >
            <h1 style={{ ...titleStyle, fontSize: '0.9rem', letterSpacing: '0.1em', margin: 0 }}>
              Space Invaders
            </h1>
            <div style={{ ...scoreLivesStyle, fontSize: '0.8rem' }}>
              <span style={scoreStyle}>{totalPoints}</span>
              {livesDisplay.map((p) => (
                <span
                  key={p.label}
                  style={{ color: p.isMe ? '#00ff88' : '#00aaff', opacity: p.alive ? 1 : 0.5 }}
                >
                  {p.label}: {p.hearts}
                  {p.streak > 0 && (
                    <span
                      style={{
                        marginLeft: '0.3rem',
                        color: p.streakHot ? '#ffaa00' : '#888',
                        fontWeight: p.streakHot ? 'bold' : 'normal',
                      }}
                    >
                      🔥{p.streak}
                    </span>
                  )}
                </span>
              ))}
              <span style={pingStyle}>{pingMs}ms</span>
            </div>
            <button
              onClick={togglePause}
              style={{ ...pauseButtonStyle, pointerEvents: 'auto' }}
              title="Pause"
              disabled={gameOver}
            >
              ⏸
            </button>
          </div>
        )}

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
                {gameOverSummary.playerScores.map((s, i) => {
                  const hudEntry = hudPlayers.find((p) => p.id === s.playerId)
                  const name = hudEntry?.displayName
                  const isMe = s.playerId === playerId
                  return (
                    <div key={s.playerId} style={summaryRowStyle}>
                      <span style={isMe ? summaryYouStyle : undefined}>
                        {isMe ? (name ? `You (${name})` : 'You') : (name ?? `P${i + 1}`)}
                      </span>
                      <span>{s.kills}</span>
                      <span>{s.points}</span>
                    </div>
                  )
                })}
              </div>
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button onClick={exitGame} style={menuButtonStyle}>Return to menu</button>
              </div>
              <SignInHint />
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
        {/* On mobile: status + hint as bottom overlay */}
        {isMobile && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              padding: '0.5rem 0.75rem',
              background: 'linear-gradient(to top, rgba(10,10,15,0.85) 0%, transparent 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.25rem',
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color:
                  status === 'connected'
                    ? '#00ff88'
                    : status === 'error' || status === 'ended'
                      ? '#ff4444'
                      : '#666',
              }}
            >
              {statusText}
            </span>
            <span style={{ fontSize: '0.6rem', color: '#444' }}>
              Glisse en bas pour bouger • Tir auto • 2 doigts = pause
            </span>
          </div>
        )}
      </div>

      {!isMobile && (
        <>
          <div
            style={{
              ...statusTextStyle,
              flexShrink: 0,
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
          <div style={{ ...controlsStyle, flexShrink: 0 }}>
            <kbd style={kbdStyle}>←</kbd> <kbd style={kbdStyle}>→</kbd> <kbd style={kbdStyle}>↑</kbd> <kbd style={kbdStyle}>↓</kbd> Move
            &nbsp;&nbsp;
            <kbd style={kbdStyle}>Space</kbd> Shoot
            &nbsp;&nbsp;
            <kbd style={kbdStyle}>Esc</kbd> Pause
          </div>
        </>
      )}
    </div>
  )
}

// --- Styles (unchanged) ---

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  height: '100vh',
  maxHeight: '100dvh',
  background: '#0a0a0f',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'JetBrains Mono, Fira Code, monospace',
  color: '#e0e0e0',
  overflow: 'hidden',
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
const pingStyle: React.CSSProperties = { color: '#666', fontSize: '0.75rem' }

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
  maxWidth: '100%',
  flexShrink: 0,
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
