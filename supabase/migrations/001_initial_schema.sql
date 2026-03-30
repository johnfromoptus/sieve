-- Sieve Phase 1 schema
-- Run this in Supabase SQL Editor

-- Users table (linked to Supabase auth)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  provider text not null default 'spotify',
  provider_id text not null,
  display_name text,
  avatar_url text,
  access_token text,
  refresh_token text,
  token_expires timestamptz,
  created_at timestamptz default now(),
  unique(provider, provider_id)
);

alter table public.users enable row level security;

create policy "Users can read own data"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own data"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can insert own data"
  on public.users for insert
  with check (auth.uid() = id);

-- Playlists
create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  provider text,
  provider_playlist_id text,
  cover_url text,
  is_published boolean default false,
  published_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.playlists enable row level security;

create policy "Users can CRUD own playlists"
  on public.playlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Groups (needed for FK from playlist_tracks)
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  name text not null,
  position integer not null,
  color text,
  created_at timestamptz default now()
);

alter table public.groups enable row level security;

create policy "Users can CRUD own groups"
  on public.groups for all
  using (
    exists (
      select 1 from public.playlists
      where playlists.id = groups.playlist_id
      and playlists.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.playlists
      where playlists.id = groups.playlist_id
      and playlists.user_id = auth.uid()
    )
  );

-- Playlist tracks
create table public.playlist_tracks (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  provider_track_id text not null,
  position integer not null,
  group_id uuid references public.groups(id) on delete set null,
  group_position integer,
  color text,
  added_at timestamptz default now()
);

alter table public.playlist_tracks enable row level security;

create policy "Users can CRUD own playlist tracks"
  on public.playlist_tracks for all
  using (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_tracks.playlist_id
      and playlists.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.playlists
      where playlists.id = playlist_tracks.playlist_id
      and playlists.user_id = auth.uid()
    )
  );

-- Tags
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  color text,
  unique(user_id, name)
);

alter table public.tags enable row level security;

create policy "Users can CRUD own tags"
  on public.tags for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Track-tag junction
create table public.track_tags (
  track_entry_id uuid not null references public.playlist_tracks(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  primary key (track_entry_id, tag_id)
);

alter table public.track_tags enable row level security;

create policy "Users can CRUD own track tags"
  on public.track_tags for all
  using (
    exists (
      select 1 from public.playlist_tracks
      join public.playlists on playlists.id = playlist_tracks.playlist_id
      where playlist_tracks.id = track_tags.track_entry_id
      and playlists.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.playlist_tracks
      join public.playlists on playlists.id = playlist_tracks.playlist_id
      where playlist_tracks.id = track_tags.track_entry_id
      and playlists.user_id = auth.uid()
    )
  );

-- Indexes for common queries
create index idx_playlists_user_id on public.playlists(user_id);
create index idx_playlist_tracks_playlist_id on public.playlist_tracks(playlist_id);
create index idx_playlist_tracks_group_id on public.playlist_tracks(group_id);
create index idx_groups_playlist_id on public.groups(playlist_id);
create index idx_tags_user_id on public.tags(user_id);
