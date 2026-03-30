-- Add track metadata columns to playlist_tracks
-- Spotify's /tracks endpoint is restricted in dev mode, so we cache metadata at import time
alter table public.playlist_tracks
  add column title text,
  add column artist text,
  add column album text,
  add column album_art_url text,
  add column duration_ms integer;
