import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; trackId: string }> }
) {
  try {
    const { trackId } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("track_tags")
      .select("tag_id, tags(*)")
      .eq("track_entry_id", trackId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data.map((tt) => tt.tags));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; trackId: string }> }
) {
  try {
    const { trackId } = await params;
    const { tagId } = await request.json();
    const supabase = await createClient();

    const { error } = await supabase
      .from("track_tags")
      .insert({ track_entry_id: trackId, tag_id: tagId });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Tag already assigned" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; trackId: string }> }
) {
  try {
    const { trackId } = await params;
    const { tagId } = await request.json();
    const supabase = await createClient();

    const { error } = await supabase
      .from("track_tags")
      .delete()
      .eq("track_entry_id", trackId)
      .eq("tag_id", tagId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
