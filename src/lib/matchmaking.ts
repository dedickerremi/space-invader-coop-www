// Match management (mirrors backend logic for token generation)
// Uses globalThis to persist data across Next.js API route invocations

const MAX_MATCHES = 10
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'

export type Match = {
  matchId: string
  playerIds: string[]
  tokens: Map<string, string> // playerId -> matchToken
  createdAt: number
}

// Persist in globalThis for Next.js dev mode
declare global {
  // eslint-disable-next-line no-var
  var _matches: Map<string, Match> | undefined
  // eslint-disable-next-line no-var
  var _tokenToMatch: Map<string, { matchId: string; playerId: string }> | undefined
}

function getMatches(): Map<string, Match> {
  if (!globalThis._matches) {
    globalThis._matches = new Map()
  }
  return globalThis._matches
}

function getTokenToMatch(): Map<string, { matchId: string; playerId: string }> {
  if (!globalThis._tokenToMatch) {
    globalThis._tokenToMatch = new Map()
  }
  return globalThis._tokenToMatch
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function canCreateMatch(): boolean {
  return getMatches().size < MAX_MATCHES
}

export function getActiveMatchCount(): number {
  return getMatches().size
}

export function createMatch(player1Id: string, player2Id: string): Match | null {
  const matches = getMatches()
  const tokenToMatch = getTokenToMatch()

  if (!canCreateMatch()) {
    return null
  }

  const matchId = `match-${generateId()}`
  const token1 = `token-${generateId()}`
  const token2 = `token-${generateId()}`

  const tokens = new Map<string, string>()
  tokens.set(player1Id, token1)
  tokens.set(player2Id, token2)

  const match: Match = {
    matchId,
    playerIds: [player1Id, player2Id],
    tokens,
    createdAt: Date.now(),
  }

  matches.set(matchId, match)
  tokenToMatch.set(token1, { matchId, playerId: player1Id })
  tokenToMatch.set(token2, { matchId, playerId: player2Id })

  console.log(`[MATCHMAKING] Created ${matchId} for ${player1Id} and ${player2Id}`)

  return match
}

export function getTokenForPlayer(matchId: string, playerId: string): string | null {
  const match = getMatches().get(matchId)
  if (!match) return null
  return match.tokens.get(playerId) ?? null
}

export function getMatch(matchId: string): Match | null {
  return getMatches().get(matchId) ?? null
}

export function removeMatch(matchId: string): void {
  const matches = getMatches()
  const tokenToMatch = getTokenToMatch()
  const match = matches.get(matchId)
  if (!match) return

  for (const token of match.tokens.values()) {
    tokenToMatch.delete(token)
  }

  matches.delete(matchId)
}

export function getWsUrl(): string {
  return WS_URL
}
