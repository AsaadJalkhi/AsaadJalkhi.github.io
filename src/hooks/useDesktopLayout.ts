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
 *
 * **Free positioning with protected space, not a grid.** Nothing snaps. Every
 * item carries a small protected margin (`desktopPlacement.ts`), and a position
 * is only rejected if it lands inside someone else's. A generated position that
 * collides is nudged to the nearest free spot; a *dropped* position that does
 * not collide is kept exactly as dropped, to the pixel. Saved and authored
 * positions are never rewritten, so a layout from before collision existed
 * still loads exactly as it was left.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react';
import type { Zone } from '@/types/content';
import { readStore, storageKeys, writeStore } from '@/lib/storage';
import { seededRandom } from '@/lib/utils';
import { useOs } from '@/state/os';
import { resolveSpot, type Obstacle, type Size, type Spot } from './desktopPlacement';

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
type SizeMap = Record<string, Size>;

/** Items per column before the scatter starts a second column inward. */
const PER_COLUMN = 6;
/** Vertical band the scatter uses, leaving room for the menu bar and dock. */
const Y_TOP = 11;
const Y_SPAN = 76;
/** A pointer that moves less than this is a click, not a drag. */
const DRAG_THRESHOLD_PX = 4;
/**
 * Footprint used for an item that has not been measured yet — one `.dicon`,
 * roughly. Only reachable on the very first layout pass, before the icons have
 * been laid out and their real boxes can be read.
 */
const FALLBACK_SIZE: Size = { width: 104, height: 120 };
/**
 * Marks an element as belonging to the layout, so its real footprint can be
 * measured. `DesktopIcon` and `DesktopWidget` both carry it.
 */
export const LAYOUT_ID_ATTR = 'data-layout-id';

/** Keeps a percentage on the surface by wrapping it, never by clamping it. */
function wrap(value: number): number {
  return ((value % 100) + 100) % 100;
}

function toPixels(point: LayoutPoint, surface: Size): Spot {
  return { x: (point.x / 100) * surface.width, y: (point.y / 100) * surface.height };
}

function toPercent(spot: Spot, surface: Size): LayoutPoint {
  return { x: (spot.x / surface.width) * 100, y: (spot.y / surface.height) * 100 };
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

/** Every laid-out element's real box, keyed by subject id. */
function measureSizes(container: HTMLElement): SizeMap {
  const out: SizeMap = {};
  container.querySelectorAll<HTMLElement>(`[${LAYOUT_ID_ATTR}]`).forEach((element) => {
    const id = element.getAttribute(LAYOUT_ID_ATTR);
    if (!id) return;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) out[id] = { width: rect.width, height: rect.height };
  });
  return out;
}

/** Sub-pixel comparison, so a measurement that did not really change is dropped. */
function sameSize(a: Size | undefined, b: Size | undefined): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a.width - b.width) < 1 && Math.abs(a.height - b.height) < 1;
}

function sameSizes(a: SizeMap, b: SizeMap): boolean {
  const keys = Object.keys(b);
  if (keys.length !== Object.keys(a).length) return false;
  return keys.every((key) => sameSize(a[key], b[key]));
}

export interface DesktopLayout {
  /** Final resolved position for every subject, as percentages. */
  positions: LayoutMap;
  /** id currently being dragged, for styling. */
  dragging: string | null;
  /** id that just crossed an edge or was nudged clear, for the flash. */
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
  /** The icon surface in pixels, and every item's measured footprint. */
  const [surface, setSurface] = useState<Size | null>(null);
  const [sizes, setSizes] = useState<SizeMap>({});

  // "Reset Desktop" wipes storage; drop the in-memory copy to match.
  useEffect(() => {
    setSaved(readStore<LayoutMap>(storageKeys.layout, {}));
  }, [desktopEpoch]);

  const dragState = useRef<{
    id: string;
    pointerId: number;
    element: HTMLElement;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const draggedRef = useRef(false);
  /** The last point the pointer asked for, before any collision resolution. */
  const requestedRef = useRef<LayoutPoint | null>(null);

  /*
   * Collision needs pixels, and pixels have to come from the DOM. This runs
   * after every layout and on resize; both setters bail when nothing moved, so
   * it settles on the first pass instead of looping.
   *
   * Not while a drag is in flight, though. A drag re-renders on every
   * `pointermove`, and re-reading every item's box each time is a forced reflow
   * per frame for measurements that cannot have changed — the icon being
   * dragged is the only thing moving, and moving does not resize it.
   */
  const syncGeometry = useCallback(() => {
    const container = containerRef.current;
    if (!container || dragState.current) return;
    const rect = container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const next: Size = { width: rect.width, height: rect.height };
      setSurface((prev) => (sameSize(prev ?? undefined, next) ? prev : next));
    }
    const measured = measureSizes(container);
    setSizes((prev) => (sameSizes(prev, measured) ? prev : measured));
  }, [containerRef]);

  useLayoutEffect(syncGeometry);

  useEffect(() => {
    window.addEventListener('resize', syncGeometry);
    return () => window.removeEventListener('resize', syncGeometry);
  }, [syncGeometry]);

  const sizeOf = useCallback((id: string): Size => sizes[id] ?? FALLBACK_SIZE, [sizes]);

  const generated = useMemo(() => scatter(subjects), [subjects]);

  const positions = useMemo(() => {
    const out: LayoutMap = {};
    /*
     * Three tiers, and the difference between them is who decided.
     *
     *   saved     — the visitor dragged it there. Placed first and *never*
     *               rewritten, at any viewport. This is the tier that makes a
     *               layout saved before collision existed still load exactly as
     *               it was left, overlaps and all.
     *   authored  — an `x`/`y` in the content file. A preference, not a promise:
     *               it gets first refusal on its spot, but it is resolved like
     *               anything else. Two widgets authored 21% apart do collide on
     *               a short viewport, and the author cannot pick coordinates
     *               that hold at every window size — that is this pass's job.
     *   generated — the seeded scatter, fitted around both of the above and
     *               around itself, so a newly added shortcut avoids everything
     *               already on the desktop.
     */
    const wants: LayoutMap = {};
    const authored: string[] = [];
    const seeded: string[] = [];
    subjects.forEach((subject) => {
      const decided = saved[subject.id];
      if (decided) {
        out[subject.id] = decided;
        return;
      }
      if (subject.x !== undefined && subject.y !== undefined) {
        wants[subject.id] = { x: subject.x, y: subject.y };
        authored.push(subject.id);
      } else {
        wants[subject.id] = generated[subject.id] ?? { x: 50, y: 50 };
        seeded.push(subject.id);
      }
    });
    // Authored before generated: an explicit coordinate gets first refusal when
    // the two want the same space.
    const authoredFirst = [...authored, ...seeded];

    if (surface) {
      const obstacles: Obstacle[] = Object.entries(out).map(([id, point]) => ({
        ...toPixels(point, surface),
        ...sizeOf(id),
      }));
      authoredFirst.forEach((id) => {
        const size = sizeOf(id);
        const spot = resolveSpot(toPixels(wants[id], surface), size, obstacles, surface);
        const point = toPercent(spot, surface);
        out[id] = { x: wrap(point.x), y: wrap(point.y) };
        obstacles.push({ ...spot, ...size });
      });
    } else {
      // Pre-measurement first paint: the authored and seeded points as-is.
      authoredFirst.forEach((id) => {
        out[id] = wants[id];
      });
    }

    if (live && out[live.id]) out[live.id] = live.point;
    return out;
  }, [subjects, generated, saved, live, surface, sizeOf]);

  // The drop handler lives in a window listener, so it reads the current layout
  // through refs rather than closing over a stale render.
  const positionsRef = useRef<LayoutMap>(positions);
  positionsRef.current = positions;
  const sizeOfRef = useRef(sizeOf);
  sizeOfRef.current = sizeOf;

  const startDrag = useCallback(
    (id: string, event: PointerEvent<HTMLElement>) => {
      // Left button / touch / pen only — right-click must stay a context menu.
      if (event.button !== 0) return;
      const container = containerRef.current;
      if (!container) return;

      const element = event.currentTarget;
      element.setPointerCapture(event.pointerId);
      draggedRef.current = false;
      requestedRef.current = null;
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

  /**
   * Turns the point the visitor let go at into the point the item keeps.
   *
   * Free where it is free: a drop that clears every protected area is stored
   * exactly as dropped, so nothing the visitor lines up by eye is snapped
   * afterwards. A drop that lands inside a neighbour's protected area is moved
   * to the nearest free spot *relative to the attempted drop*, so it still ends
   * up where it was aimed rather than back where it started.
   */
  const settle = useCallback(
    (id: string, requested: LayoutPoint, element: HTMLElement): LayoutPoint => {
      const container = containerRef.current;
      if (!container) return requested;
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return requested;

      const surfaceSize: Size = { width: rect.width, height: rect.height };
      const own = element.getBoundingClientRect();
      const size: Size =
        own.width > 0 && own.height > 0
          ? { width: own.width, height: own.height }
          : sizeOfRef.current(id);

      const obstacles: Obstacle[] = Object.entries(positionsRef.current)
        .filter(([other]) => other !== id)
        .map(([other, point]) => ({
          ...toPixels(point, surfaceSize),
          ...sizeOfRef.current(other),
        }));

      const spot = resolveSpot(toPixels(requested, surfaceSize), size, obstacles, surfaceSize);
      const point = toPercent(spot, surfaceSize);
      return { x: wrap(point.x), y: wrap(point.y) };
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
      // opposite one. There is no wall to hit. Collision is not consulted here
      // — while the pointer is down the item may pass freely over its
      // neighbours; it is the drop that has to be legal.
      const point = {
        x: wrap(((event.clientX - rect.left) / rect.width) * 100),
        y: wrap(((event.clientY - rect.top) / rect.height) * 100),
      };
      requestedRef.current = point;
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

      const requested = requestedRef.current;
      requestedRef.current = null;

      if (!state.moved || !requested) {
        setLive(null);
        return;
      }

      const accepted = settle(state.id, requested, state.element);
      setSaved((prev) => {
        const next = { ...prev, [state.id]: accepted };
        writeStore(storageKeys.layout, next);
        return next;
      });
      setLive(null);

      // Flash the item, so a wrap across the edge — or a nudge clear of a
      // neighbour — reads as intentional rather than as a glitch.
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
  }, [containerRef, settle]);

  const didDrag = useCallback(() => draggedRef.current, []);

  return { positions, dragging: live?.id ?? null, wrapped, startDrag, didDrag };
}
