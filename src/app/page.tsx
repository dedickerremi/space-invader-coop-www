'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MatchmakingClient, GameClient } from '@/core'
import type { MatchData, GameMode } from '@/core'
import { setPendingGame } from '@/core/pendingGame'
import { AuthMenu } from '@/components/AuthMenu'
import { ShipSelector } from '@/components/ShipSelector'

type MatchStatus = 'idle' | 'joining' | 'waiting' | 'matchFound' | 'ready' | 'timeout' | 'error'

export default function Home() {
  const router = useRouter()
  const matchmakingRef = useRef(new MatchmakingClient())
  const queueClientRef = useRef<GameClient | null>(null)
  const [status, setStatus] = useState<MatchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [onlinePlayers, setOnlinePlayers] = useState<number | null>(null)

  // The Fly backend auto-stops when idle. Ping it as soon as the menu loads
  // so the machine is awake by the time the player picks a mode, instead of
  // paying the cold start on the WebSocket connect.
  useEffect(() => {
    // Same fallback as lib/matchmaking.ts
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
    const httpUrl = wsUrl.replace(/^ws/, 'http')
    fetch(`${httpUrl}/api/version`, { cache: 'no-store' }).catch(() => {
      // Fire-and-forget: waking the machine is all that matters
    })
  }, [])

  // Fetch online player count on mount and every 30s
  useEffect(() => {
    const fetchOnline = async () => {
      try {
        const res = await fetch('/api/online')
        if (res.ok) {
          const data = await res.json()
          setOnlinePlayers(data.playersOnline)
        }
      } catch {
        // ignore
      }
    }

    fetchOnline()
    const interval = setInterval(fetchOnline, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Redirect to game when match is ready (solo path)
  useEffect(() => {
    if (status === 'ready' && matchData) {
      sessionStorage.setItem('matchData', JSON.stringify(matchData))
      router.push('/play')
    }
  }, [status, matchData, router])

  const cancelQueue = useCallback(() => {
    const client = queueClientRef.current
    if (client) {
      queueClientRef.current = null // release before disconnect so connectionChange is ignored
      client.disconnect()
    }
    setStatus('idle')
  }, [])

  // Disconnect a still-queued client if the user navigates away
  useEffect(() => {
    return () => {
      queueClientRef.current?.disconnect()
      queueClientRef.current = null
    }
  }, [])

  const joinQueueViaWs = useCallback(async () => {
    setStatus('joining')
    setError(null)

    try {
      const session = await matchmakingRef.current.createSession('coop')
      if (session.status !== 'ok') {
        setStatus('error')
        setError(session.error)
        return
      }

      const { token, wsUrl } = session

      const client = new GameClient()
      queueClientRef.current = client

      client.on('queued', () => {
        setStatus('waiting')
      })

      client.on('matchFound', () => {
        setStatus('matchFound')
      })

      client.on('connectionChange', (connStatus) => {
        // Ignore events from a client we already released (cancel, timeout, navigation)
        if (queueClientRef.current !== client) return
        if (connStatus === 'error' || connStatus === 'disconnected') {
          queueClientRef.current = null
          setStatus('error')
          setError(
            connStatus === 'error'
              ? 'Cannot connect to game server'
              : 'Connection to game server lost',
          )
        }
      })

      client.on('welcome', (playerId, matchId) => {
        const data: MatchData = {
          token,
          wsUrl,
          playerId,
          matchId,
          mode: 'coop',
        }
        sessionStorage.setItem('matchData', JSON.stringify(data))
        // Store live client so GameCanvas can reuse the connection instead of reconnecting
        setPendingGame({ client, matchId, playerId, wsUrl, mode: 'coop' })
        queueClientRef.current = null  // prevent cancelQueue from disconnecting it
        router.push('/play')
      })

      client.on('queueTimeout', () => {
        queueClientRef.current = null // release before disconnect so connectionChange is ignored
        client.disconnect()
        setStatus('timeout')
      })

      client.connect(wsUrl, { token })
    } catch (err) {
      setStatus('error')
      setError('Failed to join queue')
      console.error(err)
    }
  }, [router])

  const joinQueue = useCallback(async (mode: GameMode = 'solo') => {
    setStatus('joining')
    setError(null)

    try {
      const session = await matchmakingRef.current.createSession(mode)

      if (session.status === 'ok') {
        setMatchData({
          token: session.token,
          wsUrl: session.wsUrl,
          playerId: session.playerId,
          matchId: session.matchId,
          mode: session.mode,
        })
        setStatus('ready')
      } else {
        setStatus('error')
        setError(session.error)
      }
    } catch (err) {
      setStatus('error')
      setError('Failed to start the game')
      console.error(err)
    }
  }, [])

  return (
    <div style={containerStyle}>
      <AuthMenu />
      <h1 style={titleStyle}>Space Invaders</h1>
      <p style={subtitleStyle}>Choose your mode</p>

      {status === 'idle' && <ShipSelector />}

      {status === 'idle' && (
        <>
          <div style={modeButtonsStyle}>
            <button onClick={() => joinQueue('solo')} style={buttonStyle}>
              Single Player
            </button>
            <button onClick={joinQueueViaWs} style={buttonStyle}>
              Multiplayer
            </button>
          </div>
          {onlinePlayers !== null && (
            <div style={onlinePlayersStyle}>{onlinePlayers} players online</div>
          )}
        </>
      )}

      {status === 'joining' && (
        <div style={statusStyle}>Joining queue...</div>
      )}

      {status === 'waiting' && (
        <>
          <div style={statusStyle}>
            <span style={pulseStyle}>●</span> Waiting for another player...
          </div>
          <button onClick={cancelQueue} style={cancelButtonStyle}>
            Cancel
          </button>
        </>
      )}

      {status === 'matchFound' && (
        <div style={{ ...statusStyle, color: '#00ff88' }}>
          <span style={pulseStyle}>●</span> Opponent found! Starting...
        </div>
      )}

      {status === 'ready' && (
        <div style={{ ...statusStyle, color: '#00ff88' }}>
          Match found! Connecting...
        </div>
      )}

      {status === 'timeout' && (
        <>
          <div style={{ ...statusStyle, color: '#ff8800' }}>
            No opponent found.
          </div>
          <button onClick={joinQueueViaWs} style={buttonStyle}>
            Retry
          </button>
        </>
      )}

      {status === 'error' && (
        <>
          <div style={{ ...statusStyle, color: '#ff4444' }}>
            Error: {error}
          </div>
          <button onClick={() => setStatus('idle')} style={buttonStyle}>
            Try Again
          </button>
        </>
      )}

    </div>
  )
}

// --- Styles ---

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

const titleStyle: React.CSSProperties = {
  fontSize: '2.5rem',
  color: '#00ff88',
  textTransform: 'uppercase',
  letterSpacing: '0.3em',
  textShadow: '0 0 30px rgba(0, 255, 136, 0.5)',
  marginBottom: '0.5rem',
}

const subtitleStyle: React.CSSProperties = {
  color: '#666',
  marginBottom: '3rem',
  fontSize: '1rem',
}

const modeButtonsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '1.5rem',
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const buttonStyle: React.CSSProperties = {
  padding: '1rem 3rem',
  background: 'transparent',
  border: '2px solid #00ff88',
  color: '#00ff88',
  fontSize: '1.2rem',
  textTransform: 'uppercase',
  letterSpacing: '0.2em',
  cursor: 'pointer',
  transition: 'all 0.2s',
  fontFamily: 'inherit',
}

const cancelButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  marginTop: '1rem',
  borderColor: '#666',
  color: '#666',
  fontSize: '0.9rem',
  padding: '0.5rem 1.5rem',
}

const statusStyle: React.CSSProperties = {
  color: '#888',
  fontSize: '1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
}

const pulseStyle: React.CSSProperties = {
  color: '#00ff88',
  animation: 'pulse 1s ease-in-out infinite',
}

const onlinePlayersStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  color: '#444',
  fontSize: '0.8rem',
}

