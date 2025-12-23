'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { GameCanvas } from '@/components/GameCanvas'

type MatchData = {
  matchId: string
  matchToken: string
  wsUrl: string
  playerId: string
}

export default function PlayPage() {
  const router = useRouter()
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusText, setStatusText] = useState('Loading...')

  useEffect(() => {
    // Get match data from session storage
    const stored = sessionStorage.getItem('matchData')

    if (!stored) {
      // No match data, show error and redirect after delay
      setStatusText('No match data found. Redirecting to home...')
      setTimeout(() => {
        router.push('/')
      }, 2000)
      return
    }

    try {
      const data = JSON.parse(stored) as MatchData
      setMatchData(data)
      setLoading(false)
    } catch (err) {
      console.error('Failed to parse match data:', err)
      setStatusText('Invalid match data. Redirecting to home...')
      setTimeout(() => {
        router.push('/')
      }, 2000)
    }
  }, [router])

  if (loading || !matchData) {
    return (
      <div style={loadingStyle}>
        {statusText}
      </div>
    )
  }

  return (
    <GameCanvas
      matchToken={matchData.matchToken}
      wsUrl={matchData.wsUrl}
      matchId={matchData.matchId}
      playerId={matchData.playerId}
    />
  )
}

const loadingStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0a0a0f',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'JetBrains Mono, monospace',
  color: '#666',
}
