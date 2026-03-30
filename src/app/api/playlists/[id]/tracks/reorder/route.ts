import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface TrackUpdate {
  id: string;
  position: number;
  group_id: string | null;
  group_position: number | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params;
    const { tracks }: { tracks: TrackUpdate[] } = await request.json();
    const supabase = await createClient();

    // Update each track's position and group assignment
    const updates = tracks.map((t) =>
      supabase
        .from("playlist_tracks")
        .update({
          position: t.position,
          group_id: t.group_id,
          group_position: t.group_position,
        })
        .eq("id", t.id)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
