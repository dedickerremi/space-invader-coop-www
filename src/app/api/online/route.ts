import { NextResponse } from 'next/server'
import { getQueueLength } from '@/lib/queue'
import { getActiveMatchCount } from '@/lib/matchmaking'

export async function GET() {
  const playersOnline = getQueueLength() + getActiveMatchCount() * 2
  return NextResponse.json({ playersOnline })
}
