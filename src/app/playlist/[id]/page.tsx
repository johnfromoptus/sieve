"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, Tag, GripVertical, ChevronDown, ChevronRight, FolderPlus, Trash2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Types ──

interface TagData {
  id: string;
  name: string;
  color: string | null;
}

interface Track {
  id: string;
  provider_track_id: string;
  position: number;
  group_id: string | null;
  group_position: number | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  album_art_url: string | null;
  duration_ms: number | null;
  tags: TagData[];
}

interface Group {
  id: string;
  name: string;
  position: number;
  color: string | null;
}

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  tracks: Track[];
  groups: Group[];
  provider_playlist_id: string | null;
  is_published: boolean;
  published_at: string | null;
}

const TAG_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// ── Sortable Track Row ──

function SortableTrackRow({
  track,
  index,
  allTags,
  groups,
  tagPopoverTrack,
  setTagPopoverTrack,
  toggleTagOnTrack,
  popoverRef,
  onAssignTrack,
}: {
  track: Track;
  index: number;
  allTags: TagData[];
  groups: Group[];
  tagPopoverTrack: string | null;
  setTagPopoverTrack: (id: string | null) => void;
  toggleTagOnTrack: (trackId: string, tag: TagData, hasTag: boolean) => void;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  onAssignTrack: (trackId: string, groupId: string | null) => void;
}) {
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-4 rounded-lg px-4 py-3 transition hover:bg-zinc-900"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-zinc-600 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
      <span className="w-8 text-right text-sm text-zinc-500">{index + 1}</span>
      {track.album_art_url ? (
        <img src={track.album_art_url} alt="" className="h-10 w-10 rounded object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-zinc-600">♪</div>
      )}
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-white">{track.title || "Unknown"}</p>
        <p className="truncate text-sm text-zinc-400">
          {track.artist || "Unknown"} · {track.album || "Unknown"}
        </p>
      </div>

      {/* Track tags */}
      <div className="flex items-center gap-1">
        {track.tags.map((tag) => (
          <span
            key={tag.id}
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: `${tag.color || "#6b7280"}20`,
              color: tag.color || "#9ca3af",
            }}
          >
            {tag.name}
          </span>
        ))}
        <div className="relative" ref={tagPopoverTrack === track.id ? popoverRef : undefined}>
          <button
            onClick={() => setTagPopoverTrack(tagPopoverTrack === track.id ? null : track.id)}
            className="ml-1 rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100"
          >
            <Tag size={14} />
          </button>
          {tagPopoverTrack === track.id && (
            <div className="absolute right-0 top-8 z-10 min-w-48 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
              <div className="mb-1 px-2 text-xs font-medium text-zinc-500">Assign tags</div>
              {allTags.length === 0 ? (
                <p className="px-2 py-1 text-sm text-zinc-500">No tags yet</p>
              ) : (
                allTags.map((tag) => {
                  const hasTag = track.tags.some((t) => t.id === tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTagOnTrack(track.id, tag, hasTag)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm transition hover:bg-zinc-800"
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color || "#6b7280" }} />
                      <span className="flex-1 text-left text-white">{tag.name}</span>
                      {hasTag && <X size={12} className="text-zinc-400" />}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Move to group */}
      {groups.length > 0 && (
        <div className="relative" ref={groupMenuRef}>
          <button
            onClick={() => setShowGroupMenu(!showGroupMenu)}
            className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100"
          >
            <FolderPlus size={14} />
          </button>
          {showGroupMenu && (
            <div className="absolute right-0 top-8 z-10 min-w-40 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
              <div className="mb-1 px-2 text-xs font-medium text-zinc-500">Move to group</div>
              {track.group_id && (
                <button
                  onClick={() => { onAssignTrack(track.id, null); setShowGroupMenu(false); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800"
                >
                  Remove from group
                </button>
              )}
              {groups.filter((g) => g.id !== track.group_id).map((group) => (
                <button
                  key={group.id}
                  onClick={() => { onAssignTrack(track.id, group.id); setShowGroupMenu(false); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-white transition hover:bg-zinc-800"
                >
                  {group.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {track.duration_ms && (
        <span className="text-sm text-zinc-500">{formatDuration(track.duration_ms)}</span>
      )}
    </div>
  );
}

// ── Sortable Group ──

function SortableGroup({
  group,
  tracks,
  allTags,
  tagPopoverTrack,
  setTagPopoverTrack,
  toggleTagOnTrack,
  popoverRef,
  onDelete,
  onAssignTrack,
  playlistId,
  groups,
}: {
  group: Group;
  tracks: Track[];
  allTags: TagData[];
  groups: Group[];
  tagPopoverTrack: string | null;
  setTagPopoverTrack: (id: string | null) => void;
  toggleTagOnTrack: (trackId: string, tag: TagData, hasTag: boolean) => void;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  onDelete: (groupId: string) => void;
  onAssignTrack: (trackId: string, groupId: string | null) => void;
  playlistId: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `group-${group.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-2 rounded-xl border border-zinc-800">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-zinc-600 transition hover:text-zinc-400 active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        <button onClick={() => setCollapsed(!collapsed)} className="text-zinc-400 hover:text-white">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
        <span
          className="text-sm font-semibold"
          style={{ color: group.color || "#fff" }}
        >
          {group.name}
        </span>
        <span className="text-xs text-zinc-500">{tracks.length} tracks</span>
        <div className="flex-1" />
        <button
          onClick={() => onDelete(group.id)}
          className="rounded p-1 text-zinc-600 transition hover:bg-zinc-800 hover:text-red-400"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {!collapsed && (
        <div className="border-t border-zinc-800">
          <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tracks.map((track, i) => (
              <SortableTrackRow
                key={track.id}
                track={track}
                index={i}
                allTags={allTags}
                groups={groups}
                tagPopoverTrack={tagPopoverTrack}
                setTagPopoverTrack={setTagPopoverTrack}
                toggleTagOnTrack={toggleTagOnTrack}
                popoverRef={popoverRef}
                onAssignTrack={onAssignTrack}
              />
            ))}
          </SortableContext>
          {tracks.length === 0 && (
            <p className="px-8 py-4 text-sm text-zinc-600">Drag tracks here</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showNewTag, setShowNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [tagPopoverTrack, setTagPopoverTrack] = useState<string | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [showPublishMenu, setShowPublishMenu] = useState(false);
  const [copyName, setCopyName] = useState("");
  const [showCopyInput, setShowCopyInput] = useState(false);
  const publishMenuRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Click-outside to dismiss tag popover
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tagPopoverTrack && popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setTagPopoverTrack(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tagPopoverTrack]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showPublishMenu && publishMenuRef.current && !publishMenuRef.current.contains(e.target as Node)) {
        setShowPublishMenu(false);
        setShowCopyInput(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showPublishMenu]);

  const loadPlaylist = useCallback(async () => {
    const res = await fetch(`/api/playlists/${id}`);
    if (!res.ok) { router.push("/dashboard"); return; }
    const data: Playlist = await res.json();
    setPlaylist(data);
    setLoading(false);
  }, [id, router]);

  const loadTags = useCallback(async () => {
    const res = await fetch("/api/tags");
    if (res.ok) {
      const data = await res.json();
      setAllTags(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => { loadPlaylist(); loadTags(); }, [loadPlaylist, loadTags]);

  // ── Tag operations ──

  async function createTag() {
    if (!newTagName.trim()) return;
    const tempId = crypto.randomUUID();
    const optimisticTag: TagData = { id: tempId, name: newTagName.trim(), color: newTagColor };
    setAllTags((prev) => [...prev, optimisticTag]);
    setNewTagName("");
    setShowNewTag(false);
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: optimisticTag.name, color: optimisticTag.color }),
    });
    if (res.ok) {
      const real = await res.json();
      setAllTags((prev) => prev.map((t) => (t.id === tempId ? real : t)));
    } else {
      setAllTags((prev) => prev.filter((t) => t.id !== tempId));
    }
  }

  async function deleteTag(tagId: string) {
    setAllTags((prev) => prev.filter((t) => t.id !== tagId));
    setActiveFilters((prev) => { const next = new Set(prev); next.delete(tagId); return next; });
    setPlaylist((prev) => {
      if (!prev) return prev;
      return { ...prev, tracks: prev.tracks.map((t) => ({ ...t, tags: t.tags.filter((tg) => tg.id !== tagId) })) };
    });
    await fetch(`/api/tags/${tagId}`, { method: "DELETE" });
  }

  async function toggleTagOnTrack(trackId: string, tag: TagData, hasTag: boolean) {
    setPlaylist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tracks: prev.tracks.map((track) => {
          if (track.id !== trackId) return track;
          return { ...track, tags: hasTag ? track.tags.filter((t) => t.id !== tag.id) : [...track.tags, tag] };
        }),
      };
    });
    const url = `/api/playlists/${id}/tracks/${trackId}/tags`;
    const res = hasTag
      ? await fetch(url, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagId: tag.id }) })
      : await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagId: tag.id }) });
    if (!res.ok) {
      setPlaylist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tracks: prev.tracks.map((track) => {
            if (track.id !== trackId) return track;
            return { ...track, tags: hasTag ? [...track.tags, tag] : track.tags.filter((t) => t.id !== tag.id) };
          }),
        };
      });
    }
  }

  function toggleFilter(tagId: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
      return next;
    });
  }

  // ── Group operations ──

  async function createGroup() {
    if (!newGroupName.trim() || !playlist) return;
    const tempId = crypto.randomUUID();
    const maxPos = Math.max(0, ...playlist.groups.map((g) => g.position));
    const optimisticGroup: Group = { id: tempId, name: newGroupName.trim(), position: maxPos + 10, color: null };
    setPlaylist((prev) => prev ? { ...prev, groups: [...prev.groups, optimisticGroup] } : prev);
    setNewGroupName("");
    setShowNewGroup(false);
    const res = await fetch(`/api/playlists/${id}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: optimisticGroup.name }),
    });
    if (res.ok) {
      const real = await res.json();
      setPlaylist((prev) => prev ? { ...prev, groups: prev.groups.map((g) => g.id === tempId ? real : g) } : prev);
    } else {
      setPlaylist((prev) => prev ? { ...prev, groups: prev.groups.filter((g) => g.id !== tempId) } : prev);
    }
  }

  async function deleteGroup(groupId: string) {
    setPlaylist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        groups: prev.groups.filter((g) => g.id !== groupId),
        tracks: prev.tracks.map((t) => t.group_id === groupId ? { ...t, group_id: null, group_position: null } : t),
      };
    });
    await fetch(`/api/playlists/${id}/groups/${groupId}`, { method: "DELETE" });
  }

  async function assignTrackToGroup(trackId: string, groupId: string | null) {
    setPlaylist((prev) => {
      if (!prev) return prev;
      const track = prev.tracks.find((t) => t.id === trackId);
      if (!track) return prev;

      // If assigning to a group that currently has no tracks, move the group to the track's position
      let newGroups = prev.groups;
      if (groupId) {
        const groupHasTracks = prev.tracks.some((t) => t.id !== trackId && t.group_id === groupId);
        if (!groupHasTracks) {
          newGroups = prev.groups.map((g) =>
            g.id === groupId ? { ...g, position: track.position } : g
          );
        }
      }

      return {
        ...prev,
        groups: newGroups,
        tracks: prev.tracks.map((t) => t.id === trackId ? { ...t, group_id: groupId, group_position: groupId ? t.position : null } : t),
      };
    });
    // Persist
    await saveTrackOrder();
    // Also persist group position change
    if (groupId && playlist) {
      const track = playlist.tracks.find((t) => t.id === trackId);
      const groupHasTracks = playlist.tracks.some((t) => t.id !== trackId && t.group_id === groupId);
      if (track && !groupHasTracks) {
        await fetch(`/api/playlists/${id}/groups/${groupId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: track.position }),
        });
      }
    }
  }

  // ── Publish ──

  async function publishToSpotify(asCopy?: string) {
    if (publishing) return;
    setPublishing(true);
    setPublishStatus(null);
    setShowPublishMenu(false);
    setShowCopyInput(false);
    try {
      const res = await fetch(`/api/playlists/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copyName: asCopy || undefined }),
      });
      if (res.ok) {
        setPublishStatus(asCopy ? `Published as "${asCopy}"!` : "Published!");
        setTimeout(() => setPublishStatus(null), 3000);
        await loadPlaylist();
      } else {
        const data = await res.json();
        setPublishStatus(`Error: ${data.error}`);
      }
    } catch {
      setPublishStatus("Failed to publish");
    }
    setPublishing(false);
  }

  // ── Computed values ──

  const filteredTracks = playlist?.tracks.filter((track) => {
    if (activeFilters.size === 0) return true;
    return track.tags.some((tag) => activeFilters.has(tag.id));
  }) ?? [];

  const availableTagIds = new Set(filteredTracks.flatMap((track) => track.tags.map((tag) => tag.id)));
  const visibleTags = activeFilters.size === 0
    ? allTags
    : allTags.filter((tag) => activeFilters.has(tag.id) || availableTagIds.has(tag.id));

  const ungroupedTracks = filteredTracks.filter((t) => !t.group_id);
  const groups = playlist?.groups ?? [];

  type ListItem = { type: "track"; track: Track } | { type: "group"; group: Group; tracks: Track[] };
  const orderedItems: ListItem[] = [];

  for (const track of ungroupedTracks) {
    orderedItems.push({ type: "track", track });
  }
  for (const group of groups) {
    const groupTracks = filteredTracks
      .filter((t) => t.group_id === group.id)
      .sort((a, b) => (a.group_position ?? a.position) - (b.group_position ?? b.position));
    orderedItems.push({ type: "group", group, tracks: groupTracks });
  }
  orderedItems.sort((a, b) => {
    const posA = a.type === "track" ? a.track.position : a.group.position;
    const posB = b.type === "track" ? b.track.position : b.group.position;
    return posA - posB;
  });

  const topLevelSortableIds = orderedItems.map((item) =>
    item.type === "track" ? item.track.id : `group-${item.group.id}`
  );

  // ── Drag and drop ──

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !playlist) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    if (activeIdStr === overIdStr) return;

    // Reorder within the top-level interleaved list
    const oldIndex = topLevelSortableIds.indexOf(activeIdStr);
    const newIndex = topLevelSortableIds.indexOf(overIdStr);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove([...orderedItems], oldIndex, newIndex);

    // Reassign positions based on new order
    let newTracks = [...playlist.tracks];
    let newGroups = [...playlist.groups];
    let pos = 10;

    for (const item of reordered) {
      if (item.type === "track") {
        newTracks = newTracks.map((t) =>
          t.id === item.track.id ? { ...t, position: pos } : t
        );
        pos += 10;
      } else {
        newGroups = newGroups.map((g) =>
          g.id === item.group.id ? { ...g, position: pos } : g
        );
        // Also update positions of tracks within this group
        const groupTrackIds = item.tracks.map((t) => t.id);
        let groupPos = 10;
        newTracks = newTracks.map((t) => {
          if (groupTrackIds.includes(t.id)) {
            const updated = { ...t, group_position: groupPos };
            groupPos += 10;
            return updated;
          }
          return t;
        });
        pos += 10;
      }
    }

    setPlaylist({ ...playlist, tracks: newTracks, groups: newGroups });

    // Persist both tracks and groups
    saveTrackOrderFromTracks(newTracks);
    Promise.all(
      newGroups.map((g) =>
        fetch(`/api/playlists/${id}/groups/${g.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ position: g.position }),
        })
      )
    );
  }

  async function saveTrackOrder() {
    if (!playlist) return;
    saveTrackOrderFromTracks(playlist.tracks);
  }

  async function saveTrackOrderFromTracks(tracks: Track[]) {
    await fetch(`/api/playlists/${id}/tracks/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tracks: tracks.map((t) => ({
          id: t.id,
          position: t.position,
          group_id: t.group_id,
          group_position: t.group_position,
        })),
      }),
    });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <p className="text-zinc-400">Loading playlist...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => router.push("/dashboard")}
          className="mb-6 flex items-center gap-2 text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft size={18} />
          Back
        </button>

        {playlist && (
          <>
            {/* Header */}
            <div className="mb-8 flex items-start gap-6">
              {playlist.cover_url ? (
                <img src={playlist.cover_url} alt="" className="h-40 w-40 rounded-xl object-cover" />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-xl bg-zinc-800 text-4xl text-zinc-600">♪</div>
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-white">{playlist.name}</h1>
                {playlist.description && <p className="mt-2 text-zinc-400">{playlist.description}</p>}
                <p className="mt-2 text-sm text-zinc-500">
                  {filteredTracks.length}{activeFilters.size > 0 ? ` of ${playlist.tracks.length}` : ""} tracks
                  {groups.length > 0 && ` · ${groups.length} groups`}
                </p>
                {playlist.published_at && (
                  <p className="mt-1 text-xs text-zinc-600">
                    Last published {new Date(playlist.published_at).toLocaleDateString()}
                  </p>
                )}
                <div className="relative mt-4 inline-block" ref={publishMenuRef}>
                  <button
                    onClick={() => publishing ? null : setShowPublishMenu(!showPublishMenu)}
                    disabled={publishing}
                    className="rounded-full bg-green-500 px-6 py-2 text-sm font-semibold text-black transition hover:bg-green-400 disabled:opacity-50"
                  >
                    {publishing ? "Publishing..." : "Publish to Spotify"}
                  </button>
                  {showPublishMenu && (
                    <div className="absolute left-0 top-11 z-10 min-w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
                      <button
                        onClick={() => publishToSpotify()}
                        className="flex w-full items-center rounded px-3 py-2 text-sm text-white transition hover:bg-zinc-800"
                      >
                        {playlist.provider_playlist_id ? "Overwrite original" : "Create on Spotify"}
                      </button>
                      {showCopyInput ? (
                        <div className="mt-1 flex items-center gap-2 px-3 py-1">
                          <input
                            type="text"
                            value={copyName}
                            onChange={(e) => setCopyName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && copyName.trim() && publishToSpotify(copyName.trim())}
                            placeholder="New playlist name"
                            className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                            autoFocus
                          />
                          <button
                            onClick={() => copyName.trim() && publishToSpotify(copyName.trim())}
                            className="text-sm text-green-400 hover:text-green-300"
                          >
                            Go
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setCopyName(playlist.name + " (copy)"); setShowCopyInput(true); }}
                          className="flex w-full items-center rounded px-3 py-2 text-sm text-white transition hover:bg-zinc-800"
                        >
                          Publish as copy...
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {publishStatus && (
                  <span className={`ml-3 text-sm ${publishStatus.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                    {publishStatus}
                  </span>
                )}
              </div>
            </div>

            {/* Tag filter bar */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {visibleTags.map((tag) => (
                <div key={tag.id} className="group/tag relative flex items-center">
                  <button
                    onClick={() => toggleFilter(tag.id)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition"
                    style={{
                      backgroundColor: activeFilters.has(tag.id) ? (tag.color || "#6b7280") : "transparent",
                      border: `1px solid ${tag.color || "#6b7280"}`,
                      color: activeFilters.has(tag.id) ? "#000" : (tag.color || "#9ca3af"),
                    }}
                  >
                    {tag.name}
                  </button>
                  <button
                    onClick={() => deleteTag(tag.id)}
                    className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white group-hover/tag:flex"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {activeFilters.size > 0 && (
                <button onClick={() => setActiveFilters(new Set())} className="text-sm text-zinc-500 hover:text-white">
                  Clear filters
                </button>
              )}
              {showNewTag ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createTag()}
                    placeholder="Tag name"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                    autoFocus
                  />
                  <div className="flex gap-1">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setNewTagColor(color)}
                        className="h-5 w-5 rounded-full transition"
                        style={{ backgroundColor: color, outline: newTagColor === color ? "2px solid white" : "none", outlineOffset: "2px" }}
                      />
                    ))}
                  </div>
                  <button onClick={createTag} className="text-sm text-green-400 hover:text-green-300">Save</button>
                  <button onClick={() => setShowNewTag(false)} className="text-sm text-zinc-500 hover:text-white">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewTag(true)}
                  className="flex items-center gap-1 rounded-full border border-dashed border-zinc-700 px-3 py-1 text-sm text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-300"
                >
                  <Plus size={14} />
                  New tag
                </button>
              )}
            </div>

            {/* Group controls */}
            <div className="mb-4 flex items-center gap-2">
              {showNewGroup ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createGroup()}
                    placeholder="Group name"
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                    autoFocus
                  />
                  <button onClick={createGroup} className="text-sm text-green-400 hover:text-green-300">Create</button>
                  <button onClick={() => setShowNewGroup(false)} className="text-sm text-zinc-500 hover:text-white">Cancel</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewGroup(true)}
                  className="flex items-center gap-1 rounded border border-dashed border-zinc-700 px-3 py-1.5 text-sm text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-300"
                >
                  <FolderPlus size={14} />
                  New group
                </button>
              )}
            </div>

            {/* Track list with drag-and-drop */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={topLevelSortableIds} strategy={verticalListSortingStrategy}>
                {orderedItems.map((item, i) => {
                  if (item.type === "track") {
                    return (
                      <SortableTrackRow
                        key={item.track.id}
                        track={item.track}
                        index={i}
                        allTags={allTags}
                        groups={groups}
                        tagPopoverTrack={tagPopoverTrack}
                        setTagPopoverTrack={setTagPopoverTrack}
                        toggleTagOnTrack={toggleTagOnTrack}
                        popoverRef={popoverRef}
                        onAssignTrack={assignTrackToGroup}
                      />
                    );
                  } else {
                    return (
                      <SortableGroup
                        key={item.group.id}
                        group={item.group}
                        tracks={item.tracks}
                        allTags={allTags}
                        groups={groups}
                        tagPopoverTrack={tagPopoverTrack}
                        setTagPopoverTrack={setTagPopoverTrack}
                        toggleTagOnTrack={toggleTagOnTrack}
                        popoverRef={popoverRef}
                        onDelete={deleteGroup}
                        onAssignTrack={assignTrackToGroup}
                        playlistId={id}
                      />
                    );
                  }
                })}
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>
    </div>
  );
}
