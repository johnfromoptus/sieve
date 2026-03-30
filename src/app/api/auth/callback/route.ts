import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { spotify } from "@/lib/providers/spotify";

export async function POST(request: NextRequest) {
  const { code, codeVerifier } = await request.json();

  if (!code || !codeVerifier) {
    return NextResponse.json({ error: "Missing code or verifier" }, { status: 400 });
  }

  try {
    // Exchange code for tokens with Spotify
    const tokens = await spotify.exchangeCode(code, codeVerifier);

    // Get Spotify user profile
    const profileRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    if (!profileRes.ok) {
      return NextResponse.json({ error: "Failed to get Spotify profile" }, { status: 500 });
    }
    const profile = await profileRes.json();

    // Sign in (or sign up) via Supabase using the Spotify ID as a deterministic password
    // This is a workaround since we're handling OAuth ourselves rather than through Supabase's OAuth
    const supabase = await createClient();
    const email = `${profile.id}@spotify.sieve.local`;

    // Try to sign in first
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: `spotify_${profile.id}_sieve`,
    });

    let userId: string | undefined = signInData.user?.id;

    // If user doesn't exist, sign up
    if (signInError) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: `spotify_${profile.id}_sieve`,
      });
      if (signUpError) {
        return NextResponse.json({ error: signUpError.message }, { status: 500 });
      }
      userId = signUpData.user?.id;
    }
    if (!userId) {
      return NextResponse.json({ error: "Failed to authenticate" }, { status: 500 });
    }

    // Upsert user record with Spotify tokens
    const { error: upsertError } = await supabase.from("users").upsert({
      id: userId,
      provider: "spotify",
      provider_id: profile.id,
      display_name: profile.display_name,
      avatar_url: profile.images?.[0]?.url ?? null,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      token_expires: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
    });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
