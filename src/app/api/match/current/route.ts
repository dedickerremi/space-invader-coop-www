import { NextRequest, NextResponse } from 'next/server'
import { getPlayerMatch, isInQueue, getTokenForPlayer } from '@/lib/queue'
import { getWsUrl } from '@/lib/matchmaking'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId')

  if (!userId) {
    return NextResponse.json(
      { error: 'userId is required' },
      { status: 400 }
    )
  }

  // Check if player has a match ready
  const match = getPlayerMatch(userId)

  if (match) {
    const token = getTokenForPlayer(match.matchId, userId)
    return NextResponse.json({
      status: 'ready',
      matchId: match.matchId,
      matchToken: token,
      wsUrl: getWsUrl(),
      playerId: userId,
    })
  }

  // Check if still in queue
  if (isInQueue(userId)) {
    return NextResponse.json({
      status: 'waiting',
      message: 'Waiting for another player',
    })
  }

  // Not in queue and no match
  return NextResponse.json({
    status: 'none',
    message: 'Not in queue',
  })
}

