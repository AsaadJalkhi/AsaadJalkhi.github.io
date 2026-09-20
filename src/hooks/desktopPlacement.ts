/**
 * Desktop collision geometry — free positioning with protected space.
 *
 * This is **not** a grid. Icons and widgets keep their hand-placed, seeded
 * scatter and can be dropped anywhere the visitor likes; the only rule is that
 * two of them may not sit on top of each other. Every item carries a small
 * protected margin (`SAFE_PAD`) around its box, so "not overlapping" also means
 * "not touching" — a desktop where two labels share a pixel row reads as broken
 * even though nothing technically overlaps.
 *
 * Everything here works in **pixels**, not percentages. Percentages are what
 * gets stored (so a layout survives a resize), but a percentage is a different
 * distance horizontally than vertically, and "the nearest free spot" has to
 * mean nearest on screen. `useDesktopLayout` converts at the boundary.
 *
 * Pure, and deliberately so: no DOM, no React, no storage. The rules can then
 * be asserted with numbers in `scripts/check-ui.mjs` rather than by hand in a
 * browser.
 */

export interface Size {
  width: number;
  height: number;
}

/** A centre point, in pixels relative to the icon surface. */
export interface Spot {
  x: number;
  y: number;
}

/** Something already on the desktop: a centre point plus its footprint. */
export interface Obstacle extends Spot, Size {}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The protected margin around every item, in pixels. Small on purpose — this
 * is breathing room, not a cell. Large enough that two icons never appear to
 * be one object; small enough that the desktop still looks hand-arranged.
 */
export const SAFE_PAD = 10;

/** How far apart the candidate rings sit when a drop has to be resolved. */
const SEARCH_STEP = 12;
/** Candidates tried per ring. 16 is every 22.5°. */
const SEARCH_ANGLES = 16;
/** Ceiling on the search, so a full desktop cannot spin forever. */
const MAX_RINGS = 80;

/** Items are positioned by their centre (`translate(-50%, -50%)`). */
function rectOf(item: Obstacle, pad: number): Rect {
  return {
    left: item.x - item.width / 2 - pad,
    top: item.y - item.height / 2 - pad,
    right: item.x + item.width / 2 + pad,
    bottom: item.y + item.height / 2 + pad,
  };
}

/**
 * Do two protected areas intersect? The padding is applied once per pair —
 * half to each side — rather than twice, so `SAFE_PAD` reads as the gap
 * between two items rather than double it.
 */
export function collides(a: Obstacle, b: Obstacle, pad: number = SAFE_PAD): boolean {
  const ra = rectOf(a, pad / 2);
  const rb = rectOf(b, pad / 2);
  return ra.left < rb.right && ra.right > rb.left && ra.top < rb.bottom && ra.bottom > rb.top;
}

/** Is this spot clear of every obstacle given to it? */
export function isFreeSpot(
  spot: Spot,
  size: Size,
  obstacles: Obstacle[],
  pad: number = SAFE_PAD,
): boolean {
  const candidate: Obstacle = { ...spot, ...size };
  return !obstacles.some((other) => collides(candidate, other, pad));
}

/**
 * Keeps a resolved candidate wholly on the surface. Only resolved candidates
 * are clamped — a drop the visitor asked for is honoured exactly, half over an
 * edge included, because that is the existing desktop behaviour.
 */
function clampToSurface(spot: Spot, size: Size, surface: Size): Spot {
  const halfW = size.width / 2;
  const halfH = size.height / 2;
  // A surface narrower than the item leaves nothing to clamp to: centre it.
  const x =
    surface.width < size.width
      ? surface.width / 2
      : Math.min(Math.max(spot.x, halfW), surface.width - halfW);
  const y =
    surface.height < size.height
      ? surface.height / 2
      : Math.min(Math.max(spot.y, halfH), surface.height - halfH);
  return { x, y };
}

/**
 * The requested spot if it is free, otherwise the nearest free one.
 *
 * An outward ring search: rings of increasing radius around the requested
 * point, sixteen candidates each, first free candidate wins. Because the radius
 * only ever grows, the winner is the closest free spot to within one ring — and
 * the search reads as "it moved aside a little", which is what a drop that
 * lands on a neighbour should feel like. The ring is rotated half a step each
 * time so successive rings do not retry the same eight directions.
 *
 * If a desktop is so full that nothing is free within `MAX_RINGS`, the
 * requested spot is returned unchanged. An item that overlaps is better than an
 * item that vanished or snapped to a corner.
 */
export function resolveSpot(
  spot: Spot,
  size: Size,
  obstacles: Obstacle[],
  surface: Size,
  pad: number = SAFE_PAD,
): Spot {
  if (isFreeSpot(spot, size, obstacles, pad)) return spot;

  for (let ring = 1; ring <= MAX_RINGS; ring += 1) {
    const radius = ring * SEARCH_STEP;
    const offset = (ring % 2) * (Math.PI / SEARCH_ANGLES);
    for (let step = 0; step < SEARCH_ANGLES; step += 1) {
      const angle = offset + (step / SEARCH_ANGLES) * Math.PI * 2;
      const candidate = clampToSurface(
        { x: spot.x + Math.cos(angle) * radius, y: spot.y + Math.sin(angle) * radius },
        size,
        surface,
      );
      if (isFreeSpot(candidate, size, obstacles, pad)) return candidate;
    }
  }

  return spot;
}
