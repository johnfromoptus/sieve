"use client";

import { useEffect, useLayoutEffect, useState, useCallback, useRef } from "react";
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
  DragMoveEvent,
  DragOverlay,
  CollisionDetection,
  DroppableContainer,
  UniqueIdentifier,
  ClientRect,
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
  color: string | null;
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

// ── Track row content (rendered both inline and in DragOverlay) ──

function TrackRowContent({
  track,
  index,
  allTags,
  groups,
  tagPopoverTrack,
  setTagPopoverTrack,
  toggleTagOnTrack,
  popoverRef,
  onAssignTrack,
  dragHandleProps,
  playlistId,
  createTagAndAssign,
  createGroupAndAssign,
  onColorChange,
  selectedTracks,
  onClearSelection,
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
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  playlistId: string;
  createTagAndAssign: (trackId: string, name: string, color: string) => Promise<void>;
  createGroupAndAssign: (trackIds: string[], name: string) => Promise<void>;
  onColorChange: (trackId: string, color: string | null) => void;
  selectedTracks: Set<string>;
  onClearSelection: () => void;
}) {
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
  const [newGroupName, setNewGroupName] = useState("");
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showColorPicker && colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
      if (showGroupMenu && groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) {
        setShowGroupMenu(false);
        setShowNewGroupInput(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showColorPicker, showGroupMenu]);

  async function handleSaveNewTag() {
    if (!newTagName.trim()) return;
    const name = newTagName.trim();
    setNewTagName("");
    await createTagAndAssign(track.id, name, newTagColor);
    setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
  }

  async function handleCreateGroup() {
    if (!newGroupName.trim()) return;
    const name = newGroupName.trim();
    const tracksToMove = selectedTracks.has(track.id) && selectedTracks.size > 1
      ? [...selectedTracks]
      : [track.id];
    setNewGroupName("");
    setShowNewGroupInput(false);
    setShowGroupMenu(false);
    await createGroupAndAssign(tracksToMove, name);
    onClearSelection();
  }

  return (
    <>
      <span className="w-8 text-right text-sm text-zinc-500">{index + 1}</span>

      {/* Colour bar + album art */}
      <div className="relative flex flex-shrink-0 items-center gap-1.5" ref={colorPickerRef}>
        {/* Colour bar — wider hit area wrapping a thicker visual bar */}
        <div
          className="flex h-10 w-4 flex-shrink-0 cursor-pointer items-center justify-center"
          onClick={(e) => { e.stopPropagation(); setShowColorPicker(!showColorPicker); }}
        >
          <div
            className={`h-10 w-1.5 rounded-full transition-all ${
              track.color
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 bg-zinc-600"
            }`}
            style={track.color ? { backgroundColor: track.color } : undefined}
          />
        </div>
        {track.album_art_url ? (
          <img src={track.album_art_url} alt="" className="h-10 w-10 rounded object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-zinc-600">♪</div>
        )}
        {showColorPicker && (
          <div className="absolute left-0 top-12 z-20 flex flex-col gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
            <div className="flex gap-1.5">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={(e) => { e.stopPropagation(); onColorChange(track.id, c); setShowColorPicker(false); }}
                  className="h-5 w-5 flex-shrink-0 rounded-full transition hover:scale-110"
                  style={{ backgroundColor: c, outline: track.color === c ? "2px solid white" : "none", outlineOffset: "2px" }}
                />
              ))}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onColorChange(track.id, null); setShowColorPicker(false); }}
              className="mt-1 rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              Clear
            </button>
          </div>
        )}
      </div>

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
            onClick={(e) => { e.stopPropagation(); setShowGroupMenu(false); setTagPopoverTrack(tagPopoverTrack === track.id ? null : track.id); }}
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
              {/* Inline new tag form */}
              <div className="mt-2 border-t border-zinc-700 pt-2">
                <p className="mb-1 px-2 text-xs font-medium text-zinc-500">New tag</p>
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveNewTag()}
                  placeholder="Tag name"
                  className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                />
                <div className="mt-1.5 flex gap-1 px-0.5">
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className="h-4 w-4 rounded-full transition"
                      style={{ backgroundColor: c, outline: newTagColor === c ? "2px solid white" : "none", outlineOffset: "1px" }}
                    />
                  ))}
                </div>
                <button
                  onClick={handleSaveNewTag}
                  className="mt-2 w-full rounded bg-zinc-700 px-2 py-1 text-xs text-white transition hover:bg-zinc-600"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Move to group */}
      <div className="relative" ref={groupMenuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setTagPopoverTrack(null); setShowGroupMenu(!showGroupMenu); }}
          className="rounded p-1 text-zinc-600 opacity-0 transition hover:bg-zinc-800 hover:text-zinc-300 group-hover:opacity-100"
        >
          <FolderPlus size={14} />
        </button>
        {showGroupMenu && (
          <div className="absolute right-0 top-8 z-10 min-w-40 rounded-lg border border-zinc-700 bg-zinc-900 p-2 shadow-xl">
            <div className="mb-1 px-2 text-xs font-medium text-zinc-500">Move to group</div>
            {track.group_id && (
              <button
                onClick={() => {
                  const tracksToMove = selectedTracks.has(track.id) && selectedTracks.size > 1
                    ? [...selectedTracks] : [track.id];
                  tracksToMove.forEach((tid) => onAssignTrack(tid, null));
                  setShowGroupMenu(false);
                  onClearSelection();
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800"
              >
                Remove from group
              </button>
            )}
            {groups.filter((g) => g.id !== track.group_id).map((group) => (
              <button
                key={group.id}
                onClick={() => {
                  const tracksToMove = selectedTracks.has(track.id) && selectedTracks.size > 1
                    ? [...selectedTracks] : [track.id];
                  tracksToMove.forEach((tid) => onAssignTrack(tid, group.id));
                  setShowGroupMenu(false);
                  onClearSelection();
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-white transition hover:bg-zinc-800"
              >
                {group.name}
              </button>
            ))}
            {/* New group inline */}
            <div className="mt-1 border-t border-zinc-700 pt-1">
              {showNewGroupInput ? (
                <div className="flex items-center gap-1 px-1">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
                    placeholder="Group name"
                    className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
                    autoFocus
                  />
                  <button onClick={handleCreateGroup} className="text-xs text-green-400 hover:text-green-300">OK</button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowNewGroupInput(true); }}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-zinc-800"
                >
                  <Plus size={12} />
                  New group...
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {track.duration_ms && (
        <span className="text-sm text-zinc-500">{formatDuration(track.duration_ms)}</span>
      )}
      <button
        {...dragHandleProps}
        onClick={(e) => e.stopPropagation()}
        className="cursor-grab text-zinc-600 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
    </>
  );
}

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
  playlistId,
  createTagAndAssign,
  createGroupAndAssign,
  onColorChange,
  selected,
  onRowClick,
  selectedTracks,
  onClearSelection,
  isMultiDragActive,
  multiDragTransformY,
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
  playlistId: string;
  createTagAndAssign: (trackId: string, name: string, color: string) => Promise<void>;
  createGroupAndAssign: (trackIds: string[], name: string) => Promise<void>;
  onColorChange: (trackId: string, color: string | null) => void;
  selected: boolean;
  onRowClick: (trackId: string, e: React.MouseEvent) => void;
  selectedTracks: Set<string>;
  onClearSelection: () => void;
  isMultiDragActive?: boolean;
  multiDragTransformY?: number;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id, data: { type: "track" } });

  // During multi-drag: hide selected tracks, use custom block-aware displacement
  const isPartOfMultiDrag = isMultiDragActive && selectedTracks.has(track.id);
  const hidden = isDragging || isPartOfMultiDrag;

  return (
    <div
      ref={setNodeRef}
      data-track-id={track.id}
      className={`group flex items-center gap-4 rounded-lg px-4 py-3 transition ${selected ? "bg-zinc-700 hover:bg-zinc-700" : "hover:bg-zinc-900"}`}
      style={{
        transform: hidden
          ? undefined
          : isMultiDragActive
            ? (multiDragTransformY ? `translateY(${multiDragTransformY}px)` : undefined)
            : CSS.Transform.toString(transform),
        transition: isMultiDragActive ? "transform 200ms ease" : transition,
        opacity: hidden ? 0 : 1,
      }}
      onMouseDown={(e) => { if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault(); }}
      onClick={(e) => onRowClick(track.id, e)}
    >
      <TrackRowContent
        track={track}
        index={index}
        allTags={allTags}
        groups={groups}
        tagPopoverTrack={tagPopoverTrack}
        setTagPopoverTrack={setTagPopoverTrack}
        toggleTagOnTrack={toggleTagOnTrack}
        popoverRef={popoverRef}
        onAssignTrack={onAssignTrack}
        dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
        playlistId={playlistId}
        createTagAndAssign={createTagAndAssign}
        createGroupAndAssign={createGroupAndAssign}
        onColorChange={onColorChange}
        selectedTracks={selectedTracks}
        onClearSelection={onClearSelection}
      />
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
  createTagAndAssign,
  createGroupAndAssign,
  onColorChange,
  selectedTracks,
  onRowClick,
  onClearSelection,
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
  createTagAndAssign: (trackId: string, name: string, color: string) => Promise<void>;
  createGroupAndAssign: (trackIds: string[], name: string) => Promise<void>;
  onColorChange: (trackId: string, color: string | null) => void;
  selectedTracks: Set<string>;
  onRowClick: (trackId: string, e: React.MouseEvent) => void;
  onClearSelection: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `group-${group.id}`, data: { type: "group", groupId: group.id } });

  return (
    <div
      ref={setNodeRef}
      className="mb-2 rounded-xl border border-zinc-800"
      style={{
        transform: isDragging ? undefined : CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
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
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-zinc-600 transition hover:text-zinc-400 active:cursor-grabbing"
        >
          <GripVertical size={16} />
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
                playlistId={playlistId}
                createTagAndAssign={createTagAndAssign}
                createGroupAndAssign={createGroupAndAssign}
                onColorChange={onColorChange}
                selected={selectedTracks.has(track.id)}
                onRowClick={onRowClick}
                selectedTracks={selectedTracks}
                onClearSelection={onClearSelection}
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
  const savedScrollY = useRef<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [showPublishMenu, setShowPublishMenu] = useState(false);
  const [tagContextMenu, setTagContextMenu] = useState<{ tagId: string; x: number; y: number } | null>(null);
  const tagContextMenuRef = useRef<HTMLDivElement>(null);
  const [copyName, setCopyName] = useState("");
  const [showCopyInput, setShowCopyInput] = useState(false);
  const publishMenuRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const lastPointerYRef = useRef(0);

  // Multi-drag displacement preview
  const [multiDragTransforms, setMultiDragTransforms] = useState<Map<string, number>>(new Map());
  const multiDragMeasurementsRef = useRef<{
    blockOriginalTop: number;
    blockHeight: number;
    firstSongHeight: number;
    lastSongHeight: number;
    grabOffsetY: number; // distance from block top to grabbed item's top
    items: { id: string; originalCenterY: number; isBelow: boolean }[];
  } | null>(null);

  // Multi-select state
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const lastSelectedRef = useRef<string | null>(null);
  const trackListRef = useRef<HTMLDivElement>(null);

  // Multi-drag state
  const groupDragRef = useRef<string[] | null>(null); // ordered IDs being dragged as a group
  const [groupDragActiveIds, setGroupDragActiveIds] = useState<Set<string>>(new Set());

  // Row context menu
  const [rowContextMenu, setRowContextMenu] = useState<{ trackId: string; x: number; y: number } | null>(null);
  const rowContextMenuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (tagContextMenu && tagContextMenuRef.current && !tagContextMenuRef.current.contains(e.target as Node)) {
        setTagContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [tagContextMenu]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rowContextMenu && rowContextMenuRef.current && !rowContextMenuRef.current.contains(e.target as Node)) {
        setRowContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [rowContextMenu]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (selectedTracks.size > 0 && trackListRef.current && !trackListRef.current.contains(e.target as Node)) {
        setSelectedTracks(new Set());
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedTracks]);

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
    savedScrollY.current = window.scrollY;
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
      return next;
    });
  }

  useLayoutEffect(() => {
    if (savedScrollY.current !== null) {
      window.scrollTo({ top: savedScrollY.current });
      savedScrollY.current = null;
    }
  }, [activeFilters]);

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
    await saveTrackOrder();
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

  // ── Colour operations ──

  function handleColorChange(trackId: string, color: string | null) {
    setPlaylist((prev) => {
      if (!prev) return prev;
      return { ...prev, tracks: prev.tracks.map((t) => t.id === trackId ? { ...t, color } : t) };
    });
    fetch(`/api/playlists/${id}/tracks/${trackId}/color`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
  }

  // ── Inline tag creation ──

  async function createTagAndAssign(trackId: string, name: string, color: string) {
    // Optimistically add the tag and apply it immediately
    const tempId = crypto.randomUUID();
    const optimisticTag: TagData = { id: tempId, name, color };
    setAllTags((prev) => [...prev, optimisticTag]);
    setPlaylist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, tags: [...t.tags, optimisticTag] } : t
        ),
      };
    });
    // Persist tag
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) {
      // Roll back
      setAllTags((prev) => prev.filter((t) => t.id !== tempId));
      setPlaylist((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tracks: prev.tracks.map((t) =>
            t.id === trackId ? { ...t, tags: t.tags.filter((tg) => tg.id !== tempId) } : t
          ),
        };
      });
      return;
    }
    const realTag: TagData = await res.json();
    // Swap temp ID for real ID
    setAllTags((prev) => prev.map((t) => t.id === tempId ? realTag : t));
    setPlaylist((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tracks: prev.tracks.map((t) =>
          t.id === trackId ? { ...t, tags: t.tags.map((tg) => tg.id === tempId ? realTag : tg) } : t
        ),
      };
    });
    // Persist track-tag association with real ID
    await fetch(`/api/playlists/${id}/tracks/${trackId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tagId: realTag.id }),
    });
  }

  // ── Inline group creation ──

  async function createGroupAndAssign(trackIds: string[], name: string) {
    if (!playlist) return;
    const res = await fetch(`/api/playlists/${id}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    const newGroup: Group = await res.json();
    setPlaylist((prev) => prev ? { ...prev, groups: [...prev.groups, newGroup] } : prev);
    for (const trackId of trackIds) {
      await assignTrackToGroup(trackId, newGroup.id);
    }
  }

  // ── Multi-select ──

  function handleRowClick(trackId: string, e: React.MouseEvent) {
    if (e.shiftKey && lastSelectedRef.current && playlist) {
      // Range select
      const allTrackIds = orderedItems.flatMap((item) =>
        item.type === "track" ? [item.track.id] : item.tracks.map((t) => t.id)
      );
      const lastIdx = allTrackIds.indexOf(lastSelectedRef.current);
      const thisIdx = allTrackIds.indexOf(trackId);
      if (lastIdx !== -1 && thisIdx !== -1) {
        const [start, end] = lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
        const rangeIds = allTrackIds.slice(start, end + 1);
        setSelectedTracks((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((tid) => next.add(tid));
          return next;
        });
        return;
      }
    }
    if (e.ctrlKey || e.metaKey) {
      setSelectedTracks((prev) => {
        const next = new Set(prev);
        if (next.has(trackId)) next.delete(trackId); else next.add(trackId);
        return next;
      });
      lastSelectedRef.current = trackId;
    } else {
      setSelectedTracks(new Set([trackId]));
      lastSelectedRef.current = trackId;
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

  const isMultiDragActive = groupDragActiveIds.size >= 2;

  // ── Drag and drop ──

  // Custom collision detection:
  // - Group headers: hit target is top 48px only
  // - Multi-drag: use pointer Y (not collision rect) to find the closest eligible target,
  //   bypassing issues with dnd-kit's rect-based calculation and the wrong-sized active rect.
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const { active, droppableContainers, droppableRects, pointerCoordinates, ...rest } = args;

    // Exclude the invisible dragged tracks so 'over' never resolves to one of them
    const draggedSet = groupDragRef.current && groupDragRef.current.length >= 2
      ? new Set(groupDragRef.current.map(String))
      : null;
    const eligibleContainers = draggedSet
      ? droppableContainers.filter((c) => !draggedSet.has(String(c.id)))
      : droppableContainers;

    // Track pointer for multi-drag drop direction
    if (pointerCoordinates) lastPointerYRef.current = pointerCoordinates.y;

    // Build modified rects (group headers shrunk to 48px)
    const modifiedContainers: DroppableContainer[] = [];
    const modifiedRects: Map<UniqueIdentifier, ClientRect> = new Map(droppableRects);
    for (const container of eligibleContainers) {
      if (container.data.current?.type === "group") {
        const rect = droppableRects.get(container.id);
        if (rect) {
          modifiedRects.set(container.id, { ...rect, height: 48, bottom: rect.top + 48 });
        }
      }
      modifiedContainers.push(container);
    }

    // During multi-drag, use pointer Y directly for reliable collision in both directions
    if (draggedSet && pointerCoordinates) {
      let closest: DroppableContainer | null = null;
      let closestDist = Infinity;
      for (const container of modifiedContainers) {
        const rect = modifiedRects.get(container.id);
        if (!rect) continue;
        const centerY = rect.top + rect.height / 2;
        const dist = Math.abs(pointerCoordinates.y - centerY);
        if (dist < closestDist) {
          closestDist = dist;
          closest = container;
        }
      }
      return closest ? [{ id: closest.id }] : [];
    }

    if (active.data.current?.type !== "track") {
      return closestCenter({ ...args, droppableContainers: eligibleContainers });
    }
    return closestCenter({ active, droppableContainers: modifiedContainers, droppableRects: modifiedRects, pointerCoordinates, ...rest });
  }, []);

  function handleDragStart(event: DragStartEvent) {
    const activeIdStr = String(event.active.id);
    setActiveId(activeIdStr);
    groupDragRef.current = null;
    setGroupDragActiveIds(new Set());

    // Check for adjacent multi-track group drag
    if (selectedTracks.has(activeIdStr) && selectedTracks.size >= 2) {
      // Only support multi-drag for top-level ungrouped tracks
      const topLevelTrackIds = orderedItems
        .filter((item): item is { type: "track"; track: Track } => item.type === "track")
        .map((item) => item.track.id);

      const allSelectedAreTopLevel = [...selectedTracks].every((sid) =>
        topLevelTrackIds.includes(sid)
      );
      if (allSelectedAreTopLevel) {
        const indices = [...selectedTracks]
          .map((sid) => topLevelTrackIds.indexOf(sid))
          .sort((a, b) => a - b);
        const isAdjacent = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);
        if (isAdjacent) {
          const orderedGroupIds = indices.map((i) => topLevelTrackIds[i]);
          groupDragRef.current = orderedGroupIds;
          setGroupDragActiveIds(new Set(orderedGroupIds));

          // Measure block and remaining items for displacement preview
          const groupSet = new Set(orderedGroupIds);
          const blockEls = orderedGroupIds
            .map(gid => document.querySelector(`[data-track-id="${gid}"]`))
            .filter(Boolean) as Element[];
          if (blockEls.length > 0) {
            const firstRect = blockEls[0].getBoundingClientRect();
            const lastRect = blockEls[blockEls.length - 1].getBoundingClientRect();
            const blockTop = firstRect.top;
            const blockBottom = lastRect.bottom;
            const blockHeight = blockBottom - blockTop;
            const firstSongHeight = firstRect.height;
            const lastSongHeight = lastRect.height;

            // How far the grabbed handle is from the block top
            const activeEl = document.querySelector(`[data-track-id="${activeIdStr}"]`);
            const grabOffsetY = activeEl ? activeEl.getBoundingClientRect().top - blockTop : 0;

            const remainingItems: { id: string; originalCenterY: number; isBelow: boolean }[] = [];
            for (const item of orderedItems) {
              const itemId = item.type === "track" ? item.track.id : `group-${item.group.id}`;
              if (item.type === "track" && groupSet.has(item.track.id)) continue;
              const el = document.querySelector(`[data-track-id="${itemId}"]`)
                ?? document.querySelector(`[data-group-id="${item.type === "group" ? item.group.id : ""}"]`);
              if (!el) continue;
              const rect = el.getBoundingClientRect();
              remainingItems.push({
                id: itemId,
                originalCenterY: rect.top + rect.height / 2,
                isBelow: rect.top >= blockBottom - 1,
              });
            }
            multiDragMeasurementsRef.current = { blockOriginalTop: blockTop, blockHeight, firstSongHeight, lastSongHeight, grabOffsetY, items: remainingItems };
          }
        }
      }
    }
  }

  function handleDragMove(event: DragMoveEvent) {
    const measurements = multiDragMeasurementsRef.current;
    if (!measurements) return;

    const { blockOriginalTop, blockHeight, items } = measurements;
    const blockVirtualTop = blockOriginalTop + event.delta.y;
    const blockVirtualBottom = blockVirtualTop + blockHeight;

    const transforms = new Map<string, number>();
    for (const item of items) {
      if (item.isBelow) {
        // Item was below the block: displace UP when block's bottom edge passes item's center
        if (blockVirtualBottom > item.originalCenterY) {
          transforms.set(item.id, -blockHeight);
        }
      } else {
        // Item was above the block: displace DOWN when block's top edge passes item's center
        if (blockVirtualTop < item.originalCenterY) {
          transforms.set(item.id, blockHeight);
        }
      }
    }
    setMultiDragTransforms(transforms);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const groupIds = groupDragRef.current;
    groupDragRef.current = null;
    setGroupDragActiveIds(new Set());
    multiDragMeasurementsRef.current = null;
    setMultiDragTransforms(new Map());

    const { active, over } = event;
    if (!over || !playlist) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    if (activeIdStr === overIdStr) return;

    // Check if dragging a track onto a group header
    if (active.data.current?.type === "track" && over.data.current?.type === "group") {
      const groupId = over.data.current.groupId as string;
      assignTrackToGroup(activeIdStr, groupId);
      return;
    }

    // ── Multi-track group drag ──
    if (groupIds && groupIds.length >= 2) {
      const activeOldIdx = orderedItems.findIndex(
        (item) => item.type === "track" && item.track.id === activeIdStr
      );
      const overOldIdx = orderedItems.findIndex(
        (item) => (item.type === "track" ? item.track.id === overIdStr : `group-${item.group.id}` === overIdStr)
      );
      if (activeOldIdx === -1 || overOldIdx === -1) return;

      const groupItemSet = new Set(groupIds);
      const remaining = orderedItems.filter(
        (item) => !(item.type === "track" && groupItemSet.has(item.track.id))
      );
      const overNewIdx = remaining.findIndex(
        (item) => (item.type === "track" ? item.track.id === overIdStr : `group-${item.group.id}` === overIdStr)
      );
      if (overNewIdx === -1) return;

      // Use pointer position relative to the over item to determine insert direction.
      // Original logic (activeOldIdx < overOldIdx) uses starting positions which break
      // when the user reverses drag direction mid-drag.
      const overRect = over.rect;
      const pointerAboveOverCenter = overRect
        ? lastPointerYRef.current < overRect.top + overRect.height / 2
        : activeOldIdx < overOldIdx;
      const insertIdx = pointerAboveOverCenter ? overNewIdx : overNewIdx + 1;
      const groupItems = groupIds
        .map((gid) => orderedItems.find((item) => item.type === "track" && item.track.id === gid))
        .filter((item): item is { type: "track"; track: Track } => !!item);
      const newOrdered = [...remaining];
      newOrdered.splice(insertIdx, 0, ...groupItems);

      let newTracks = [...playlist.tracks];
      let newGroups = [...playlist.groups];
      let pos = 10;
      for (const item of newOrdered) {
        if (item.type === "track") {
          newTracks = newTracks.map((t) => t.id === item.track.id ? { ...t, position: pos } : t);
          pos += 10;
        } else {
          newGroups = newGroups.map((g) => g.id === item.group.id ? { ...g, position: pos } : g);
          pos += 10;
        }
      }
      setPlaylist({ ...playlist, tracks: newTracks, groups: newGroups });
      saveTrackOrderFromTracks(newTracks);
      return;
    }

    // Reorder within the top-level interleaved list
    const oldIndex = topLevelSortableIds.indexOf(activeIdStr);
    const newIndex = topLevelSortableIds.indexOf(overIdStr);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove([...orderedItems], oldIndex, newIndex);

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
                <button
                  key={tag.id}
                  onClick={() => toggleFilter(tag.id)}
                  onContextMenu={(e) => { e.preventDefault(); setTagContextMenu({ tagId: tag.id, x: e.clientX, y: e.clientY }); }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition"
                  style={{
                    backgroundColor: activeFilters.has(tag.id) ? (tag.color || "#6b7280") : "transparent",
                    border: `1px solid ${tag.color || "#6b7280"}`,
                    color: activeFilters.has(tag.id) ? "#000" : (tag.color || "#9ca3af"),
                  }}
                >
                  {tag.name}
                </button>
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
                  onClick={() => { setNewTagColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]); setShowNewTag(true); }}
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
            <div ref={trackListRef}>
            <DndContext
              sensors={sensors}
              collisionDetection={customCollisionDetection}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
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
                        playlistId={id}
                        createTagAndAssign={createTagAndAssign}
                        createGroupAndAssign={createGroupAndAssign}
                        onColorChange={handleColorChange}
                        selected={selectedTracks.has(item.track.id)}
                        onRowClick={handleRowClick}
                        selectedTracks={selectedTracks}
                        onClearSelection={() => setSelectedTracks(new Set())}
                        isMultiDragActive={isMultiDragActive}
                        multiDragTransformY={multiDragTransforms.get(item.track.id)}
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
                        createTagAndAssign={createTagAndAssign}
                        createGroupAndAssign={createGroupAndAssign}
                        onColorChange={handleColorChange}
                        selectedTracks={selectedTracks}
                        onRowClick={handleRowClick}
                        onClearSelection={() => setSelectedTracks(new Set())}
                      />
                    );
                  }
                })}
              </SortableContext>

              <DragOverlay dropAnimation={null}>
                {activeId && (() => {
                  // Multi-track group drag overlay
                  if (groupDragRef.current && groupDragRef.current.length >= 2) {
                    const draggedTracks = groupDragRef.current
                      .map((gid) => orderedItems.find((item) => item.type === "track" && item.track.id === gid))
                      .filter((item): item is { type: "track"; track: Track } => !!item)
                      .map((item) => item.track);
                    // Shift overlay so the grabbed item stays under the cursor, not the first item
                    const grabOffset = multiDragMeasurementsRef.current?.grabOffsetY ?? 0;
                    return (
                      <div className="rounded-lg shadow-2xl ring-1 ring-zinc-600 overflow-hidden" style={{ marginTop: -grabOffset }}>
                        {draggedTracks.map((track, i) => (
                          <div
                            key={track.id}
                            className="flex items-center gap-4 bg-zinc-800 px-4 py-3"
                            style={{ opacity: 1 - i * (0.15 / draggedTracks.length) }}
                          >
                            <span className="w-8 text-right text-sm text-zinc-500">{i + 1}</span>
                            {track.album_art_url
                              ? <img src={track.album_art_url} alt="" className="h-10 w-10 rounded object-cover" />
                              : <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-700 text-zinc-500">♪</div>
                            }
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium text-white">{track.title || "Unknown"}</p>
                              <p className="truncate text-sm text-zinc-400">{track.artist || "Unknown"}</p>
                            </div>
                            {track.duration_ms && <span className="text-sm text-zinc-500">{formatDuration(track.duration_ms)}</span>}
                          </div>
                        ))}
                      </div>
                    );
                  }

                  const activeItem = orderedItems.find((item) =>
                    item.type === "track" ? item.track.id === activeId : `group-${item.group.id}` === activeId
                  );
                  if (!activeItem) return null;

                  if (activeItem.type === "track") {
                    const idx = orderedItems.indexOf(activeItem);
                    return (
                      <div className="group flex items-center gap-4 rounded-lg bg-zinc-900 px-4 py-3 shadow-2xl ring-1 ring-zinc-700">
                        <TrackRowContent
                          track={activeItem.track}
                          index={idx}
                          allTags={allTags}
                          groups={groups}
                          tagPopoverTrack={null}
                          setTagPopoverTrack={() => {}}
                          toggleTagOnTrack={() => {}}
                          popoverRef={{ current: null }}
                          onAssignTrack={() => {}}
                          dragHandleProps={{ className: "cursor-grabbing text-zinc-400" } as React.HTMLAttributes<HTMLButtonElement>}
                          playlistId={id}
                          createTagAndAssign={async () => {}}
                          createGroupAndAssign={async () => {}}
                          onColorChange={() => {}}
                          selectedTracks={new Set()}
                          onClearSelection={() => {}}
                        />
                      </div>
                    );
                  }

                  return (
                    <div className="mb-2 rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl">
                      <div className="flex items-center gap-3 px-4 py-3">
                        <button className="text-zinc-400">
                          <ChevronDown size={16} />
                        </button>
                        <span className="text-sm font-semibold" style={{ color: activeItem.group.color || "#fff" }}>
                          {activeItem.group.name}
                        </span>
                        <span className="text-xs text-zinc-500">{activeItem.tracks.length} tracks</span>
                        <div className="flex-1" />
                        <button className="cursor-grabbing text-zinc-400">
                          <GripVertical size={16} />
                        </button>
                      </div>
                      <div className="border-t border-zinc-800">
                        {activeItem.tracks.map((track, i) => (
                          <div key={track.id} className="flex items-center gap-4 px-4 py-3">
                            <span className="w-8 text-right text-sm text-zinc-500">{i + 1}</span>
                            {track.album_art_url
                              ? <img src={track.album_art_url} alt="" className="h-10 w-10 rounded object-cover" />
                              : <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-zinc-600">♪</div>
                            }
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium text-white">{track.title || "Unknown"}</p>
                              <p className="truncate text-sm text-zinc-400">{track.artist || "Unknown"}</p>
                            </div>
                            {track.duration_ms && <span className="text-sm text-zinc-500">{formatDuration(track.duration_ms)}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </DragOverlay>
            </DndContext>
            </div>
          </>
        )}
      </div>

      {tagContextMenu && (
        <div
          ref={tagContextMenuRef}
          className="fixed z-50 min-w-36 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl"
          style={{ top: tagContextMenu.y, left: tagContextMenu.x }}
        >
          <button
            onClick={() => { deleteTag(tagContextMenu.tagId); setTagContextMenu(null); }}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-red-400 transition hover:bg-zinc-800"
          >
            <Trash2 size={14} />
            Delete tag
          </button>
        </div>
      )}

      {/* Row context menu */}
      {rowContextMenu && (
        <div
          ref={rowContextMenuRef}
          className="fixed z-50 min-w-40 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl"
          style={{ top: rowContextMenu.y, left: rowContextMenu.x }}
        >
          <button
            onClick={() => { setTagPopoverTrack(rowContextMenu.trackId); setRowContextMenu(null); }}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-white transition hover:bg-zinc-800"
          >
            <Tag size={14} />
            Assign tag
          </button>
          <button
            onClick={() => { setRowContextMenu(null); }}
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-white transition hover:bg-zinc-800"
          >
            <FolderPlus size={14} />
            Add to group
          </button>
        </div>
      )}

      {/* Floating selection bar */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 rounded-full bg-zinc-800 px-6 py-3 shadow-2xl ring-1 ring-zinc-700 transition-all duration-200 ${selectedTracks.size >= 2 ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"}`}
      >
        <span className="text-sm font-medium text-white">{selectedTracks.size} tracks selected</span>
        <button
          onClick={() => setSelectedTracks(new Set())}
          className="rounded-full p-1 text-zinc-400 transition hover:bg-zinc-700 hover:text-white"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
