// ============================================================
// GameClient — WebSocket connection manager
// Framework-agnostic: pure TypeScript, zero dependencies
// ============================================================

import type {
  GameState,
  ServerMessage,
  ClientMessage,
  ConnectionStatus,
  ConnectionParams,
} from './types'

// --- Ping configuration ---

const PING_INTERVAL_MS = 2000 // send a ping every 2 seconds

// --- Event types emitted by GameClient ---

export type GameClientEventMap = {
  stateUpdate: (state: GameState) => void
  welcome: (playerId: string, matchId: string) => void
  error: (reason: string) => void
  matchEnded: (reason: string) => void
  connectionChange: (status: ConnectionStatus) => void
  pingUpdate: (pingMs: number) => void
}

// --- GameClient class ---

export class GameClient {
  private ws: WebSocket | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private listeners = new Map<keyof GameClientEventMap, Set<(...args: any[]) => void>>()
  private _status: ConnectionStatus = 'disconnected'
  private _playerId: string | null = null
  private _pingMs: number = 0
  private _pingInterval: ReturnType<typeof setInterval> | null = null

  /** Current connection status */
  get status(): ConnectionStatus {
    return this._status
  }

  /** Player ID assigned by the server (available after 'welcome' event) */
  get playerId(): string | null {
    return this._playerId
  }

  /** Whether the WebSocket is open and ready to send */
  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  /** Current ping/latency in milliseconds (round-trip time) */
  get pingMs(): number {
    return this._pingMs
  }

  /**
   * Connect to the game server via WebSocket.
   * @param wsUrl  Base WebSocket URL (e.g. "wss://server.example.com")
   * @param params Connection params: token, matchId, playerId
   */
  connect(wsUrl: string, params: ConnectionParams): void {
    // Close any existing connection
    this.disconnect()

    this.setStatus('connecting')

    const qs = new URLSearchParams({
      token: params.token,
      matchId: params.matchId,
      playerId: params.playerId,
      mode: params.mode,
    })

    const ws = new WebSocket(`${wsUrl}?${qs.toString()}`)
    this.ws = ws

    ws.onopen = () => {
      this.setStatus('connected')
      this.startPing()
    }

    ws.onclose = () => {
      this.stopPing()
      this.ws = null
      // Don't overwrite a more specific status (e.g. 'error')
      if (this._status === 'connected' || this._status === 'connecting') {
        this.setStatus('disconnected')
      }
    }

    ws.onerror = () => {
      this.setStatus('error')
    }

    ws.onmessage = (event) => {
      this.handleMessage(event.data)
    }
  }

  /**
   * Send a message to the game server.
   */
  send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  /**
   * Disconnect from the game server.
   */
  disconnect(): void {
    this.stopPing()
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onclose = null
      this.ws.onerror = null
      this.ws.onmessage = null
      this.ws.close()
      this.ws = null
    }
    this._playerId = null
    this.setStatus('disconnected')
  }

  /**
   * Register an event listener.
   */
  on<K extends keyof GameClientEventMap>(event: K, callback: GameClientEventMap[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  /**
   * Remove an event listener.
   */
  off<K extends keyof GameClientEventMap>(event: K, callback: GameClientEventMap[K]): void {
    this.listeners.get(event)?.delete(callback)
  }

  /**
   * Remove all listeners for an event (or all events if no event specified).
   */
  removeAllListeners(event?: keyof GameClientEventMap): void {
    if (event) {
      this.listeners.delete(event)
    } else {
      this.listeners.clear()
    }
  }

  // --- Private helpers ---

  private setStatus(status: ConnectionStatus): void {
    if (this._status === status) return
    this._status = status
    this.emit('connectionChange', status)
  }

  private handleMessage(raw: string): void {
    try {
      const message: ServerMessage = JSON.parse(raw)

      switch (message.type) {
        case 'STATE':
          this.emit('stateUpdate', message.state)
          break

        case 'WELCOME':
          this._playerId = message.playerId
          this.emit('welcome', message.playerId, message.matchId)
          break

        case 'ERROR':
          this.emit('error', message.reason)
          break

        case 'MATCH_ENDED':
          this.emit('matchEnded', message.reason)
          break

        case 'PONG':
          this._pingMs = Math.round(performance.now() - message.timestamp)
          this.emit('pingUpdate', this._pingMs)
          break
      }
    } catch {
      // Ignore unparseable messages
    }
  }

  private startPing(): void {
    this.stopPing()
    // Send first ping immediately
    this.sendPing()
    this._pingInterval = setInterval(() => this.sendPing(), PING_INTERVAL_MS)
  }

  private stopPing(): void {
    if (this._pingInterval !== null) {
      clearInterval(this._pingInterval)
      this._pingInterval = null
    }
  }

  private sendPing(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'PING', timestamp: performance.now() }))
    }
  }

  private emit<K extends keyof GameClientEventMap>(
    event: K,
    ...args: Parameters<GameClientEventMap[K]>
  ): void {
    const callbacks = this.listeners.get(event)
    if (!callbacks) return
    for (const cb of callbacks) {
      cb(...args)
    }
  }
}
