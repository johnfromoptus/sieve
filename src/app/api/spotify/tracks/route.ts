import { NextRequest, NextResponse } from "next/server";
import { getSpotifyToken } from "@/lib/spotify-token";
import { spotify } from "@/lib/providers/spotify";

export async function GET(request: NextRequest) {
  try {
    const ids = request.nextUrl.searchParams.get("ids");
    if (!ids) {
      return NextResponse.json({ error: "Missing ids parameter" }, { status: 400 });
    }

    const { accessToken } = await getSpotifyToken();
    const trackIds = ids.split(",").filter(Boolean);
    const tracks = await spotify.getTracksByIds(accessToken, trackIds);

    // Return as a map of id -> metadata for easy lookup
    const trackMap: Record<string, (typeof tracks)[0]> = {};
    for (const track of tracks) {
      trackMap[track.providerTrackId] = track;
    }

    return NextResponse.json(trackMap);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
