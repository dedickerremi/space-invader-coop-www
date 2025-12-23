import { NextRequest, NextResponse } from 'next/server'
import { addToQueue, getPlayerMatch, getTokenForPlayer } from '@/lib/queue'
import { getWsUrl } from '@/lib/matchmaking'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Add to queue (may trigger match creation)
    addToQueue(userId)

    // Check if match was created
    const match = getPlayerMatch(userId)

    if (match) {
      const token = getTokenForPlayer(match.matchId, userId)
      return NextResponse.json({
        status: 'matched',
        matchId: match.matchId,
        matchToken: token,
        wsUrl: getWsUrl(),
        playerId: userId,
      })
    }

    return NextResponse.json({
      status: 'queued',
      message: 'Waiting for another player',
    })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}

