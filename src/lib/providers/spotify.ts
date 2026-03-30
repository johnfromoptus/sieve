import { MusicProvider, OAuthTokens, PlaylistSummary, TrackMetadata } from "./types";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_URL = "https://api.spotify.com/v1";

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!;
const REDIRECT_URI = process.env.NEXT_PUBLIC_SITE_URL
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
  : "http://127.0.0.1:3000/auth/callback";

const SCOPES = [
  "user-read-private",
  "user-read-email",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
].join(" ");

interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: SpotifyImage[] };
  duration_ms: number;
  preview_url: string | null;
}

function mapTrack(track: SpotifyTrack): TrackMetadata {
  return {
    providerTrackId: track.id,
    title: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    album: track.album.name,
    albumArtUrl: track.album.images[0]?.url ?? null,
    durationMs: track.duration_ms,
    previewUrl: track.preview_url,
  };
}

async function spotifyFetch(url: string, accessToken: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Spotify API error on ${url}: ${res.status} ${body}`);
    throw new Error(`Spotify API error ${res.status}: ${body}`);
  }
  return res.json();
}

export const spotify: MusicProvider = {
  name: "spotify",

  getAuthUrl(state: string, codeChallenge: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      scope: SCOPES,
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge_method: "S256",
      code_challenge: codeChallenge,
    });
    return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens> {
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: codeVerifier,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Token exchange failed: ${body}`);
    }
    const data = await res.json();
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  },

  async refreshAccessToken(refreshToken: string) {
    const res = await fetch(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Token refresh failed: ${body}`);
    }
    const data = await res.json();
    return { accessToken: data.access_token, expiresIn: data.expires_in };
  },

  async getUserPlaylists(accessToken: string): Promise<PlaylistSummary[]> {
    const playlists: PlaylistSummary[] = [];
    let url: string | null = `${SPOTIFY_API_URL}/me/playlists?limit=50`;

    while (url) {
      const data = await spotifyFetch(url, accessToken);
      for (const item of data.items) {
        if (!item || !item.id) continue;
        playlists.push({
          providerPlaylistId: item.id,
          name: item.name,
          description: item.description || null,
          coverUrl: item.images?.[0]?.url ?? null,
          trackCount: item.items?.total ?? item.tracks?.total ?? 0,
        });
      }
      url = data.next;
    }
    return playlists;
  },

  async getPlaylistTracks(accessToken: string, playlistId: string): Promise<TrackMetadata[]> {
    const tracks: TrackMetadata[] = [];
    let url: string | null = `${SPOTIFY_API_URL}/playlists/${playlistId}/items?limit=100`;

    while (url) {
      const data = await spotifyFetch(url, accessToken);
      for (const item of data.items) {
        const track = item.track ?? item.item;
        if (track && track.id) {
          tracks.push(mapTrack(track));
        }
      }
      url = data.next;
    }
    return tracks;
  },

  async getTracksByIds(accessToken: string, trackIds: string[]): Promise<TrackMetadata[]> {
    const tracks: TrackMetadata[] = [];
    // Spotify allows max 50 IDs per request
    for (let i = 0; i < trackIds.length; i += 50) {
      const batch = trackIds.slice(i, i + 50);
      const data = await spotifyFetch(
        `${SPOTIFY_API_URL}/tracks?ids=${batch.join(",")}`,
        accessToken
      );
      tracks.push(...data.tracks.filter(Boolean).map(mapTrack));
    }
    return tracks;
  },

  async searchTracks(accessToken: string, query: string, limit = 20): Promise<TrackMetadata[]> {
    const params = new URLSearchParams({ q: query, type: "track", limit: String(limit) });
    const data = await spotifyFetch(`${SPOTIFY_API_URL}/search?${params}`, accessToken);
    return data.tracks.items.map(mapTrack);
  },

  async createPlaylist(accessToken: string, userId: string, name: string, description?: string): Promise<string> {
    const data = await spotifyFetch(`${SPOTIFY_API_URL}/users/${userId}/playlists`, accessToken, {
      method: "POST",
      body: JSON.stringify({ name, description: description || "", public: false }),
    });
    return data.id;
  },

  async replacePlaylistTracks(accessToken: string, playlistId: string, trackIds: string[]): Promise<void> {
    const uris = trackIds.map((id) => `spotify:track:${id}`);
    // Spotify allows max 100 URIs per request
    // First call replaces, subsequent calls append
    for (let i = 0; i < uris.length; i += 100) {
      const batch = uris.slice(i, i + 100);
      await spotifyFetch(`${SPOTIFY_API_URL}/playlists/${playlistId}/items`, accessToken, {
        method: i === 0 ? "PUT" : "POST",
        body: JSON.stringify({ uris: batch }),
      });
    }
  },
};
