# space-invader-coop-www

Cooperative Space Invaders frontend — Next.js 15 + React 19.

## Env vars

Copy `.env.example` to `.env.local` and fill in what you need:

- `NEXT_PUBLIC_WS_URL` — backend base URL (WebSocket + `/api/game-meta`).
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key. Optional. When unset, auth UI is hidden and every session is a guest.
- `CLERK_SECRET_KEY` — Clerk secret (server-only). Required alongside the publishable key for Clerk's Next.js middleware.

The game is fully playable without Clerk — signing in only unlocks score persistence (server-side, follow-up feature).

## Run

```
yarn
yarn dev
```
