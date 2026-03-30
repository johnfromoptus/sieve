@AGENTS.md

# Sieve

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind)
- Supabase (Postgres + auth)
- Vercel (deploy)

## Commands
- `npm run dev` — local dev server at http://127.0.0.1:3000 (not localhost — Spotify rejects localhost redirects)
- `npx tsc --noEmit` — type-check

## Architecture
- Provider adapter pattern: `src/lib/providers/types.ts` defines `MusicProvider` interface, `spotify.ts` implements it
- Spotify OAuth is handled manually (PKCE), not through Supabase OAuth. Fake emails bridge Spotify identity to Supabase auth.
- Track metadata is cached in DB at import time (Spotify's `/tracks` batch endpoint is restricted in dev mode)
- All edits are local until user explicitly publishes to Spotify

## Spotify API Gotchas
- Field renames: `tracks` → `items` in playlist responses, `item.track` → `item.item`
- Endpoint renames: `/playlists/{id}/tracks` → `/playlists/{id}/items`
- Dev mode: creating new playlists returns 403. Overwriting imported playlists works.
- Always log raw response shape when using a new endpoint — docs may be outdated

## Environment
- `.env.local` contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`
- Dev access requires `allowedDevOrigins: ["127.0.0.1"]` in next.config.ts
- Supabase email confirmation must be disabled (Settings → Auth)
