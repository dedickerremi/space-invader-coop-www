// The game server's HTTP origin, derived from the WebSocket URL so there is
// only one backend address to configure.
export function backendHttpUrl(): string {
  const ws = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
  return ws.replace(/^ws/, 'http').replace(/\/$/, '')
}
