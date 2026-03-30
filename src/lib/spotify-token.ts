import { createClient } from "@/lib/supabase/server";
import { spotify } from "@/lib/providers/spotify";

/**
 * Gets a valid Spotify access token for the current user.
 * Refreshes automatically if expired.
 */
export async function getSpotifyToken(): Promise<{ accessToken: string; userId: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: userData, error } = await supabase
    .from("users")
    .select("access_token, refresh_token, token_expires, provider_id")
    .eq("id", user.id)
    .single();

  if (error || !userData) {
    throw new Error("User record not found");
  }

  // Check if token is still valid (with 5 min buffer)
  const expiresAt = new Date(userData.token_expires).getTime();
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    return { accessToken: userData.access_token, userId: user.id };
  }

  // Refresh the token
  const refreshed = await spotify.refreshAccessToken(userData.refresh_token);

  await supabase
    .from("users")
    .update({
      access_token: refreshed.accessToken,
      token_expires: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
    })
    .eq("id", user.id);

  return { accessToken: refreshed.accessToken, userId: user.id };
}
