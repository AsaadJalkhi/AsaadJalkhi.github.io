/**
 * The media layout inside a case study.
 *
 * **Masonry, properly.** Two columns packed independently: each item goes into
 * whichever column is currently shorter, so a short landscape still next to a
 * tall portrait one does not leave a hole underneath it waiting for the row to
 * end. The old layout was a plain two-column CSS grid, which is row-based —
 * every item in a row is as tall as the tallest, and a page of mixed portrait
 * and landscape work turned into a column of gaps.
 *
 * The packing is done from the data, not from measurement: each item's height
 * is estimated from its aspect ratio before anything loads (`estimateRatio`),
 * columns are filled shortest-first, and the DOM is then static. No layout
 * observers, no reflow loop, no jump when the images arrive. Being a little
 * wrong about a caption's height costs slightly uneven columns and nothing else.
 *
 * **An item and its caption are one block.** The caption is inside the column,
 * under its own image, and counts towards that column's height — so a long
 * caption pushes its own column down and leaves the other one alone. Captions
 * are editorial copy here, not labels: they wrap, they keep their paragraphs,
 * and they never widen the column.
 *
 * **`featured` breaks out.** A featured item spans the full width on its own
 * row, and the masonry resumes underneath it. That is now `featured`'s only
 * job — it used to secretly also decide the project hero, which is why nobody
 * could have a full-width item that was not the hero. See `project.heroMediaId`.
 *
 * Narrow windows collapse to one column, in the original content order.
 *
 * Session 7 note that still holds: a tile is a plain container, never a
 * `<button>`. Wrapping a `<video>` or a cross-origin `<iframe>` in a button is
 * invalid nesting and swallows every click meant for the player's own controls.
 * Focus Mode is entered through each adapter's own explicit affordance.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Discipline, MediaItem } from '@/types/content';
import { MediaRenderer } from './MediaRenderer';
import { MediaFocus, type FocusContext } from './MediaFocus';
import { estimateRatio } from './aspect';
import './media.css';

/** Below this the two-up masonry becomes a single column. */
const TWO_COLUMN_MIN = 620;

interface Placed {
  item: MediaItem;
  /** Index into the original `media` array — what Focus Mode steps through. */
  index: number;
}

/**
 * How tall this item will be, relative to one column's width.
 *
 * `1 / ratio` is the picture. The rest is the caption block, approximated from
 * its length — precision is not the point, keeping a five-line caption from
 * being treated as free is.
 */
function estimateHeight(item: MediaItem): number {
  const picture = 1 / estimateRatio(item);
  const caption = item.caption?.trim();
  if (!caption) return picture + 0.03;
  const lines = Math.ceil(caption.length / 48) + caption.split('\n').length - 1;
  return picture + 0.05 + lines * 0.05;
}

/** Fill `count` columns shortest-first, preserving order within each column. */
function pack(items: Placed[], count: number): Placed[][] {
  const columns: Placed[][] = Array.from({ length: count }, () => []);
  if (count === 1) return [items];

  const heights = new Array(count).fill(0);
  for (const placed of items) {
    let shortest = 0;
    for (let i = 1; i < count; i += 1) {
      if (heights[i] < heights[shortest]) shortest = i;
    }
    columns[shortest].push(placed);
    heights[shortest] += estimateHeight(placed.item);
  }
  return columns;
}

/**
 * One or two columns, decided by the container rather than the viewport.
 *
 * A case study lives inside a draggable, resizable window — the viewport tells
 * us nothing useful about how wide it actually is.
 */
function useColumnCount(ref: React.RefObject<HTMLElement | null>): number {
  const [columns, setColumns] = useState(2);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    // No ResizeObserver (very old browsers): fail open at two columns rather
    // than pinning everything to one.
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(([entry]) => {
      setColumns(entry.contentRect.width >= TWO_COLUMN_MIN ? 2 : 1);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);

  return columns;
}

interface MediaGalleryProps {
  media: MediaItem[];
  seed: string;
  discipline?: Discipline;
  /** Allow tiles to open in Focus Mode. */
  lightbox?: boolean;
  /**
   * Project context for Focus Mode — title, company, year, tools.
   *
   * Existing fields only; Focus Mode renders a section only when it has
   * something to put in it, so an absent context simply shows less.
   */
  context?: FocusContext;
}

export function MediaGallery({
  media,
  seed,
  discipline,
  lightbox = true,
  context,
}: MediaGalleryProps) {
  const host = useRef<HTMLDivElement>(null);
  const columns = useColumnCount(host);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) =>
        current === null ? null : (current + delta + media.length) % media.length,
      ),
    [media.length],
  );

  const tile = (placed: Placed) => (
    <div className="media-masonry__item" key={placed.item.id}>
      <MediaRenderer
        media={placed.item}
        seed={seed}
        discipline={discipline}
        mode="full"
        onFocus={lightbox ? () => setOpenIndex(placed.index) : undefined}
      />
    </div>
  );

  if (!media.length) return null;

  /*
   * Split into runs around the full-width items, so a breakout interrupts the
   * masonry and the packing starts fresh underneath it. Packing the whole list
   * and then hoisting the featured ones out would reorder the work.
   */
  const rows: ({ kind: 'full'; placed: Placed } | { kind: 'run'; items: Placed[] })[] = [];
  let run: Placed[] = [];
  media.forEach((item, index) => {
    if (item.featured) {
      if (run.length) rows.push({ kind: 'run', items: run });
      run = [];
      rows.push({ kind: 'full', placed: { item, index } });
    } else {
      run.push({ item, index });
    }
  });
  if (run.length) rows.push({ kind: 'run', items: run });

  return (
    <>
      <div className="media-masonry" ref={host} data-columns={columns}>
        {rows.map((row, i) =>
          row.kind === 'full' ? (
            <div className="media-masonry__full" key={row.placed.item.id}>
              {tile(row.placed)}
            </div>
          ) : (
            <div className="media-masonry__run" key={`run-${i}`}>
              {pack(row.items, columns).map((column, c) => (
                <div className="media-masonry__col" key={c}>
                  {column.map(tile)}
                </div>
              ))}
            </div>
          ),
        )}
      </div>

      {openIndex !== null && (
        <MediaFocus
          media={media}
          index={openIndex}
          seed={seed}
          discipline={discipline}
          context={context}
          onClose={close}
          onStep={step}
        />
      )}
    </>
  );
}
