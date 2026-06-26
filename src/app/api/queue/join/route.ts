import { NextRequest, NextResponse } from 'next/server'
import { getTokenForPlayer, createAndStoreSoloMatch } from '@/lib/queue'
import { getWsUrl } from '@/lib/matchmaking'

declare global {
  // eslint-disable-next-line no-var
  var _queueTokens: Map<string, string> | undefined
}

function getQueueTokens(): Map<string, string> {
  if (!globalThis._queueTokens) {
    globalThis._queueTokens = new Map()
  }
  return globalThis._queueTokens
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, mode = 'coop' } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      )
    }

    // Solo mode: create match immediately, no queue
    if (mode === 'solo') {
      const match = createAndStoreSoloMatch(userId)
      if (!match) {
        return NextResponse.json({
          status: 'error',
          error: 'Cannot create match: max active matches reached',
        })
      }
      const token = getTokenForPlayer(match.matchId, userId)
      return NextResponse.json({
        status: 'matched',
        matchId: match.matchId,
        matchToken: token,
        wsUrl: getWsUrl(),
        playerId: userId,
        mode: 'solo',
      })
    }

    // Coop mode: always return queued — the WS server handles all matching.
    // Never short-circuit to 'matched' here: if player 2 arrives while player 1
    // is already waiting on a WS queue connection, returning 'matched' causes
    // player 2 to skip the WS entirely, leaving player 1 stuck forever.
    const queueToken = `token-${generateId()}`
    getQueueTokens().set(userId, queueToken)

    return NextResponse.json({
      status: 'queued',
      queueToken,
      wsUrl: getWsUrl(),
    })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}

