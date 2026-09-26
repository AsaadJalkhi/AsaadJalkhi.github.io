/**
 * Shortest-column-first packing — the one masonry algorithm in the OS.
 *
 * Row-based layouts (CSS grid, flex-wrap) make every item in a row as tall as
 * the tallest one in it, so a short card leaves dead vertical space underneath
 * itself until the row ends. Once every item keeps its own shape — which is the
 * point of both the media grid and the Work grid — that is most rows, and the
 * page turns into a column of white holes.
 *
 * This packs instead: walk the items in their existing order and drop each one
 * into whichever column is currently shortest. Nothing is sorted and nothing is
 * reordered; "shortest column" is the only decision made, and it is made once
 * per item.
 *
 * The heights are **estimated from the data**, never measured, which is what
 * keeps the DOM static: no observer per card, no reflow loop, no jump when the
 * images arrive. Being slightly wrong about a caption or a title costs slightly
 * uneven columns and nothing else. Callers supply the estimator because only
 * they know what their item is made of — a media item's ratio and caption, a
 * project tile's ratio and label. The unit is arbitrary as long as it is
 * consistent within one call; both callers use "multiples of one column's
 * width", because that is the one length a column knows about itself.
 */

/**
 * How many columns a container of this width may hold.
 *
 * `steps` are ascending minimum widths, one per column beyond the first: with
 * `[700, 1150]`, 699px is one column, 700px is two and 1150px is three. Pure, so
 * the breakpoints can be asserted with numbers instead of a browser; the DOM
 * half lives in `hooks/useColumnCount.ts`.
 */
export function columnsForWidth(width: number, steps: readonly number[]): number {
  let columns = 1;
  for (const step of steps) {
    if (width >= step) columns += 1;
  }
  return columns;
}

/**
 * Fill `count` columns shortest-first, preserving the input order inside each.
 *
 * `height` is only ever read, and the input array is never mutated — the
 * content order it came from is the content order it keeps.
 */
export function packColumns<T>(
  items: readonly T[],
  count: number,
  height: (item: T) => number,
): T[][] {
  // One column is not a packing problem: the original order *is* the layout.
  if (count <= 1) return [items.slice()];

  const columns: T[][] = Array.from({ length: count }, () => []);
  const heights = new Array<number>(count).fill(0);

  for (const item of items) {
    let shortest = 0;
    for (let i = 1; i < count; i += 1) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    columns[shortest].push(item);
    heights[shortest] += height(item);
  }

  return columns;
}
