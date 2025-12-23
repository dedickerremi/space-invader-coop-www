import { NextRequest, NextResponse } from 'next/server'
import { removeFromQueue, clearPlayerMatch } from '@/lib/queue'

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

    removeFromQueue(userId)
    clearPlayerMatch(userId)

    return NextResponse.json({
      status: 'left',
      message: 'Left the queue',
    })
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}

