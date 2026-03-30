import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSpotifyToken } from "@/lib/spotify-token";
import { spotify } from "@/lib/providers/spotify";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { copyName } = await request.json().catch(() => ({ copyName: undefined }));
    const { accessToken } = await getSpotifyToken();
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get playlist
    const { data: playlist, error: playlistError } = await supabase
      .from("playlists")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (playlistError || !playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    // Get tracks in order
    const { data: tracks, error: tracksError } = await supabase
      .from("playlist_tracks")
      .select("provider_track_id, position, group_id, group_position")
      .eq("playlist_id", id)
      .order("position", { ascending: true });

    if (tracksError) {
      return NextResponse.json({ error: tracksError.message }, { status: 500 });
    }

    const trackIds = (tracks || []).map((t) => t.provider_track_id);

    // Get the user's Spotify provider_id for creating playlists
    const { data: userData } = await supabase
      .from("users")
      .select("provider_id")
      .eq("id", user.id)
      .single();

    let spotifyPlaylistId: string;

    if (copyName) {
      // Always create a new playlist when publishing as a copy
      spotifyPlaylistId = await spotify.createPlaylist(
        accessToken,
        userData!.provider_id,
        copyName,
        playlist.description || undefined
      );
    } else if (playlist.provider_playlist_id) {
      // Overwrite existing
      spotifyPlaylistId = playlist.provider_playlist_id;
    } else {
      // No existing Spotify playlist — create one
      spotifyPlaylistId = await spotify.createPlaylist(
        accessToken,
        userData!.provider_id,
        playlist.name,
        playlist.description || undefined
      );

      // Save the Spotify playlist ID back
      await supabase
        .from("playlists")
        .update({ provider_playlist_id: spotifyPlaylistId })
        .eq("id", id);
    }

    // Replace all tracks in the Spotify playlist
    await spotify.replacePlaylistTracks(accessToken, spotifyPlaylistId, trackIds);

    // Mark as published
    await supabase
      .from("playlists")
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq("id", id);

    return NextResponse.json({ success: true, spotifyPlaylistId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
