import { NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/spotify-token";
import { spotify } from "@/lib/providers/spotify";

export async function GET() {
  try {
    const { accessToken } = await getSpotifyToken();
    const playlists = await spotify.getUserPlaylists(accessToken);
    return NextResponse.json(playlists);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
