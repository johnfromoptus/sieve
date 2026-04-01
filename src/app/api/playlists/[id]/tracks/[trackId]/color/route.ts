import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; trackId: string }> }
) {
  const { trackId } = await params;
  const supabase = await createClient();
  const { color } = await req.json();

  const { error } = await supabase
    .from("playlist_tracks")
    .update({ color: color ?? null })
    .eq("id", trackId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
