"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download, Trash2 } from "lucide-react";
import TopBar from "@/components/TopBar";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  provider: string | null;
  created_at: string;
  track_count: number;
  published_at: string | null;
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/playlists")
      .then((res) => res.json())
      .then((data) => {
        const list: Playlist[] = Array.isArray(data) ? data : [];
        setPlaylists(list);
        setLoading(false);
        const drafts = new Set(
          list
            .filter((p) => localStorage.getItem(`sieve_draft_${p.id}`) !== null)
            .map((p) => p.id)
        );
        setDraftIds(drafts);
      });
  }, []);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/playlists/${id}`, { method: "DELETE" });
      setPlaylists((prev) => prev.filter((p) => p.id !== id));
      setDraftIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <TopBar
        rightContent={
          <button
            onClick={() => router.push("/import")}
            className="flex items-center gap-2 rounded-lg bg-green-500 px-4 py-2 font-medium text-black transition hover:bg-green-400 text-sm"
          >
            <Download size={16} />
            Import from Spotify
          </button>
        }
      />

      <div className="mx-auto max-w-4xl px-6 py-8">
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-zinc-800 p-4 animate-pulse"
              >
                <div className="mb-3 aspect-square w-full rounded-lg bg-zinc-800" />
                <div className="h-4 w-2/3 rounded bg-zinc-800 mb-2" />
                <div className="h-3 w-1/2 rounded bg-zinc-700" />
              </div>
            ))}
          </div>
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
            {playlists.map((playlist) =>
              confirmDelete === playlist.id ? (
                <div
                  key={playlist.id}
                  className="rounded-xl border border-zinc-700 p-4 flex flex-col justify-between gap-4"
                >
                  <p className="text-sm text-white">
                    Delete{" "}
                    <span className="font-semibold">{playlist.name}</span>?{" "}
                    This cannot be undone.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(playlist.id)}
                      disabled={deleting === playlist.id}
                      className="flex-1 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      {deleting === playlist.id ? "Deleting…" : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="flex-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div key={playlist.id} className="relative group">
                  <button
                    onClick={() => router.push(`/playlist/${playlist.id}`)}
                    className="w-full rounded-xl border border-zinc-800 p-4 text-left transition hover:border-zinc-600"
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
                    <p className="mt-1 text-xs text-zinc-500">
                      {playlist.track_count} track{playlist.track_count !== 1 ? "s" : ""}{" "}
                      ·{" "}
                      {playlist.published_at
                        ? `Published ${formatRelativeDate(playlist.published_at)}`
                        : "Unpublished"}
                    </p>
                  </button>
                  {draftIds.has(playlist.id) && (
                    <span
                      className="absolute top-2 right-2 h-2 w-2 rounded-full bg-amber-400"
                      title="Unsaved changes"
                    />
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(playlist.id);
                    }}
                    className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                    title="Delete playlist"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
