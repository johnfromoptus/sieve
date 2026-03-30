import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSpotifyToken } from "@/lib/spotify-token";
import { spotify } from "@/lib/providers/spotify";

export async function POST(request: NextRequest) {
  try {
    const { providerPlaylistId, name, description, coverUrl } = await request.json();

    if (!providerPlaylistId) {
      return NextResponse.json({ error: "Missing playlist ID" }, { status: 400 });
    }

    const { accessToken, userId } = await getSpotifyToken();
    const supabase = await createClient();

    // Fetch tracks from Spotify
    const tracks = await spotify.getPlaylistTracks(accessToken, providerPlaylistId);

    // Create sieve playlist
    const { data: playlist, error: playlistError } = await supabase
      .from("playlists")
      .insert({
        user_id: userId,
        name: name || "Imported Playlist",
        description: description || null,
        provider: "spotify",
        provider_playlist_id: providerPlaylistId,
        cover_url: coverUrl || null,
      })
      .select()
      .single();

    if (playlistError) {
      return NextResponse.json({ error: playlistError.message }, { status: 500 });
    }

    // Insert tracks with gapped positions
    if (tracks.length > 0) {
      const trackRows = tracks.map((track, index) => ({
        playlist_id: playlist.id,
        provider_track_id: track.providerTrackId,
        position: (index + 1) * 10,
        title: track.title,
        artist: track.artist,
        album: track.album,
        album_art_url: track.albumArtUrl,
        duration_ms: track.durationMs,
      }));

      const { error: tracksError } = await supabase
        .from("playlist_tracks")
        .insert(trackRows);

      if (tracksError) {
        return NextResponse.json({ error: tracksError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ id: playlist.id, trackCount: tracks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
