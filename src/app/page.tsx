'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type MatchStatus = 'idle' | 'joining' | 'waiting' | 'ready' | 'error'

type MatchData = {
  matchId: string
  matchToken: string
  wsUrl: string
  playerId: string
}

function generateUserId(): string {
  // Use sessionStorage so each tab gets a unique userId
  const stored = sessionStorage.getItem('userId')
  if (stored) return stored

  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  sessionStorage.setItem('userId', id)
  return id
}

export default function Home() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [status, setStatus] = useState<MatchStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [matchData, setMatchData] = useState<MatchData | null>(null)

  // Generate userId on mount
  useEffect(() => {
    setUserId(generateUserId())
  }, [])

  // Poll for match when waiting
  useEffect(() => {
    if (status !== 'waiting' || !userId) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/match/current?userId=${userId}`)
        const data = await res.json()

        if (data.status === 'ready') {
          setMatchData({
            matchId: data.matchId,
            matchToken: data.matchToken,
            wsUrl: data.wsUrl,
            playerId: data.playerId,
          })
          setStatus('ready')
        }
      } catch (err) {
        console.error('Poll error:', err)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [status, userId])

  // Redirect to game when match is ready
  useEffect(() => {
    if (status === 'ready' && matchData) {
      // Store match data for the game page
      sessionStorage.setItem('matchData', JSON.stringify(matchData))
      router.push('/play')
    }
  }, [status, matchData, router])

  const joinQueue = useCallback(async () => {
    if (!userId) return

    setStatus('joining')
    setError(null)

    try {
      const res = await fetch('/api/queue/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      const data = await res.json()

      if (data.status === 'matched') {
        setMatchData({
          matchId: data.matchId,
          matchToken: data.matchToken,
          wsUrl: data.wsUrl,
          playerId: data.playerId,
        })
        setStatus('ready')
      } else if (data.status === 'queued') {
        setStatus('waiting')
      } else {
        setStatus('error')
        setError(data.error || 'Unknown error')
      }
    } catch (err) {
      setStatus('error')
      setError('Failed to join queue')
      console.error(err)
    }
  }, [userId])

  const leaveQueue = useCallback(async () => {
    if (!userId) return

    try {
      await fetch('/api/queue/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
    } catch (err) {
      console.error('Leave queue error:', err)
    }

    setStatus('idle')
  }, [userId])

  return (
    <div style={containerStyle}>
      <h1 style={titleStyle}>Space Invaders</h1>
      <p style={subtitleStyle}>Cooperative 2-player game</p>

      {status === 'idle' && (
        <button onClick={joinQueue} style={buttonStyle}>
          Play
        </button>
      )}

      {status === 'joining' && (
        <div style={statusStyle}>Joining queue...</div>
      )}

      {status === 'waiting' && (
        <>
          <div style={statusStyle}>
            <span style={pulseStyle}>●</span> Waiting for another player...
          </div>
          <button onClick={leaveQueue} style={cancelButtonStyle}>
            Cancel
          </button>
        </>
      )}

      {status === 'ready' && (
        <div style={{ ...statusStyle, color: '#00ff88' }}>
          Match found! Connecting...
        </div>
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

const userIdStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: '1rem',
  color: '#333',
  fontSize: '0.75rem',
}
