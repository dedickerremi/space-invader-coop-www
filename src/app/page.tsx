'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MatchmakingClient, GameClient } from '@/core'
import type { MatchData, GameMode } from '@/core'
import { AuthMenu } from '@/components/AuthMenu'
import { ShipSelector } from '@/components/ShipSelector'

type MatchStatus = 'idle' | 'joining' | 'waiting' | 'matchFound' | 'ready' | 'timeout' | 'error'

export default function Home() {
  const router = useRouter()
  const matchmakingRef = useRef(new MatchmakingClient())
  const queueClientRef = useRef<GameClient | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<MatchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [onlinePlayers, setOnlinePlayers] = useState<number | null>(null)

  // Generate userId on mount
  useEffect(() => {
    setUserId(MatchmakingClient.generateUserId())
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
      client.disconnect()
      queueClientRef.current = null
    }
    setStatus('idle')
  }, [])

  const joinQueueViaWs = useCallback(async () => {
    if (!userId) return

    setStatus('joining')
    setError(null)

    try {
      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, mode: 'coop' }),
      })
      const result = await res.json()

      if (result.status === 'matched') {
        // Rare: matched immediately (was already 2 in queue)
        setMatchData({
          matchId: result.matchId,
          matchToken: result.matchToken,
          wsUrl: result.wsUrl,
          playerId: result.playerId,
          mode: result.mode,
        })
        setStatus('ready')
        return
      }

      if (result.status !== 'queued') {
        setStatus('error')
        setError(result.error ?? 'Failed to join queue')
        return
      }

      const { queueToken, wsUrl } = result

      const client = new GameClient()
      queueClientRef.current = client

      client.on('queued', () => {
        setStatus('waiting')
      })

      client.on('matchFound', () => {
        setStatus('matchFound')
      })

      client.on('welcome', (playerId, matchId) => {
        const data: MatchData = {
          matchId,
          matchToken: queueToken,
          wsUrl,
          playerId,
          mode: 'coop',
        }
        sessionStorage.setItem('matchData', JSON.stringify(data))
        client.disconnect()
        queueClientRef.current = null
        router.push('/play')
      })

      client.on('queueTimeout', () => {
        client.disconnect()
        queueClientRef.current = null
        setStatus('timeout')
      })

      client.connect(wsUrl, {
        token: queueToken,
        matchId: 'queue',
        playerId: userId,
        mode: 'coop',
      })
    } catch (err) {
      setStatus('error')
      setError('Failed to join queue')
      console.error(err)
    }
  }, [userId, router])

  const joinQueue = useCallback(async (mode: GameMode = 'solo') => {
    if (!userId) return

    setStatus('joining')
    setError(null)

    try {
      const result = await matchmakingRef.current.joinQueue(userId, mode)

      if (result.status === 'matched') {
        setMatchData({
          matchId: result.matchId,
          matchToken: result.matchToken,
          wsUrl: result.wsUrl,
          playerId: result.playerId,
          mode: result.mode,
        })
        setStatus('ready')
      } else {
        setStatus('error')
        setError('error' in result ? result.error : 'Failed to join queue')
      }
    } catch (err) {
      setStatus('error')
      setError('Failed to join queue')
      console.error(err)
    }
  }, [userId])

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

      {userId && (
        <div style={userIdStyle}>ID: {userId.slice(-8)}</div>
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

const userIdStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '1rem',
  color: '#333',
  fontSize: '0.75rem',
}
