import { NextRequest, NextResponse } from 'next/server'
import { backendHttpUrl } from '@/lib/backend'

// Proxies session creation to the game server, which mints the token, the
// player id and (for solo) the match id.
//
// This route holds no state of its own. It used to run a queue and a match
// store in `globalThis`, which could not work on serverless — each request may
// land on a different instance — and meant the frontend was issuing the
// credentials for a server that had no way to verify them.
//
// Proxying rather than letting the browser call the backend directly keeps the
// game server free of CORS config and keeps the client on one origin.
export async function POST(request: NextRequest) {
  let mode: unknown = 'coop'
  let difficulty: unknown = 'easy'
  try {
    const body = await request.json()
    mode = body?.mode ?? 'coop'
    difficulty = body?.difficulty ?? 'easy'
  } catch {
    // No body is fine — the backend defaults to coop on easy.
  }

  try {
    const res = await fetch(`${backendHttpUrl()}/api/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, difficulty }),
      cache: 'no-store',
    })

    if (!res.ok) {
      return NextResponse.json(
        { error: res.status === 429 ? 'Too many requests, try again shortly' : 'Game server unavailable' },
        { status: res.status === 429 ? 429 : 502 },
      )
    }

    const session = await res.json()
    return NextResponse.json({
      status: 'ok',
      token: session.token,
      playerId: session.playerId,
      matchId: session.matchId || undefined,
      mode: session.mode,
      difficulty: session.difficulty,
      wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
    })
  } catch {
    return NextResponse.json({ error: 'Game server unreachable' }, { status: 502 })
  }
}
