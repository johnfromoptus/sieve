"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const errorParam = searchParams.get("error");

      if (errorParam) {
        setError(`Spotify denied access: ${errorParam}`);
        return;
      }

      if (!code || !state) {
        setError("Missing code or state from Spotify");
        return;
      }

      const savedState = sessionStorage.getItem("spotify_auth_state");
      const codeVerifier = sessionStorage.getItem("spotify_code_verifier");

      if (state !== savedState) {
        setError("State mismatch — possible CSRF attack");
        return;
      }

      if (!codeVerifier) {
        setError("Missing code verifier — try logging in again");
        return;
      }

      // Exchange code via our API route
      const res = await fetch("/api/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, codeVerifier }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Authentication failed");
        return;
      }

      // Clean up
      sessionStorage.removeItem("spotify_auth_state");
      sessionStorage.removeItem("spotify_code_verifier");

      router.push("/dashboard");
    }

    handleCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <p className="mb-4 text-red-400">{error}</p>
          <a href="/login" className="text-green-400 underline">
            Try again
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <p className="text-zinc-400">Authenticating...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-zinc-950"><p className="text-zinc-400">Loading...</p></div>}>
      <AuthCallbackInner />
    </Suspense>
  );
}
