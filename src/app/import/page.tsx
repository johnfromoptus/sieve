"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import TopBar from "@/components/TopBar";

interface SpotifyPlaylist {
  providerPlaylistId: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  trackCount: number;
}

export default function ImportPage() {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/spotify/playlists")
      .then((res) => res.json())
      .then((data) => {
        setPlaylists(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  async function handleImport(playlist: SpotifyPlaylist) {
    setImporting(playlist.providerPlaylistId);
    try {
      const res = await fetch("/api/playlists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerPlaylistId: playlist.providerPlaylistId,
          name: playlist.name,
          description: playlist.description,
          coverUrl: playlist.coverUrl,
        }),
      });
      const data = await res.json();
      if (data.id) {
        router.push(`/playlist/${data.id}`);
      }
    } catch {
      setImporting(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar />

      <div className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-bold text-white">Import from Spotify</h1>

        {loading ? (
          <p className="text-zinc-400">Loading your Spotify playlists…</p>
        ) : (
          <div className="space-y-2">
            {playlists.map((playlist) => (
              <div
                key={playlist.providerPlaylistId}
                className="flex items-center gap-4 rounded-lg border border-zinc-800 p-4"
              >
                {playlist.coverUrl ? (
                  <img
                    src={playlist.coverUrl}
                    alt=""
                    className="h-12 w-12 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-800 text-zinc-600">
                    ♪
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-medium text-white">{playlist.name}</p>
                  <p className="text-sm text-zinc-400">{playlist.trackCount} tracks</p>
                </div>
                <button
                  onClick={() => handleImport(playlist)}
                  disabled={importing !== null}
                  className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 disabled:opacity-50"
                >
                  {importing === playlist.providerPlaylistId ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "Import"
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
