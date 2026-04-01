"use client";

import { useState, useCallback, useRef } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  CollisionDetection,
  closestCenter,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── Data ──

interface Item {
  id: string;
  label: string;
}

const INITIAL_ITEMS: Item[] = Array.from({ length: 8 }, (_, i) => ({
  id: `item-${i + 1}`,
  label: `Track ${i + 1}`,
}));

const ROW_HEIGHT = 56;

// ── Sortable Row ──

function SortableRow({
  item,
  selected,
  onClick,
  isMultiDragActive,
  selectedIds,
}: {
  item: Item;
  selected: boolean;
  onClick: (id: string, e: React.MouseEvent) => void;
  isMultiDragActive?: boolean;
  selectedIds: Set<string>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const isPartOfMultiDrag = isMultiDragActive && selectedIds.has(item.id);
  const hidden = isDragging || isPartOfMultiDrag;

  return (
    <div
      ref={setNodeRef}
      data-track-id={item.id}
      className={`flex items-center gap-4 rounded-lg px-4 cursor-grab active:cursor-grabbing ${
        selected ? "bg-zinc-700" : "hover:bg-zinc-900"
      }`}
      style={{
        height: ROW_HEIGHT,
        overflow: "hidden",
        transform: hidden || isMultiDragActive ? undefined : CSS.Transform.toString(transform),
        transition: isMultiDragActive ? "none" : transition,
        opacity: hidden ? 0 : 1,
      }}
      onMouseDown={(e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) e.preventDefault();
      }}
      onClick={(e) => onClick(item.id, e)}
      {...attributes}
      {...listeners}
    >
      <span className="text-sm text-zinc-500 w-8 text-right">{item.label.split(" ")[1]}</span>
      <span className="text-white font-medium">{item.label}</span>
      {selected && <span className="ml-auto text-xs text-zinc-400">selected</span>}
    </div>
  );
}

// ── Page ──

export default function TestDragPage() {
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastSelectedRef = useRef<string | null>(null);

  // Multi-drag state
  const groupDragRef = useRef<string[] | null>(null);
  const [groupDragActiveIds, setGroupDragActiveIds] = useState<Set<string>>(new Set());
  const multiDragHeightRef = useRef(0);

  // Debug log
  const [log, setLog] = useState<string[]>([]);
  const addLog = (msg: string) => setLog((prev) => [...prev.slice(-19), msg]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const isMultiDragActive = groupDragActiveIds.size >= 2;

  // ── Selection ──

  function handleRowClick(id: string, e: React.MouseEvent) {
    if (e.shiftKey && lastSelectedRef.current) {
      const ids = items.map((it) => it.id);
      const lastIdx = ids.indexOf(lastSelectedRef.current);
      const thisIdx = ids.indexOf(id);
      if (lastIdx !== -1 && thisIdx !== -1) {
        const [start, end] = lastIdx < thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
        const rangeIds = ids.slice(start, end + 1);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          rangeIds.forEach((rid) => next.add(rid));
          return next;
        });
        return;
      }
    }
    if (e.ctrlKey || e.metaKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      lastSelectedRef.current = id;
    } else {
      setSelectedIds(new Set([id]));
      lastSelectedRef.current = id;
    }
  }

  // ── Collision detection: filter out non-active selected items ──

  const customCollisionDetection: CollisionDetection = useCallback(
    (args) => {
      const { droppableContainers, droppableRects, pointerCoordinates, ...rest } = args;

      const draggedSet =
        groupDragRef.current && groupDragRef.current.length >= 2
          ? new Set(groupDragRef.current.map(String))
          : null;

      const eligible = draggedSet
        ? droppableContainers.filter((c) => !draggedSet.has(String(c.id)))
        : droppableContainers;

      // During multi-drag, use pointer Y for reliable collision in both directions
      if (draggedSet && pointerCoordinates) {
        let closest: typeof eligible[0] | null = null;
        let closestDist = Infinity;
        for (const container of eligible) {
          const rect = droppableRects.get(container.id);
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

      return closestCenter({ ...rest, droppableContainers: eligible, droppableRects, pointerCoordinates });
    },
    []
  );

  // ── Drag start ──

  function handleDragStart(event: DragStartEvent) {
    const activeIdStr = String(event.active.id);
    setActiveId(activeIdStr);
    groupDragRef.current = null;
    setGroupDragActiveIds(new Set());

    if (selectedIds.has(activeIdStr) && selectedIds.size >= 2) {
      const allIds = items.map((it) => it.id);
      const indices = [...selectedIds]
        .map((sid) => allIds.indexOf(sid))
        .sort((a, b) => a - b);
      const isAdjacent = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1);

      if (isAdjacent) {
        const orderedGroupIds = indices.map((i) => allIds[i]);
        groupDragRef.current = orderedGroupIds;
        setGroupDragActiveIds(new Set(orderedGroupIds));

        let totalHeight = 0;
        for (const gid of orderedGroupIds) {
          const el = document.querySelector(`[data-track-id="${gid}"]`);
          if (el) totalHeight += el.getBoundingClientRect().height;
        }
        multiDragHeightRef.current = totalHeight;
        addLog(`Drag start: ${orderedGroupIds.map((id) => id.replace("item-", "")).join(",")} (h=${totalHeight})`);
      }
    } else {
      addLog(`Drag start: ${activeIdStr.replace("item-", "")}`);
    }
  }

  // ── Drag end ──

  function handleDragEnd(event: DragEndEvent) {
    const groupIds = groupDragRef.current;
    const prevActiveId = activeId;
    setActiveId(null);
    groupDragRef.current = null;
    setGroupDragActiveIds(new Set());
    multiDragHeightRef.current = 0;

    const { active, over } = event;
    if (!over) {
      addLog("Drag cancelled (no over)");
      return;
    }

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    if (activeIdStr === overIdStr) {
      addLog("Drag ended on self");
      return;
    }

    // ── Multi-track group drag ──
    if (groupIds && groupIds.length >= 2) {
      const activeOldIdx = items.findIndex((it) => it.id === activeIdStr);
      const overOldIdx = items.findIndex((it) => it.id === overIdStr);
      if (activeOldIdx === -1 || overOldIdx === -1) return;

      const groupSet = new Set(groupIds);
      const remaining = items.filter((it) => !groupSet.has(it.id));
      const overNewIdx = remaining.findIndex((it) => it.id === overIdStr);
      if (overNewIdx === -1) return;

      const insertIdx = activeOldIdx < overOldIdx ? overNewIdx + 1 : overNewIdx;
      const groupItems = groupIds
        .map((gid) => items.find((it) => it.id === gid))
        .filter((it): it is Item => !!it);
      const newItems = [...remaining];
      newItems.splice(insertIdx, 0, ...groupItems);

      addLog(
        `Multi-drop: [${groupIds.map((id) => id.replace("item-", "")).join(",")}] over ${overIdStr.replace("item-", "")} => ${newItems.map((it) => it.id.replace("item-", "")).join(",")}`
      );
      setItems(newItems);
      return;
    }

    // Single item reorder
    const oldIndex = items.findIndex((it) => it.id === activeIdStr);
    const newIndex = items.findIndex((it) => it.id === overIdStr);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    addLog(
      `Single drop: ${activeIdStr.replace("item-", "")} over ${overIdStr.replace("item-", "")} => ${reordered.map((it) => it.id.replace("item-", "")).join(",")}`
    );
    setItems(reordered);
  }

  const allIds = items.map((it) => it.id);

  // ── Render ──

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold text-white mb-2">Multi-Drag Test</h1>
        <p className="text-zinc-400 text-sm mb-6">
          Click to select, Shift+click for range, Ctrl/Cmd+click to toggle.
          <br />
          Test: select tracks 1-3, drag down past 4, then back up past 4 in the same motion.
        </p>

        <button
          data-testid="select-1-3"
          onClick={() => {
            setSelectedIds(new Set(["item-1", "item-2", "item-3"]));
            lastSelectedRef.current = "item-3";
          }}
          className="mb-4 rounded bg-blue-600 px-3 py-1 text-sm text-white"
        >
          Select 1-3
        </button>

        {selectedIds.size >= 2 && (
          <div className="mb-4 flex items-center gap-3 rounded-lg bg-zinc-800 px-4 py-2 text-sm text-white">
            <span>{selectedIds.size} selected</span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-zinc-400 hover:text-white"
            >
              Clear
            </button>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={customCollisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={allIds} strategy={verticalListSortingStrategy}>
            {items.map((item) => (
              <SortableRow
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                onClick={handleRowClick}
                isMultiDragActive={isMultiDragActive}
                selectedIds={selectedIds}
              />
            ))}
          </SortableContext>

          <DragOverlay dropAnimation={null}>
            {activeId && (() => {
              if (groupDragRef.current && groupDragRef.current.length >= 2) {
                const draggedItems = groupDragRef.current
                  .map((gid) => items.find((it) => it.id === gid))
                  .filter((it): it is Item => !!it);
                return (
                  <div className="rounded-lg shadow-2xl ring-1 ring-zinc-600 overflow-hidden">
                    {draggedItems.map((item, i) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 bg-zinc-800 px-4"
                        style={{ height: ROW_HEIGHT }}
                      >
                        <span className="text-sm text-zinc-500 w-8 text-right">
                          {item.label.split(" ")[1]}
                        </span>
                        <span className="text-white font-medium">{item.label}</span>
                      </div>
                    ))}
                  </div>
                );
              }

              const activeItem = items.find((it) => it.id === activeId);
              if (!activeItem) return null;
              return (
                <div className="flex items-center gap-4 rounded-lg bg-zinc-800 px-4 shadow-2xl ring-1 ring-zinc-600" style={{ height: ROW_HEIGHT }}>
                  <span className="text-sm text-zinc-500 w-8 text-right">
                    {activeItem.label.split(" ")[1]}
                  </span>
                  <span className="text-white font-medium">{activeItem.label}</span>
                </div>
              );
            })()}
          </DragOverlay>
        </DndContext>

        {/* Debug log */}
        <div className="mt-8 rounded-lg bg-zinc-900 p-4">
          <h2 className="text-sm font-semibold text-zinc-400 mb-2">Debug Log</h2>
          <div className="text-xs text-zinc-500 font-mono space-y-1 max-h-60 overflow-y-auto">
            {log.length === 0 && <p>Drag items to see events here...</p>}
            {log.map((entry, i) => (
              <p key={i}>{entry}</p>
            ))}
          </div>
          {log.length > 0 && (
            <button
              onClick={() => setLog([])}
              className="mt-2 text-xs text-zinc-600 hover:text-zinc-400"
            >
              Clear log
            </button>
          )}
        </div>

        {/* Current order display */}
        <div className="mt-4 rounded-lg bg-zinc-900 p-4">
          <h2 className="text-sm font-semibold text-zinc-400 mb-2">Current Order</h2>
          <p className="text-xs text-zinc-500 font-mono">
            {items.map((it) => it.id.replace("item-", "")).join(", ")}
          </p>
        </div>
      </div>
    </div>
  );
}
