/**
 * Where things sit on the desktop.
 *
 * One system owns the position of every icon and widget, because they share a
 * surface and therefore have to share collision rules. Three sources of truth,
 * in priority order:
 *
 *   1. a position the visitor dragged  → localStorage, wins over everything;
 *   2. an explicit `x`/`y` in the content file → an advanced override, so the
 *      Studio never has to ask anyone to type coordinates;
 *   3. the generated scatter → deterministic, seeded by the item id.
 *
 * The scatter is deliberately *not* random-per-load. It is a seeded layout, so
 * the desktop looks the same every visit (curated, not chaotic) while still
 * reading as hand-placed rather than grid-locked. Items are banded into a left
 * and a right column with jitter, which keeps the middle of the screen clear
 * for windows — the thing people actually came to look at.
 *
 * Coordinates are percentages of the icon area, so the layout survives any
 * viewport without re-running.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { Zone } from '@/types/content';
import { readStore, storageKeys, writeStore } from '@/lib/storage';
import { seededRandom } from '@/lib/utils';
import { useOs } from '@/state/os';

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutSubject {
  id: string;
  zone?: Zone;
  x?: number;
  y?: number;
}

type LayoutMap = Record<string, LayoutPoint>;

/** Items per column before the scatter starts a second column inward. */
const PER_COLUMN = 6;
/** Vertical band the scatter uses, leaving room for the menu bar and dock. */
const Y_TOP = 11;
const Y_SPAN = 76;
/** A pointer that moves less than this is a click, not a drag. */
const DRAG_THRESHOLD_PX = 4;

/** Keeps a percentage on the surface by wrapping it, never by clamping it. */
function wrap(value: number): number {
  return ((value % 100) + 100) % 100;
}

/**
 * Resolves 'any' to a real side. Alternating by index spreads unassigned items
 * evenly instead of piling them all on the left.
 */
function resolveZone(zone: Zone | undefined, index: number): 'left' | 'right' {
  if (zone === 'left' || zone === 'right') return zone;
  return index % 2 === 0 ? 'left' : 'right';
}

function scatter(subjects: LayoutSubject[]): LayoutMap {
  const columns: Record<'left' | 'right', LayoutSubject[]> = { left: [], right: [] };
  subjects.forEach((subject, index) => {
    columns[resolveZone(subject.zone, index)].push(subject);
  });

  const map: LayoutMap = {};

  (['left', 'right'] as const).forEach((side) => {
    const list = columns[side];
    list.forEach((subject, i) => {
      const rand = seededRandom(`${subject.id}:${side}`);
      const col = Math.floor(i / PER_COLUMN);
      const row = i % PER_COLUMN;
      // How many items actually land in this column — a short final column
      // spreads over the full height instead of bunching at the top.
      const rows = Math.min(PER_COLUMN, list.length - col * PER_COLUMN);

      const y = Y_TOP + (Y_SPAN / rows) * (row + 0.5) + (rand() * 5 - 2.5);
      const baseX = side === 'left' ? 7 + col * 9 : 93 - col * 9;
      const x = baseX + (rand() * 5 - 2.5);

      map[subject.id] = { x: wrap(x), y: wrap(y) };
    });
  });

  return map;
}

export interface DesktopLayout {
  /** Final resolved position for every subject, as percentages. */
  positions: LayoutMap;
  /** id currently being dragged, for styling. */
  dragging: string | null;
  /** id that just crossed an edge, for the wrap flash. */
  wrapped: string | null;
  /** Attach to `onPointerDown` on a draggable element. */
  startDrag: (id: string, event: PointerEvent<HTMLElement>) => void;
  /**
   * True if the last pointer interaction was a drag rather than a click. Call
   * it from `onClick` so dropping an icon never also opens it.
   */
  didDrag: () => boolean;
}

export function useDesktopLayout(
  subjects: LayoutSubject[],
  containerRef: RefObject<HTMLElement | null>,
): DesktopLayout {
  const desktopEpoch = useOs((state) => state.desktopEpoch);

  const [saved, setSaved] = useState<LayoutMap>(() => readStore<LayoutMap>(storageKeys.layout, {}));
  const [live, setLive] = useState<{ id: string; point: LayoutPoint } | null>(null);
  const [wrapped, setWrapped] = useState<string | null>(null);

  // "Reset Desktop" wipes storage; drop the in-memory copy to match.
  useEffect(() => {
    setSaved(readStore<LayoutMap>(storageKeys.layout, {}));
  }, [desktopEpoch]);

  const generated = useMemo(() => scatter(subjects), [subjects]);

  const positions = useMemo(() => {
    const out: LayoutMap = {};
    subjects.forEach((subject) => {
      const fallback = generated[subject.id] ?? { x: 50, y: 50 };
      const authored =
        subject.x !== undefined && subject.y !== undefined
          ? { x: subject.x, y: subject.y }
          : undefined;
      out[subject.id] = saved[subject.id] ?? authored ?? fallback;
    });
    if (live && out[live.id]) out[live.id] = live.point;
    return out;
  }, [subjects, generated, saved, live]);

  const dragState = useRef<{
    id: string;
    pointerId: number;
    element: HTMLElement;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const draggedRef = useRef(false);

  const startDrag = useCallback(
    (id: string, event: PointerEvent<HTMLElement>) => {
      // Left button / touch / pen only — right-click must stay a context menu.
      if (event.button !== 0) return;
      const container = containerRef.current;
      if (!container) return;

      const element = event.currentTarget;
      element.setPointerCapture(event.pointerId);
      draggedRef.current = false;
      dragState.current = {
        id,
        pointerId: event.pointerId,
        element,
        originX: event.clientX,
        originY: event.clientY,
        moved: false,
      };
    },
    [containerRef],
  );

  // Move/up live on the window rather than on each element: pointer capture
  // keeps the events coming even when the cursor outruns a small icon.
  useEffect(() => {
    function onMove(event: globalThis.PointerEvent) {
      const state = dragState.current;
      const container = containerRef.current;
      if (!state || !container || event.pointerId !== state.pointerId) return;

      const dx = event.clientX - state.originX;
      const dy = event.clientY - state.originY;
      if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      state.moved = true;
      draggedRef.current = true;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Wrap rather than clamp: dragged off one edge, an icon reappears on the
      // opposite one. There is no wall to hit.
      const point = {
        x: wrap(((event.clientX - rect.left) / rect.width) * 100),
        y: wrap(((event.clientY - rect.top) / rect.height) * 100),
      };
      setLive({ id: state.id, point });
    }

    function onUp(event: globalThis.PointerEvent) {
      const state = dragState.current;
      if (!state || event.pointerId !== state.pointerId) return;
      dragState.current = null;

      try {
        state.element.releasePointerCapture(event.pointerId);
      } catch {
        /* the element may already be gone */
      }

      if (!state.moved) {
        setLive(null);
        return;
      }

      setLive((current) => {
        if (!current) return null;
        setSaved((prev) => {
          const next = { ...prev, [current.id]: current.point };
          writeStore(storageKeys.layout, next);
          return next;
        });
        return null;
      });

      // Flash the item so a wrap across the edge reads as intentional.
      setWrapped(state.id);
      window.setTimeout(() => setWrapped((id) => (id === state.id ? null : id)), 240);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [containerRef]);

  const didDrag = useCallback(() => draggedRef.current, []);

  return { positions, dragging: live?.id ?? null, wrapped, startDrag, didDrag };
}
