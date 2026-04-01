import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch playlist
    const { data: playlist, error: playlistError } = await supabase
      .from("playlists")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (playlistError) {
      return NextResponse.json({ error: "Playlist not found" }, { status: 404 });
    }

    // Fetch tracks with their tags, ordered by position
    const { data: tracks, error: tracksError } = await supabase
      .from("playlist_tracks")
      .select("*, track_tags(tag_id, tags(*))")
      .eq("playlist_id", id)
      .order("position", { ascending: true });

    if (tracksError) {
      return NextResponse.json({ error: tracksError.message }, { status: 500 });
    }

    // Flatten tags onto each track
    const tracksWithTags = (tracks || []).map((track) => ({
      ...track,
      tags: (track.track_tags || []).map((tt: { tags: unknown }) => tt.tags).filter(Boolean),
      track_tags: undefined,
    }));

    // Fetch groups
    const { data: groups } = await supabase
      .from("groups")
      .select("*")
      .eq("playlist_id", id)
      .order("position", { ascending: true });

    return NextResponse.json({ ...playlist, tracks: tracksWithTags, groups: groups || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { name } = await request.json();
    if (typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("playlists")
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { error } = await supabase
      .from("playlists")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
