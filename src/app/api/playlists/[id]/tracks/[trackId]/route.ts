import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; trackId: string }> }
) {
  try {
    const { id: playlistId, trackId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify the playlist belongs to the user
    const { data: playlist, error: playlistError } = await supabase
      .from("playlists")
      .select("id")
      .eq("id", playlistId)
      .eq("user_id", user.id)
      .single();

    if (playlistError || !playlist) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    // Delete the track
    const { error: deleteError } = await supabase
      .from("playlist_tracks")
      .delete()
      .eq("id", trackId)
      .eq("playlist_id", playlistId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Re-number positions to close gaps
    const { data: remaining, error: fetchError } = await supabase
      .from("playlist_tracks")
      .select("id")
      .eq("playlist_id", playlistId)
      .order("position", { ascending: true });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (remaining && remaining.length > 0) {
      const updates = remaining.map((track, index) =>
        supabase
          .from("playlist_tracks")
          .update({ position: index })
          .eq("id", track.id)
      );
      await Promise.all(updates);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
