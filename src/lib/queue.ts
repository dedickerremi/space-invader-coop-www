// In-memory queue and matchmaking logic
// Uses globalThis to persist data across Next.js API route invocations

import { createMatch, getTokenForPlayer, canCreateMatch } from './matchmaking'
import type { Match } from './matchmaking'

type QueuedPlayer = {
  userId: string
  joinedAt: number
}

// Persist in globalThis for Next.js dev mode
declare global {
  // eslint-disable-next-line no-var
  var _queue: QueuedPlayer[] | undefined
  // eslint-disable-next-line no-var
  var _playerMatches: Map<string, Match> | undefined
}

function getQueue(): QueuedPlayer[] {
  if (!globalThis._queue) {
    globalThis._queue = []
  }
  return globalThis._queue
}

function getPlayerMatches(): Map<string, Match> {
  if (!globalThis._playerMatches) {
    globalThis._playerMatches = new Map()
  }
  return globalThis._playerMatches
}

export function addToQueue(userId: string): boolean {
  const queue = getQueue()
  const playerMatches = getPlayerMatches()

  // Check if already in queue
  if (queue.some((p) => p.userId === userId)) {
    console.log(`[QUEUE] Player ${userId} already in queue`)
    return true
  }

  // Check if already in a match
  if (playerMatches.has(userId)) {
    console.log(`[QUEUE] Player ${userId} already matched`)
    return true
  }

  queue.push({ userId, joinedAt: Date.now() })
  console.log(`[QUEUE] Player ${userId} joined queue (${queue.length} waiting)`)

  // Try to create match
  tryCreateMatch()

  return true
}

export function removeFromQueue(userId: string): boolean {
  const queue = getQueue()
  const index = queue.findIndex((p) => p.userId === userId)
  if (index !== -1) {
    queue.splice(index, 1)
    console.log(`[QUEUE] Player ${userId} left queue (${queue.length} waiting)`)
    return true
  }
  return false
}

export function getPlayerMatch(userId: string): Match | null {
  return getPlayerMatches().get(userId) ?? null
}

export function clearPlayerMatch(userId: string): void {
  getPlayerMatches().delete(userId)
}

function tryCreateMatch(): void {
  const queue = getQueue()
  const playerMatches = getPlayerMatches()

  console.log(`[QUEUE] Trying to create match, queue size: ${queue.length}`)

  // Need at least 2 players
  if (queue.length < 2) {
    console.log('[QUEUE] Not enough players')
    return
  }

  // Check if we can create more matches
  if (!canCreateMatch()) {
    console.log('[QUEUE] Cannot create match: max active matches reached')
    return
  }

  // Take first 2 players (FIFO)
  const player1 = queue.shift()!
  const player2 = queue.shift()!

  console.log(`[QUEUE] Creating match for ${player1.userId} and ${player2.userId}`)

  const match = createMatch(player1.userId, player2.userId)

  if (match) {
    playerMatches.set(player1.userId, match)
    playerMatches.set(player2.userId, match)
    console.log(`[QUEUE] Match created: ${match.matchId}`)
  } else {
    // Put players back in queue if match creation failed
    queue.unshift(player2)
    queue.unshift(player1)
    console.log('[QUEUE] Match creation failed, players returned to queue')
  }
}

export function getQueueLength(): number {
  return getQueue().length
}

export function isInQueue(userId: string): boolean {
  return getQueue().some((p) => p.userId === userId)
}

export { getTokenForPlayer }
