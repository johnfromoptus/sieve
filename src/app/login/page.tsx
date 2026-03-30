"use client";

import { generateCodeVerifier, generateCodeChallenge, generateState } from "@/lib/pkce";

const SPOTIFY_AUTH_URL = "https://accounts.spotify.com/authorize";
const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!;
const REDIRECT_URI =
  process.env.NEXT_PUBLIC_SITE_URL
    ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
    : "http://127.0.0.1:3000/auth/callback";
const SCOPES = [
  "user-read-private",
  "user-read-email",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
].join(" ");

export default function LoginPage() {
  async function handleLogin() {
    try {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      const state = generateState();

      sessionStorage.setItem("spotify_code_verifier", verifier);
      sessionStorage.setItem("spotify_auth_state", state);

      const params = new URLSearchParams({
        response_type: "code",
        client_id: CLIENT_ID,
        scope: SCOPES,
        redirect_uri: REDIRECT_URI,
        state,
        code_challenge_method: "S256",
        code_challenge: challenge,
      });

      window.location.href = `${SPOTIFY_AUTH_URL}?${params.toString()}`;
    } catch (err) {
      console.error("Login error:", err);
      alert("Login failed — check console");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold text-white">sieve</h1>
        <p className="mb-8 text-zinc-400">playlist management that doesn&apos;t suck</p>
        <button
          onClick={handleLogin}
          className="rounded-full bg-green-500 px-8 py-3 font-semibold text-black transition hover:bg-green-400"
        >
          Sign in with Spotify
        </button>
      </div>
    </div>
  );
}
