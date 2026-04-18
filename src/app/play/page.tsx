'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import { GameCanvas } from '@/components/GameCanvas'

type MatchData = {
  matchId: string
  matchToken: string
  wsUrl: string
  playerId: string
  mode?: 'solo' | 'coop'
}

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)

export default function PlayPage() {
  const router = useRouter()
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusText, setStatusText] = useState('Loading...')

  useEffect(() => {
    const stored = sessionStorage.getItem('matchData')

    if (!stored) {
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
    return <div style={loadingStyle}>{statusText}</div>
  }

  return hasClerk ? (
    <ClerkAuthedGame matchData={matchData} />
  ) : (
    <GameCanvas
      matchToken={matchData.matchToken}
      wsUrl={matchData.wsUrl}
      matchId={matchData.matchId}
      playerId={matchData.playerId}
      mode={matchData.mode}
    />
  )
}

function ClerkAuthedGame({ matchData }: { matchData: MatchData }) {
  const { getToken } = useAuth()
  const getAuthToken = useCallback(() => getToken(), [getToken])

  return (
    <GameCanvas
      matchToken={matchData.matchToken}
      wsUrl={matchData.wsUrl}
      matchId={matchData.matchId}
      playerId={matchData.playerId}
      mode={matchData.mode}
      getAuthToken={getAuthToken}
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
