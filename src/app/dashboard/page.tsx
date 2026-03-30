"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download } from "lucide-react";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  provider: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/playlists")
      .then((res) => res.json())
      .then((data) => {
        setPlaylists(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">your playlists</h1>
          <div className="flex gap-3">
            <button
              onClick={() => router.push("/import")}
              className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 font-medium text-black transition hover:bg-green-400"
            >
              <Download size={18} />
              Import from Spotify
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-zinc-400">Loading...</p>
        ) : playlists.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 p-12 text-center">
            <p className="mb-4 text-zinc-400">no playlists yet</p>
            <button
              onClick={() => router.push("/import")}
              className="text-green-400 underline"
            >
              Import one from Spotify
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {playlists.map((playlist) => (
              <button
                key={playlist.id}
                onClick={() => router.push(`/playlist/${playlist.id}`)}
                className="rounded-xl border border-zinc-800 p-4 text-left transition hover:border-zinc-600"
              >
                {playlist.cover_url ? (
                  <img
                    src={playlist.cover_url}
                    alt=""
                    className="mb-3 aspect-square w-full rounded-lg object-cover"
                  />
                ) : (
                  <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-800">
                    <Plus size={32} className="text-zinc-600" />
                  </div>
                )}
                <h2 className="font-semibold text-white">{playlist.name}</h2>
                {playlist.description && (
                  <p className="mt-1 text-sm text-zinc-400 line-clamp-2">
                    {playlist.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
