export interface TrackMetadata {
  providerTrackId: string;
  title: string;
  artist: string;
  album: string;
  albumArtUrl: string | null;
  durationMs: number;
  previewUrl: string | null;
}

export interface PlaylistSummary {
  providerPlaylistId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  trackCount: number;
}

export interface PlaylistDetail extends PlaylistSummary {
  tracks: TrackMetadata[];
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface MusicProvider {
  readonly name: string;

  // Auth
  getAuthUrl(state: string, codeChallenge: string): string;
  exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens>;
  refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }>;

  // Read
  getUserPlaylists(accessToken: string): Promise<PlaylistSummary[]>;
  getPlaylistTracks(accessToken: string, playlistId: string): Promise<TrackMetadata[]>;
  getTracksByIds(accessToken: string, trackIds: string[]): Promise<TrackMetadata[]>;
  searchTracks(accessToken: string, query: string, limit?: number): Promise<TrackMetadata[]>;

  // Write
  createPlaylist(accessToken: string, userId: string, name: string, description?: string): Promise<string>;
  replacePlaylistTracks(accessToken: string, playlistId: string, trackIds: string[]): Promise<void>;
}
