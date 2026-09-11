'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  GameClient,
  GameRenderer,
  InputBridge,
  DesktopInputAdapter,
  MobileInputAdapter,
  fetchGameMeta,
  setGameMeta,
  getDefaultMeta,
  getGameMeta,
  getLogicalWidth,
  getLogicalHeight,
  SHIPS,
  BossAudio,
} from '@/core'
import { takePendingGame } from '@/core/pendingGame'
import { difficultyLabel, startingLives } from '@/core/difficulty'
import type { GameState, GameOverSummary, Bullet, GameMode, ShipKey, BossKind, Difficulty } from '@/core'
import { SignInHint } from '@/components/SignInHint'
import { createSpriteSheetSvg, isSvgSpritesEnabled } from '@/core/svgSpriteSheet'
import { DEFAULT_COLORS, PATROL_COLOR, ENEMY_BULLET_COLOR } from '@/core/GameRenderer'

async function initRenderer(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  shipKey: ShipKey | undefined,
): Promise<GameRenderer> {
  if (isSvgSpritesEnabled()) {
    const spriteSheet = await createSpriteSheetSvg(
      {
        player1: DEFAULT_COLORS.player1,
        player2: DEFAULT_COLORS.player2,
        playerDead: DEFAULT_COLORS.playerDead,
        enemyStatic: DEFAULT_COLORS.enemy,
        enemyPatrol: PATROL_COLOR,
        bullet: DEFAULT_COLORS.bullet,
        enemyBullet: ENEMY_BULLET_COLOR,
      },
      shipKey,
    )
    return new GameRenderer(canvas, { width, height, shipKey, spriteSheet })
  }
  return new GameRenderer(canvas, { width, height, shipKey })
}

// --- Types ---

type PlayerHud = {
  id: string
  displayName?: string
  lives: number
  alive: boolean
  killStreak: number
}

type HudState = {
  totalPoints: number
  lives: number
  players: PlayerHud[]
  waveNumber: number
  levelName: string
  levelTitle: string
  difficulty: Difficulty | ''
  waveName: string
  totalWaves: number
  victory: boolean
  gameOver: boolean
  gameOverSummary: GameOverSummary | null
  /** Boss kind while a boss fight is active, null otherwise. */
  bossKind: BossKind | null
}

type GameCanvasProps = {
  token?: string
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

export function GameCanvas({ token, wsUrl, matchId, playerId, mode = 'coop', getAuthToken }: GameCanvasProps) {
  const router = useRouter()
  const gameViewContainerRef = useRef<HTMLDivElement>(null)
  const canvasWrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const clientRef = useRef<GameClient | null>(null)
  const rendererRef = useRef<GameRenderer | null>(null)
  const bridgeRef = useRef<InputBridge | null>(null)
  const adapterRef = useRef<DesktopInputAdapter | MobileInputAdapter | null>(null)
  const lastKillsRef = useRef<number>(0)
  const bossAudioRef = useRef<BossAudio | null>(null)
  const prevBossRef = useRef<{ kind: BossKind | null; phase: number; shieldActive: boolean }>({
    kind: null,
    phase: 1,
    shieldActive: false,
  })

  // Client-side bullet prediction: phantom bullets shown instantly on SHOOT,
  // removed when server confirms or after timeout.
  type PhantomBullet = Bullet & { createdAt: number }
  const phantomBulletsRef = useRef<PhantomBullet[]>([])
  const prevLocalBulletsRef = useRef<{ x: number; y: number }[]>([])

  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'ended'>('connecting')
  const [statusText, setStatusText] = useState('Connecting...')
  const [showPauseMenu, setShowPauseMenu] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [pausedByMe, setPausedByMe] = useState(false)
  const [pingMs, setPingMs] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [screen, setScreen] = useState({ w: 0, h: 0 })
  const [hud, setHud] = useState<HudState>({
    totalPoints: 0,
    lives: 0,
    players: [],
    waveNumber: 0,
    levelName: '',
    levelTitle: '',
    difficulty: '',
    waveName: '',
    totalWaves: 0,
    victory: false,
    gameOver: false,
    gameOverSummary: null,
    bossKind: null,
  })
  const [waveBanner, setWaveBanner] = useState<string | null>(null)
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Mobile/tablet: touch or viewport ≤ 1024px → slide + auto-fire
  useEffect(() => {
    const check = () => {
      setIsMobile(
        typeof window !== 'undefined' &&
          ('ontouchstart' in window || window.innerWidth <= 1024),
      )
      setScreen({ w: window.innerWidth, h: window.innerHeight })
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // --- Boss audio lifecycle ---
  useEffect(() => {
    bossAudioRef.current = new BossAudio()
    return () => {
      bossAudioRef.current?.dispose()
      bossAudioRef.current = null
    }
  }, [])

  // --- Refs for bridge / renderer ---
  const isPausedRef = useRef(false)
  const pausedByMeRef = useRef(false)
  // The menu opens/closes optimistically on Escape, but STATE broadcasts sent
  // before the server processed our PAUSE/RESUME still carry the old paused
  // value and would instantly undo it. Remember when we asked, and ignore
  // contradicting states within a grace window.
  const pauseRequestedAtRef = useRef(0)
  const resumeRequestedAtRef = useRef(0)

  // Keep refs in sync
  useEffect(() => { isPausedRef.current = isPaused }, [isPaused])
  useEffect(() => { pausedByMeRef.current = pausedByMe }, [pausedByMe])

  // --- Toggle pause (used by input bridge callback) ---
  const togglePause = useCallback(() => {
    const client = clientRef.current
    if (!client) return

    if (isPausedRef.current && pausedByMeRef.current) {
      client.send({ type: 'RESUME' })
      pauseRequestedAtRef.current = 0
      resumeRequestedAtRef.current = performance.now()
      setShowPauseMenu(false)
    } else if (!isPausedRef.current) {
      client.send({ type: 'PAUSE' })
      resumeRequestedAtRef.current = 0
      pauseRequestedAtRef.current = performance.now()
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
    if (!token || !playerId) {
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

    const pending = takePendingGame()
    const client = pending ? pending.client : new GameClient()
    clientRef.current = client

    if (pending) {
      client.removeAllListeners()
    }

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
      const PENDING_GRACE_MS = 1000
      const stateAt = performance.now()
      if (paused && byMe) {
        pauseRequestedAtRef.current = 0
        const resumePending =
          resumeRequestedAtRef.current > 0 && stateAt - resumeRequestedAtRef.current < PENDING_GRACE_MS
        if (!resumePending) setShowPauseMenu(true)
      }
      if (!paused) {
        resumeRequestedAtRef.current = 0
        const pausePending =
          pauseRequestedAtRef.current > 0 && stateAt - pauseRequestedAtRef.current < PENDING_GRACE_MS
        if (!pausePending) setShowPauseMenu(false)
      }

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

      // Newly spawned local bullets: any current bullet not explained by advancing
      // a previous-frame bullet upward (bullets keep constant x and move -bulletSpeed
      // per tick; allow up to 3 ticks in case a state frame was missed). Immune to
      // same-tick despawns, unlike a count delta.
      const bSpeed = getGameMeta().bulletSpeed
      const currLocal = state.bullets.filter(b => b.ownerId === client.playerId)
      const prevLocal = prevLocalBulletsRef.current
      const spawned = currLocal.filter(
        b => !prevLocal.some(
          p => Math.abs(p.x - b.x) < 0.5 && p.y - b.y >= 0 && p.y - b.y <= bSpeed * 3,
        ),
      ).length
      if (spawned > 0) {
        phantomBulletsRef.current.splice(0, spawned)
      }
      prevLocalBulletsRef.current = currLocal.map(b => ({ x: b.x, y: b.y }))

      // Move remaining phantoms up at server bullet speed
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

      // Boss audio cues — compare against previous boss snapshot.
      const audio = bossAudioRef.current
      if (audio) {
        const boss = state.boss ?? null
        const prev = prevBossRef.current
        const curKind: BossKind | null = boss ? boss.kind : null
        const curPhase = boss?.phase ?? 1
        const curShield = !!boss?.shieldActive

        if (!prev.kind && curKind) {
          audio.bossStart()
        } else if (prev.kind && !curKind) {
          audio.bossDeath()
        } else if (prev.kind && curKind && prev.kind === curKind) {
          if (prev.shieldActive && !curShield) audio.shieldDrop()
          if (curPhase > prev.phase) audio.phaseChange()
        }

        prevBossRef.current = { kind: curKind, phase: curPhase, shieldActive: curShield }
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
      const levelName = state.levelName ?? ''
      // levelName is the storage key ("solo-level2.json"); levelTitle is what
      // players should read ("Sector 2 — Flank Run"). Older servers send no title.
      const levelTitle = state.levelTitle ?? ''
      const difficulty = state.difficulty ?? ''
      const waveName = state.waveName ?? ''
      const totalWaves = state.totalWaves ?? 0
      const victory = state.victory ?? false
      const gameOver = state.gameOver ?? false
      const gameOverSummary = state.gameOverSummary ?? null
      const bossKind: BossKind | null = state.boss ? state.boss.kind : null
      const streaks = state.killStreaks ?? {}
      const players: PlayerHud[] = (state.players ?? []).map((p) => ({
        id: p.id,
        displayName: p.displayName,
        lives: p.lives ?? 0,
        alive: p.alive,
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
          prev.levelName === levelName &&
          prev.levelTitle === levelTitle &&
          prev.difficulty === difficulty &&
          prev.waveName === waveName &&
          prev.totalWaves === totalWaves &&
          prev.victory === victory &&
          prev.gameOver === gameOver &&
          prev.bossKind === bossKind &&
          !streakChanged
        if (same && (!gameOver || prev.gameOverSummary)) return prev

        // Banners — boss takes priority; regular level/wave banners are suppressed
        // while a boss is active (the HP bar is context enough).
        const bossJustAppeared = !prev.bossKind && bossKind
        const levelChanged = prev.levelName && levelName && prev.levelName !== levelName
        const waveChanged =
          prev.waveNumber > 0 && waveNumber > 0 && prev.waveNumber !== waveNumber

        if (!gameOver && bossJustAppeared) {
          const text = `BOSS — ${bossKind.toUpperCase()}`
          setWaveBanner(text)
          if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
          bannerTimerRef.current = setTimeout(() => setWaveBanner(null), 2200)
        } else if (!gameOver && !bossKind && (levelChanged || waveChanged)) {
          const text = levelChanged
            ? levelTitle || `Level — ${levelName}`
            : `Wave ${waveNumber}${totalWaves ? `/${totalWaves}` : ''} — ${waveName}`
          setWaveBanner(text)
          if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current)
          bannerTimerRef.current = setTimeout(() => setWaveBanner(null), 1800)
        }

        return {
          totalPoints,
          lives,
          players,
          waveNumber,
          levelName,
          levelTitle,
          difficulty,
          waveName,
          totalWaves,
          victory,
          gameOver,
          gameOverSummary,
          bossKind,
        }
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

    if (pending) {
      // Client is already connected — sync React status without waiting for an event
      if (client.status === 'connected') {
        setStatus('connected')
        setStatusText(matchId ? `Match: ${matchId.slice(-6)}` : 'Connected')
      }
    } else {
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
          token,
          ...(authToken ? { authToken } : {}),
        })
      })()
    }

    return () => {
      cancelled = true
      client.disconnect()
      client.removeAllListeners()
      clientRef.current = null
      bridgeRef.current = null
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current)
        bannerTimerRef.current = null
      }
    }
  }, [token, matchId, playerId, wsUrl, mode, router, togglePause, getAuthToken])

  // Mobile: pick viewport height so the canvas aspect ratio matches the screen
  // aspect ratio — the canvas then fills the screen without letterboxing. If the
  // screen is tall enough for the full world, show everything; otherwise clip
  // and let the follow-camera reveal the rest.
  const viewportW = getLogicalWidth()
  const fullH = getLogicalHeight()
  const viewportH = (() => {
    if (!isMobile || screen.w === 0 || screen.h === 0) return fullH
    const fitH = Math.round(viewportW * (screen.h / screen.w))
    return Math.min(fullH, fitH)
  })()

  // --- Initialize Renderer. Re-init when viewport size flips (desktop ↔ mobile) ---
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Read chosen ship from localStorage (ShipSelector persists the choice).
    let shipKey: ShipKey | undefined
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('shipKey')
      if (raw && raw in SHIPS) shipKey = raw as ShipKey
    }

    let cancelled = false
    let activeRenderer: GameRenderer | null = null

    void initRenderer(canvas, viewportW, viewportH, shipKey).then((r) => {
      if (cancelled) {
        r.stop()
        return
      }
      activeRenderer = r
      rendererRef.current = r
      r.start()
    })

    return () => {
      cancelled = true
      if (activeRenderer) {
        activeRenderer.stop()
      }
      rendererRef.current = null
    }
  }, [viewportW, viewportH])

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
      const adapter = new MobileInputAdapter(bridge, touchTarget)
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

  const {
    totalPoints,
    players: hudPlayers,
    waveNumber,
    levelName,
    levelTitle,
    difficulty,
    waveName,
    totalWaves,
    victory,
    gameOver,
    gameOverSummary,
  } = hud

  const levelDisplay = [levelTitle || levelName, difficultyLabel(difficulty || undefined)].filter(Boolean).join(' · ')
  // Empty hearts count down from the lives this difficulty starts with.
  const maxLives = startingLives(difficulty || undefined)
  const levelLabel =
    levelDisplay && waveNumber
      ? `${levelDisplay} · Wave ${waveNumber}${totalWaves ? `/${totalWaves}` : ''}${waveName ? ` — ${waveName}` : ''}`
      : waveNumber
        ? `Wave ${waveNumber}${totalWaves ? `/${totalWaves}` : ''}${waveName ? ` — ${waveName}` : ''}`
        : ''

  // Build per-player lives display
  const livesDisplay = hudPlayers.map((p) => {
    const isMe = p.id === playerId
    const label = isMe ? (p.displayName ?? 'YOU') : (p.displayName ?? `P${p.id.slice(-4)}`)
    const hearts = '♥'.repeat(p.lives) + '♡'.repeat(Math.max(0, maxLives - p.lives))
    const streak = p.killStreak ?? 0
    // Streaks no longer earn a guaranteed drop (bonuses come from carriers);
    // a long one still deserves to glow.
    const streakHot = streak >= 10
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
            {levelLabel && <span style={levelLabelStyle}>{levelLabel}</span>}
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
                display: 'flex',
                flexDirection: 'column',
              }
            : {}),
        }}
      >
        <div
          ref={canvasWrapperRef}
          style={
            isMobile
              ? {
                  flex: 1,
                  minHeight: 0,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'none',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }
              : undefined
          }
        >
          <canvas
            ref={canvasRef}
            width={viewportW}
            height={viewportH}
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

        {/* Mobile: minimal overlay HUD (score left, lives/streak + pause right). */}
        {isMobile && (
          <div style={mobileHudStyle}>
            <span style={mobileScoreStyle}>{totalPoints}</span>
            <div style={mobileRightStyle}>
              {livesDisplay.map((p) => (
                <span
                  key={p.label}
                  style={{
                    color: p.isMe ? '#00ff88' : '#00aaff',
                    opacity: p.alive ? 1 : 0.5,
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <span>{p.hearts}</span>
                  {p.streak > 0 && (
                    <span
                      style={{
                        color: p.streakHot ? '#ffaa00' : '#888',
                        fontWeight: p.streakHot ? 'bold' : 'normal',
                        textShadow: p.streakHot ? '0 0 6px rgba(255,170,0,0.7)' : 'none',
                      }}
                    >
                      🔥{p.streak}
                    </span>
                  )}
                </span>
              ))}
              <button
                onClick={togglePause}
                style={mobilePauseBtnStyle}
                title="Pause"
                disabled={gameOver}
              >
                ⏸
              </button>
            </div>
          </div>
        )}

        {/* Wave / level transition banner */}
        {waveBanner && !gameOver && (
          <div style={bannerStyle}>
            <span style={bannerTextStyle}>{waveBanner}</span>
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

        {/* Game Over / Victory Overlay */}
        {gameOver && gameOverSummary && (
          <div style={overlayStyle}>
            <div style={victory ? victoryMenuStyle : menuStyle}>
              <h2 style={victory ? victoryTitleStyle : menuTitleStyle}>
                {victory ? 'Victory!' : 'Game Over'}
              </h2>
              <p style={{ color: victory ? '#ffd166' : '#888', marginBottom: '1rem' }}>
                {victory
                  ? `You cleared ${levelDisplay || 'the campaign'}!`
                  : 'No lives left!'}
              </p>
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
                <button
                  onClick={exitGame}
                  style={victory ? victoryButtonStyle : menuButtonStyle}
                >
                  Return to menu
                </button>
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
        {/* Mobile: small status toast at the bottom, only when not connected. */}
        {isMobile && status !== 'connected' && (
          <div style={mobileToastStyle}>
            <span
              style={{
                color: status === 'error' || status === 'ended' ? '#ff4444' : '#cfcfcf',
              }}
            >
              {statusText}
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
const levelLabelStyle: React.CSSProperties = {
  color: '#9ad4ff',
  fontSize: '0.85rem',
  letterSpacing: '0.05em',
}

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

const victoryMenuStyle: React.CSSProperties = {
  ...menuStyle,
  borderColor: '#ffd166',
  boxShadow: '0 0 30px rgba(255, 209, 102, 0.35)',
}

const victoryTitleStyle: React.CSSProperties = {
  ...menuTitleStyle,
  color: '#ffd166',
  textShadow: '0 0 20px rgba(255, 209, 102, 0.6)',
}

const victoryButtonStyle: React.CSSProperties = {
  ...menuButtonStyle,
  borderColor: '#ffd166',
  color: '#ffd166',
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

const bannerStyle: React.CSSProperties = {
  position: 'absolute',
  top: '30%',
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 15,
}

const bannerTextStyle: React.CSSProperties = {
  padding: '0.6rem 1.4rem',
  background: 'rgba(0, 0, 0, 0.65)',
  border: '1px solid #00ff88',
  color: '#00ff88',
  fontSize: '1.1rem',
  letterSpacing: '0.2em',
  textTransform: 'uppercase',
  textShadow: '0 0 14px rgba(0, 255, 136, 0.6)',
}

const mobileHudStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 10,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  padding: 'max(0.5rem, env(safe-area-inset-top)) 0.75rem 0.5rem',
  background: 'linear-gradient(to bottom, rgba(5,6,10,0.7) 0%, transparent 100%)',
  pointerEvents: 'none',
  fontFamily: 'JetBrains Mono, Fira Code, monospace',
}

const mobileScoreStyle: React.CSSProperties = {
  color: '#00ff88',
  fontSize: '1.25rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  textShadow: '0 0 10px rgba(0,255,136,0.6)',
}

const mobileRightStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
}

const mobilePauseBtnStyle: React.CSSProperties = {
  background: 'rgba(10,12,20,0.65)',
  border: '1px solid rgba(0,255,136,0.45)',
  color: '#00ff88',
  fontSize: '0.95rem',
  width: 32,
  height: 32,
  padding: 0,
  borderRadius: 4,
  cursor: 'pointer',
  pointerEvents: 'auto',
  lineHeight: 1,
}

const mobileToastStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 'max(0.5rem, env(safe-area-inset-bottom))',
  left: 0,
  right: 0,
  textAlign: 'center',
  fontSize: '0.75rem',
  padding: '0.3rem 0.75rem',
  pointerEvents: 'none',
  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
  fontFamily: 'JetBrains Mono, Fira Code, monospace',
}
