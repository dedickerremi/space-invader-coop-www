import { NextResponse } from 'next/server'
import { backendHttpUrl } from '@/lib/backend'

// Proxies the game server's count. This used to be derived from an in-memory
// queue in this process, which on serverless meant it reported one instance's
// scratch state — usually zero, whatever was actually happening.
export async function GET() {
  try {
    const res = await fetch(`${backendHttpUrl()}/api/online`, { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ playersOnline: null })
    }
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ playersOnline: null })
  }
}
